/**
 * DatabaseService
 * 
 * Centralizes SQLite database initialization and provides access to DAOs
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import TaskDAO from '../dao/TaskDAO';
import JournalDAO from '../dao/JournalDAO';
import DataMigrationService from './DataMigrationService';
import configService from './ConfigService';
import { initializeStorageService } from './storage/StorageService';

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbName = 'kukai.db';
    this.initialized = false;
    this.dbVersion = '1.0.0'; // Used for migrations
  }

  /**
   * Initialize the database and all DAOs
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      if (this.initialized) {
        console.log('Database already initialized');
        return { success: true, dbVersion: this.dbVersion };
      }

      console.log('Initializing database...');
      
      let initError = null;
      
      try {
        // Initialize DAOs - they now handle their own database connection
        await TaskDAO.initialize();
        await JournalDAO.initialize();
        
        // Initialize ConfigService with the database connection
        await configService.initialize(TaskDAO.db);
        
        // Initialize StorageService now that ConfigService is ready
        await initializeStorageService();
      } catch (error) {
        console.error('Error during initial DAO initialization:', error);
        initError = error;
      }
      
      // If there was an initialization error, run integrity check
      if (initError) {
        console.log('Attempting database recovery due to initialization error');
        const integrityResult = await this.checkDatabaseIntegrity();
        
        if (integrityResult.needsReset) {
          console.log('Database needs to be reset due to critical issues');
          
          // Only reset if the schema looks corrupted
          await this.resetDatabase();
        } else if (integrityResult.recovered) {
          console.log('Database issues automatically recovered');
        } else {
          console.error('Database issues could not be automatically recovered');
          return { 
            success: false, 
            error: 'Database integrity check failed',
            integrityResult,
            dbVersion: this.dbVersion
          };
        }
      }
      
      this.initialized = true;
      console.log('Database initialized successfully, version:', this.dbVersion);
      
      // Check if we need to migrate data from AsyncStorage to SQLite
      const migrationResult = await this.checkAndMigrateFromAsyncStorage();
      
      return {
        success: true,
        dbVersion: this.dbVersion,
        migrationPerformed: migrationResult.migrationPerformed,
        migrationResults: migrationResult.results,
        recoveryPerformed: !!initError
      };
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return { 
        success: false,
        error: error.message,
        dbVersion: this.dbVersion 
      };
    }
  }

  /**
   * Check if data migration from AsyncStorage to SQLite is needed and perform it if necessary
   * @returns {Promise<Object>} Migration result
   */
  async checkAndMigrateFromAsyncStorage() {
    try {
      // Check if migration has already been performed
      const migrationFlagPath = `${FileSystem.documentDirectory}sqlite_migration_completed`;
      
      try {
        const migrationInfo = await FileSystem.getInfoAsync(migrationFlagPath);
        if (migrationInfo.exists) {
          console.log('AsyncStorage to SQLite migration already performed');
          return { migrationPerformed: false };
        }
      } catch (error) {
        // If error, assume migration has not been performed
        console.log('Migration flag check failed, continuing with migration check');
      }
      
      // Check if there are tasks or journal entries in the database
      const taskCount = await TaskDAO.count();
      const journalCount = await JournalDAO.count();
      
      if (taskCount > 0 || journalCount > 0) {
        console.log('Data already exists in SQLite database, skipping migration');
        
        // Create flag file to mark migration as completed
        await FileSystem.writeAsStringAsync(migrationFlagPath, new Date().toISOString());
        
        return { migrationPerformed: false };
      }
      
      // Perform migration
      console.log('Starting data migration from AsyncStorage to SQLite...');
      const results = await DataMigrationService.migrateAllData();
      
      // Create flag file to mark migration as completed
      await FileSystem.writeAsStringAsync(migrationFlagPath, new Date().toISOString());
      
      return {
        migrationPerformed: true,
        results
      };
    } catch (error) {
      console.error('Error checking or performing migration:', error);
      return {
        migrationPerformed: false,
        error: error.message
      };
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database statistics
   */
  async getStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const taskCount = await TaskDAO.count();
      const taskStats = await TaskDAO.getTaskStats();
      
      const journalCount = await JournalDAO.count();
      const journalStats = await JournalDAO.getJournalStats();
      
      return {
        taskCount,
        taskStats,
        journalCount,
        journalStats,
        dbVersion: this.dbVersion
      };
    } catch (error) {
      console.error('Failed to get database statistics:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   * @returns {Promise<boolean>} Success indicator
   */
  async close() {
    try {
      // DAOs now manage their own connections, so we need to close them individually
      if (TaskDAO.db) {
        await TaskDAO.db.closeAsync();
      }
      
      if (JournalDAO.db) {
        await JournalDAO.db.closeAsync();
      }
      
      this.initialized = false;
      console.log('Database connections closed');
      return true;
    } catch (error) {
      console.error('Error closing database:', error);
      return false;
    }
  }

  /**
   * Reset the database by deleting and recreating it
   * This is a destructive operation that will delete all data
   * @returns {Promise<boolean>} Success indicator
   */
  async resetDatabase() {
    try {
      console.log('Resetting database...');
      
      // Close any existing connections
      await this.close();
      
      // Get database file path
      const dbPath = `${FileSystem.documentDirectory}SQLite/${this.dbName}`;
      
      // Check if database file exists
      const dbInfo = await FileSystem.getInfoAsync(dbPath);
      
      if (dbInfo.exists) {
        // Delete the database file
        await FileSystem.deleteAsync(dbPath);
        console.log(`Deleted database file at: ${dbPath}`);
      }
      
      // Reset the initialized flag
      this.initialized = false;
      
      // Reinitialize the database
      const result = await this.initialize();
      
      if (result.success) {
        console.log('Database reset successful');
        return true;
      } else {
        console.error('Failed to reinitialize database after reset');
        return false;
      }
    } catch (error) {
      console.error('Error resetting database:', error);
      return false;
    }
  }

  /**
   * Check database integrity and attempt repair for common issues
   * @returns {Promise<Object>} Check result with integrity status
   */
  async checkDatabaseIntegrity() {
    try {
      console.log('Checking database integrity...');
      
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Connect to database if needed
      if (!TaskDAO.db) {
        await TaskDAO.initialize();
      }
      
      // Run integrity check
      const db = TaskDAO.db; // Use existing connection
      const integrityResult = await db.getFirstAsync("PRAGMA integrity_check");
      const quickCheck = await db.getFirstAsync("PRAGMA quick_check");
      
      const issues = [];
      let needsReset = false;
      
      // Test critical queries to ensure tables are accessible
      try {
        await TaskDAO.count();
      } catch (error) {
        issues.push({
          table: 'tasks',
          error: error.message,
          recoverable: false
        });
        needsReset = true;
      }
      
      try {
        await JournalDAO.count();
      } catch (error) {
        issues.push({
          table: 'journal_entries',
          error: error.message,
          recoverable: false
        });
        needsReset = true;
      }
      
      // Collect database schema for diagnostics
      let schema = [];
      try {
        const tables = await db.getAllAsync(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        for (const table of tables) {
          const columns = await db.getAllAsync(`PRAGMA table_info(${table.name})`);
          schema.push({
            table: table.name,
            columns: columns.map(col => ({ 
              name: col.name, 
              type: col.type,
              notNull: col.notnull === 1
            }))
          });
        }
      } catch (error) {
        console.error('Error getting schema:', error);
      }
      
      const integrityOk = integrityResult.integrity_check === 'ok';
      const quickCheckOk = quickCheck.quick_check === 'ok';
      
      if (!integrityOk || !quickCheckOk || issues.length > 0) {
        console.log('Database integrity issues found, attempting automatic recovery...');
        
        if (needsReset) {
          console.log('Critical issues detected, database needs to be reset');
          return {
            integrityOk: false,
            quickCheckOk: quickCheckOk,
            issues,
            schema,
            needsReset: true,
            recovered: false
          };
        } else {
          // Attempt vacuum to rebuild database
          await db.execAsync('VACUUM');
          console.log('Performed database VACUUM');
          
          // Reinitialize DAOs to rebuild tables if needed
          await TaskDAO.initialize();
          await JournalDAO.initialize();
          
          return {
            integrityOk: integrityOk,
            quickCheckOk: quickCheckOk,
            issues,
            schema,
            needsReset: false,
            recovered: true
          };
        }
      }
      
      return {
        integrityOk: integrityOk,
        quickCheckOk: quickCheckOk,
        issues,
        schema,
        needsReset: false,
        recovered: false
      };
    } catch (error) {
      console.error('Error checking database integrity:', error);
      return {
        integrityOk: false,
        quickCheckOk: false,
        error: error.message,
        needsReset: true,
        recovered: false
      };
    }
  }

  /**
   * Get detailed database diagnostics
   * @returns {Promise<Object>} Diagnostic information
   */
  async getDiagnostics() {
    try {
      console.log('Gathering database diagnostics...');
      
      // Check SQLite version and API
      let sqliteInfo = {};
      try {
        sqliteInfo = {
          apiVersion: SQLite.version || 'unknown',
          isDatabaseOpened: !!this.db
        };
      } catch (error) {
        console.error('Error checking SQLite info:', error);
        sqliteInfo.error = error.message;
      }
      
      // Check if database file exists
      let fileInfo = {};
      try {
        const dbPath = `${FileSystem.documentDirectory}SQLite/${this.dbName}`;
        const dbInfo = await FileSystem.getInfoAsync(dbPath);
        
        fileInfo = {
          path: dbPath,
          exists: dbInfo.exists,
          size: dbInfo.size,
          modificationTime: dbInfo.modificationTime
        };
        
        // Directory info
        const dirPath = `${FileSystem.documentDirectory}SQLite`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        
        if (dirInfo.exists) {
          try {
            // Get list of files in directory
            const files = await FileSystem.readDirectoryAsync(dirPath);
            fileInfo.directory = dirPath;
            fileInfo.dirExists = true;
            fileInfo.otherFiles = files;
          } catch (dirError) {
            fileInfo.dirError = dirError.message;
          }
        } else {
          fileInfo.dirExists = false;
        }
      } catch (error) {
        console.error('Error checking database file:', error);
        fileInfo.error = error.message;
      }
      
      // Get initialization state
      const initState = {
        serviceInitialized: this.initialized,
        hasTaskDAO: !!this.taskDAO,
        hasJournalDAO: !!this.journalDAO
      };
      
      // Try to open a test connection
      let testConnection = {};
      try {
        const testDb = await SQLite.openDatabaseAsync(this.dbName);
        testConnection.opened = !!testDb;
        
        // Try a simple query
        try {
          const result = await testDb.getFirstAsync('SELECT sqlite_version() as version');
          testConnection.sqliteVersion = result.version;
          testConnection.querySucceeded = true;
        } catch (queryError) {
          testConnection.queryError = queryError.message;
          testConnection.querySucceeded = false;
        }
        
        // Test close
        try {
          await testDb.closeAsync();
          testConnection.closedSuccessfully = true;
        } catch (closeError) {
          testConnection.closeError = closeError.message;
          testConnection.closedSuccessfully = false;
        }
      } catch (openError) {
        testConnection.openError = openError.message;
        testConnection.opened = false;
      }
      
      return {
        timestamp: new Date().toISOString(),
        sqliteInfo,
        fileInfo,
        initState,
        testConnection,
        dbVersion: this.dbVersion
      };
    } catch (error) {
      console.error('Error generating diagnostics:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if migration from AsyncStorage is needed
   * @returns {Promise<boolean>} Whether migration is needed
   * @private
   */
  async _checkMigrationNeeded() {
    try {
      const migrationFlagPath = `${FileSystem.documentDirectory}sqlite_migration_completed`;
      const migrationInfo = await FileSystem.getInfoAsync(migrationFlagPath);
      
      if (!migrationInfo.exists) {
        // Check for data in AsyncStorage via DataMigrationService
        return await DataMigrationService.checkForAsyncStorageData();
      }
      
      return false;
    } catch (error) {
      console.error('Error checking migration needed:', error);
      return false;
    }
  }
}

export default new DatabaseService(); 