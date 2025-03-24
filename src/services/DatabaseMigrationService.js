/**
 * DatabaseMigrationService
 * Manages database schema versions and migrations
 * Provides automated migration between versions with safety mechanisms
 */
import * as SQLite from 'expo-sqlite';
import databaseBackupService from './DatabaseBackupService';

// Database constants
const DB_NAME = 'kukai.db';
const CURRENT_DB_VERSION = 3; // Increment this when adding new migrations

export class DatabaseMigrationService {
  /**
   * Initialize the migration service
   * @param {Object} db - SQLite database connection (optional, will create if not provided)
   */
  constructor(db = null) {
    this.db = db;
    
    // Define migrations as an array of objects
    // Each migration should have: version, name, and up/down functions
    this.migrations = [
      { 
        version: 1, 
        name: 'Initial schema', 
        up: this.migration_1_initial_schema,
        down: this.migration_1_rollback 
      },
      { 
        version: 2, 
        name: 'Add app_config table', 
        up: this.migration_2_add_config_table,
        down: this.migration_2_rollback 
      },
      { 
        version: 3, 
        name: 'Add database version tracking table', 
        up: this.migration_3_add_version_table,
        down: this.migration_3_rollback 
      },
      // Add new migrations here in sequence
    ];
  }

  /**
   * Open database connection if not already open
   * @returns {Object} Database connection
   */
  async openDatabase() {
    if (!this.db) {
      try {
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        console.log('Migration service: Database connection opened');
      } catch (error) {
        console.error('Migration service: Error opening database:', error);
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Create version tracking table if it doesn't exist
   * This is a special table that tracks migrations separately from app_config
   */
  async ensureVersionTable() {
    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS db_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          success BOOLEAN DEFAULT 1
        )
      `);
      return true;
    } catch (error) {
      console.error('Error creating version table:', error);
      throw error;
    }
  }
  
  /**
   * Get current database version from the migrations table
   * @returns {Number} Current database version
   */
  async getCurrentVersion() {
    try {
      // First check if the migrations table exists
      const tableExists = await this.db.getFirstAsync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='db_migrations'
      `);
      
      if (!tableExists) {
        return 0;
      }
      
      // Get highest applied version
      const result = await this.db.getFirstAsync(`
        SELECT MAX(version) as version FROM db_migrations
        WHERE success = 1
      `);
      
      return result && result.version ? result.version : 0;
    } catch (error) {
      console.error('Error getting database version:', error);
      return 0; // Assume new database if error
    }
  }

  /**
   * Record a migration in the versions table
   * @param {Number} version - Migration version
   * @param {String} name - Migration name
   * @param {Boolean} success - Whether migration was successful
   */
  async recordMigration(version, name, success = true) {
    try {
      await this.db.runAsync(`
        INSERT INTO db_migrations (version, name, success, applied_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [version, name, success ? 1 : 0]);
      
      return true;
    } catch (error) {
      console.error(`Error recording migration version ${version}:`, error);
      throw error;
    }
  }

  /**
   * Check if a specific migration has been applied
   * @param {Number} version - Migration version to check
   * @returns {Boolean} Whether the migration has been applied
   */
  async hasMigrationRun(version) {
    try {
      const result = await this.db.getFirstAsync(`
        SELECT version FROM db_migrations
        WHERE version = ? AND success = 1
      `, [version]);
      
      return !!result;
    } catch (error) {
      console.error(`Error checking if migration ${version} has run:`, error);
      return false;
    }
  }

  /**
   * Get list of applied migrations
   * @returns {Array} List of applied migrations
   */
  async getAppliedMigrations() {
    try {
      return await this.db.getAllAsync(`
        SELECT version, name, applied_at, success
        FROM db_migrations
        ORDER BY version ASC
      `);
    } catch (error) {
      console.error('Error getting applied migrations:', error);
      return [];
    }
  }

  /**
   * Create a backup before migration
   * @param {Number} targetVersion - Target version for backup name
   * @returns {Object} Backup result
   */
  async createBackupBeforeMigration(targetVersion) {
    try {
      const backupName = `pre_migration_v${targetVersion}_${Date.now()}`;
      return await databaseBackupService.createBackup(backupName);
    } catch (error) {
      console.error('Error creating pre-migration backup:', error);
      // Continue with migration even if backup fails
      return { success: false, error };
    }
  }

  /**
   * Run all pending migrations up to the current DB version
   * @returns {Object} Migration result
   */
  async migrate() {
    try {
      // Ensure database connection
      await this.openDatabase();
      
      // Ensure version table exists
      await this.ensureVersionTable();
      
      // Get current version
      const currentVersion = await this.getCurrentVersion();
      console.log(`Current database version: ${currentVersion}`);
      
      // Check if we're already at the latest version
      if (currentVersion >= CURRENT_DB_VERSION) {
        console.log('Database is already at the latest version');
        return { 
          success: true, 
          message: 'Database already up to date',
          currentVersion
        };
      }
      
      // Get pending migrations
      const pendingMigrations = this.migrations.filter(
        migration => migration.version > currentVersion
      ).sort((a, b) => a.version - b.version);
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations found');
        return {
          success: true,
          message: 'No migrations needed',
          currentVersion
        };
      }
      
      console.log(`Found ${pendingMigrations.length} pending migrations`);
      
      // Create a backup before starting migrations
      const targetVersion = pendingMigrations[pendingMigrations.length - 1].version;
      await this.createBackupBeforeMigration(targetVersion);
      
      // Run migrations in a transaction
      try {
        await this.db.execAsync('BEGIN TRANSACTION');
        
        // Apply each migration in sequence
        for (const migration of pendingMigrations) {
          console.log(`Running migration ${migration.version}: ${migration.name}`);
          
          try {
            // Run the migration
            await migration.up.call(this, this.db);
            
            // Record successful migration
            await this.recordMigration(migration.version, migration.name, true);
            
            console.log(`Migration ${migration.version} completed successfully`);
          } catch (error) {
            console.error(`Error in migration ${migration.version}:`, error);
            
            // Record failed migration
            await this.recordMigration(migration.version, migration.name, false);
            
            // Rollback transaction
            await this.db.execAsync('ROLLBACK');
            
            return {
              success: false,
              message: `Migration ${migration.version} failed: ${error.message}`,
              error,
              failedVersion: migration.version
            };
          }
        }
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        
        console.log(`Database successfully migrated to version ${targetVersion}`);
        return {
          success: true,
          message: `Database migrated from v${currentVersion} to v${targetVersion}`,
          previousVersion: currentVersion,
          currentVersion: targetVersion
        };
      } catch (error) {
        // Ensure transaction is rolled back
        try {
          await this.db.execAsync('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
        
        console.error('Migration process failed:', error);
        return {
          success: false,
          message: `Migration process failed: ${error.message}`,
          error
        };
      }
    } catch (error) {
      console.error('Migration initialization failed:', error);
      return {
        success: false,
        message: `Migration initialization failed: ${error.message}`,
        error
      };
    }
  }

  /**
   * Migrate down to a specific version
   * @param {Number} targetVersion - Target version to migrate down to
   * @returns {Object} Downgrade result
   */
  async migrateDown(targetVersion) {
    try {
      // Ensure database connection
      await this.openDatabase();
      
      // Get current version
      const currentVersion = await this.getCurrentVersion();
      
      if (currentVersion <= targetVersion) {
        return {
          success: false,
          message: `Cannot downgrade: current version (${currentVersion}) is not higher than target (${targetVersion})`
        };
      }
      
      // Get migrations to run in reverse
      const migrationsToRevert = this.migrations
        .filter(migration => migration.version > targetVersion && migration.version <= currentVersion)
        .sort((a, b) => b.version - a.version); // Reverse order
      
      if (migrationsToRevert.length === 0) {
        return {
          success: true,
          message: 'No migrations to revert',
          currentVersion
        };
      }
      
      // Create a backup before downgrading
      await this.createBackupBeforeMigration(`downgrade_from_${currentVersion}_to_${targetVersion}`);
      
      // Run migrations in a transaction
      try {
        await this.db.execAsync('BEGIN TRANSACTION');
        
        // Apply each migration's 'down' method in reverse sequence
        for (const migration of migrationsToRevert) {
          if (!migration.down) {
            throw new Error(`Migration ${migration.version} does not support downgrade`);
          }
          
          console.log(`Reverting migration ${migration.version}: ${migration.name}`);
          await migration.down.call(this, this.db);
          
          // Remove the migration record
          await this.db.runAsync(
            'DELETE FROM db_migrations WHERE version = ?', 
            [migration.version]
          );
        }
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        
        console.log(`Database successfully downgraded to version ${targetVersion}`);
        return {
          success: true,
          message: `Database downgraded from v${currentVersion} to v${targetVersion}`,
          previousVersion: currentVersion,
          currentVersion: targetVersion
        };
      } catch (error) {
        // Ensure transaction is rolled back
        try {
          await this.db.execAsync('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error rolling back transaction:', rollbackError);
        }
        
        console.error('Downgrade process failed:', error);
        return {
          success: false,
          message: `Downgrade process failed: ${error.message}`,
          error
        };
      }
    } catch (error) {
      console.error('Downgrade initialization failed:', error);
      return {
        success: false,
        message: `Downgrade initialization failed: ${error.message}`,
        error
      };
    }
  }

  /**
   * Reset database - drop all tables and recreate
   * USE WITH CAUTION - this will delete all data
   */
  async resetDatabase() {
    try {
      // Ensure database connection
      await this.openDatabase();
      
      // Create a backup before reset
      await this.createBackupBeforeMigration('pre_reset');
      
      // Drop all tables
      await this.db.execAsync(`
        PRAGMA foreign_keys = OFF;
        
        DROP TABLE IF EXISTS focus_sessions;
        DROP TABLE IF EXISTS journal_templates;
        DROP TABLE IF EXISTS journal_entries;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS meditation_sessions;
        DROP TABLE IF EXISTS app_config;
        DROP TABLE IF EXISTS db_migrations;
        
        PRAGMA foreign_keys = ON;
      `);
      
      console.log('Database tables dropped successfully');
      
      // Run migrations again
      const result = await this.migrate();
      
      return {
        success: result.success,
        message: 'Database reset completed successfully',
        migrationResult: result
      };
    } catch (error) {
      console.error('Database reset failed:', error);
      return {
        success: false,
        message: `Database reset failed: ${error.message}`,
        error
      };
    }
  }

  // =======================================================================
  // MIGRATION DEFINITIONS
  // Each migration should have corresponding up and down methods
  // =======================================================================

  /**
   * Migration 1: Initial schema
   * Creates the base tables for the application
   */
  async migration_1_initial_schema(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meditation_sessions (
        id TEXT PRIMARY KEY,
        duration INTEGER NOT NULL,
        sound_theme TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        completed BOOLEAN DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATETIME,
        priority INTEGER,
        completed BOOLEAN DEFAULT 0,
        is_frog BOOLEAN DEFAULT 0,
        is_important BOOLEAN DEFAULT 0,
        is_urgent BOOLEAN DEFAULT 0,
        reminder_time INTEGER,
        category_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        mood TEXT,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS journal_templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        duration INTEGER NOT NULL,
        task_id TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        completed BOOLEAN DEFAULT 0,
        interruptions INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );
    `);
  }
  
  /**
   * Migration 1: Rollback
   * Drops all initial tables
   */
  async migration_1_rollback(db) {
    await db.execAsync(`
      DROP TABLE IF EXISTS focus_sessions;
      DROP TABLE IF EXISTS journal_templates;
      DROP TABLE IF EXISTS journal_entries;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS meditation_sessions;
    `);
  }

  /**
   * Migration 2: Add app_config table
   * Creates the configuration table
   */
  async migration_2_add_config_table(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        value_type TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  
  /**
   * Migration 2: Rollback
   * Drops the app_config table
   */
  async migration_2_rollback(db) {
    await db.execAsync(`
      DROP TABLE IF EXISTS app_config;
    `);
  }

  /**
   * Migration 3: Add version tracking table
   * Creates the db_migrations table for tracking schema versions
   */
  async migration_3_add_version_table(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS db_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT 1
      );
      
      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
      CREATE INDEX IF NOT EXISTS idx_meditation_sessions_date ON meditation_sessions (date(start_time));
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions (date(start_time));
      CREATE INDEX IF NOT EXISTS idx_journal_entries_timestamp ON journal_entries (date(timestamp));
    `);
  }
  
  /**
   * Migration 3: Rollback
   * Drops the version tracking table and indexes
   */
  async migration_3_rollback(db) {
    await db.execAsync(`
      DROP TABLE IF EXISTS db_migrations;
      
      DROP INDEX IF EXISTS idx_tasks_priority;
      DROP INDEX IF EXISTS idx_tasks_due_date;
      DROP INDEX IF EXISTS idx_meditation_sessions_date;
      DROP INDEX IF EXISTS idx_focus_sessions_date;
      DROP INDEX IF EXISTS idx_journal_entries_timestamp;
    `);
  }
} 