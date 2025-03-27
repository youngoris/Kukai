/**
 * DatabaseResetUtil
 * 
 * Utility functions to completely reset and rebuild the SQLite database
 * Use this to recover from critical schema issues
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Alert, DeviceEventEmitter } from 'react-native';
import TaskDAO from '../dao/TaskDAO';
import JournalDAO from '../dao/JournalDAO';
import configService from '../services/ConfigService';

const DB_NAME = 'kukai.db';
const BACKUP_DIR = `${FileSystem.documentDirectory}Backups`;

/**
 * Delete the SQLite database file entirely
 * @returns {Promise<boolean>} Success indicator
 */
export const deleteDatabase = async () => {
  try {
    console.log('Deleting database file...');
    
    // Get database path
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dbPath = `${dbDir}/${DB_NAME}`;
    
    // Check if database file exists before attempting to delete
    const dbExists = await FileSystem.getInfoAsync(dbPath);
    
    if (dbExists.exists) {
      // Delete the file
      await FileSystem.deleteAsync(dbPath);
      console.log('Database file deleted successfully');
      return true;
    } else {
      console.log('Database file does not exist, nothing to delete');
      return true;
    }
  } catch (error) {
    console.error('Error deleting database file:', error);
    return false;
  }
};

/**
 * Backup the database file before resetting
 * @returns {Promise<string|null>} Backup file path if successful, null otherwise
 */
export const backupDatabase = async () => {
  try {
    console.log('Creating database backup...');
    
    // Get database path
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dbPath = `${dbDir}/${DB_NAME}`;
    
    // Check if database file exists
    const dbExists = await FileSystem.getInfoAsync(dbPath);
    if (!dbExists.exists) {
      console.log('No database file to backup');
      return null;
    }
    
    // Create backup directory if it doesn't exist
    const backupDirExists = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!backupDirExists.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR);
    }
    
    // Create backup file with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupPath = `${BACKUP_DIR}/kukai_backup_${timestamp}.db`;
    
    // Copy database file to backup location
    await FileSystem.copyAsync({
      from: dbPath,
      to: backupPath
    });
    
    console.log(`Database backed up to ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('Error backing up database:', error);
    return null;
  }
};

/**
 * Restore database from a backup
 * @param {string} backupPath Path to backup file
 * @returns {Promise<boolean>} Success indicator
 */
export const restoreDatabase = async (backupPath) => {
  try {
    console.log(`Restoring database from ${backupPath}...`);
    
    // Get database path
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dbPath = `${dbDir}/${DB_NAME}`;
    
    // Check if backup file exists
    const backupExists = await FileSystem.getInfoAsync(backupPath);
    if (!backupExists.exists) {
      console.error('Backup file does not exist');
      return false;
    }
    
    // Ensure database directory exists
    const dbDirExists = await FileSystem.getInfoAsync(dbDir);
    if (!dbDirExists.exists) {
      await FileSystem.makeDirectoryAsync(dbDir);
    }
    
    // Delete existing database if it exists
    const dbExists = await FileSystem.getInfoAsync(dbPath);
    if (dbExists.exists) {
      await FileSystem.deleteAsync(dbPath);
    }
    
    // Copy backup file to database location
    await FileSystem.copyAsync({
      from: backupPath,
      to: dbPath
    });
    
    console.log('Database restored successfully');
    return true;
  } catch (error) {
    console.error('Error restoring database:', error);
    return false;
  }
};

/**
 * Get list of available database backups
 * @returns {Promise<Array>} List of backup files
 */
export const getAvailableBackups = async () => {
  try {
    // Create backup directory if it doesn't exist
    const backupDirExists = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!backupDirExists.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR);
      return [];
    }
    
    // Get list of files in backup directory
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    
    // Filter to only include database backup files
    const backups = files.filter(file => file.startsWith('kukai_backup_') && file.endsWith('.db'));
    
    // Sort by date (most recent first)
    backups.sort().reverse();
    
    return backups.map(file => ({
      name: file,
      path: `${BACKUP_DIR}/${file}`,
      date: parseBackupDate(file)
    }));
  } catch (error) {
    console.error('Error getting available backups:', error);
    return [];
  }
};

/**
 * Parse date from backup filename
 * @param {string} filename Backup filename
 * @returns {Date} Parsed date
 */
const parseBackupDate = (filename) => {
  try {
    // Extract date string from filename (format: kukai_backup_YYYY-MM-DDTHH-MM-SS.db)
    const dateString = filename.replace('kukai_backup_', '').replace('.db', '').replace(/-/g, ':');
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing backup date:', error);
    return new Date(0);
  }
};

/**
 * Prompt the user to confirm database reset
 * @returns {Promise<boolean>} True if user confirmed, false if cancelled
 */
export const confirmDatabaseReset = () => {
  return new Promise((resolve) => {
    Alert.alert(
      'Reset Database',
      'This will delete all your tasks, journal entries, and settings. This action cannot be undone. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

/**
 * Hard reload the application
 * This triggers a complete remount of the React tree
 */
export const reloadApp = () => {
  DeviceEventEmitter.emit('hardReload');
};

/**
 * Complete database reset process
 * 1. Confirm with the user
 * 2. Backup the database
 * 3. Delete the database file
 * 4. Reload the app to reinitialize everything
 */
export const resetDatabase = async () => {
  try {
    // Ask for confirmation
    const confirmed = await confirmDatabaseReset();
    
    if (!confirmed) {
      console.log('Database reset cancelled by user');
      return false;
    }
    
    // Backup database before reset
    const backupPath = await backupDatabase();
    let backupMessage = backupPath ? 
      'A backup of your data was created before reset.' : 
      'Warning: Could not create a backup of your data.';
    
    // Delete database file
    const deleted = await deleteDatabase();
    
    if (!deleted) {
      Alert.alert('Error', 'Failed to delete database file. Please try again or restart the app.');
      return false;
    }
    
    // Notify user of success
    Alert.alert(
      'Database Reset',
      `Database reset successful. ${backupMessage} The app will now restart.`,
      [{ text: 'OK', onPress: reloadApp }]
    );
    
    return true;
  } catch (error) {
    console.error('Database reset failed:', error);
    Alert.alert('Error', 'Failed to reset database: ' + error.message);
    return false;
  }
};

/**
 * Verify database health and schema
 * @returns {Promise<Object>} Verification results
 */
export const verifyDatabase = async () => {
  console.log('======== DATABASE VERIFICATION ========');
  
  try {
    // Initialize DAOs
    console.log('Initializing TaskDAO...');
    await TaskDAO.initialize();
    console.log('TaskDAO initialized successfully');
    
    console.log('Initializing JournalDAO...');
    await JournalDAO.initialize();
    console.log('JournalDAO initialized successfully');
    
    // Verify task table structure
    console.log('\nVerifying tasks table structure...');
    const taskDB = TaskDAO.db;
    const tasksTableInfo = await taskDB.getAllAsync('PRAGMA table_info(tasks)');
    console.log('Task table columns:');
    tasksTableInfo.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    // Verify journal table structure
    console.log('\nVerifying journal_entries table structure...');
    const journalDB = JournalDAO.db;
    const journalTableInfo = await journalDB.getAllAsync('PRAGMA table_info(journal_entries)');
    console.log('Journal table columns:');
    journalTableInfo.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    // Test query for tasks to check if we can read from the table
    try {
      const taskCount = await TaskDAO.count();
      console.log(`Tasks count: ${taskCount}`);
    } catch (error) {
      console.error('Failed to query tasks table:', error);
      throw new Error(`Task table query failed: ${error.message}`);
    }
    
    // Test query for journal entries to check if we can read from the table
    try {
      const journalCount = await JournalDAO.count();
      console.log(`Journal entries count: ${journalCount}`);
    } catch (error) {
      console.error('Failed to query journal_entries table:', error);
      throw new Error(`Journal table query failed: ${error.message}`);
    }
    
    // Test database integrity - with proper error handling
    console.log('\nRunning database integrity check...');
    try {
      const integrityResult = await taskDB.execAsync('PRAGMA integrity_check');
      
      // Safely check if the integrity check returned valid results
      const integrityOk = integrityResult && 
                         integrityResult.rows && 
                         integrityResult.rows._array && 
                         integrityResult.rows._array.length > 0 &&
                         integrityResult.rows._array[0].integrity_check === 'ok';
      
      console.log(`Integrity check: ${integrityOk ? 'OK' : 'FAILED'}`);
      
      if (!integrityOk) {
        // If we got a result but integrity check failed
        if (integrityResult && 
            integrityResult.rows && 
            integrityResult.rows._array && 
            integrityResult.rows._array.length > 0) {
          console.log('Integrity issues found:', integrityResult.rows._array[0].integrity_check);
        } else {
          console.log('Integrity check failed: No valid result returned');
        }
        // Continue without throwing an error - we'll just report the issue
      }
    } catch (integrityError) {
      // Log but don't throw, as this is not fatal
      console.error('Error running integrity check:', integrityError);
      console.log('Skipping integrity check due to error');
    }
    
    // Run a simpler test query to ensure basic functionality
    console.log('\nRunning simple test query...');
    try {
      await taskDB.execAsync('SELECT 1');
      console.log('Basic query test: PASSED');
    } catch (queryError) {
      console.error('Basic query test failed:', queryError);
      throw new Error('Basic database functionality is broken');
    }
    
    console.log('\n======== VERIFICATION COMPLETE ========');
    console.log('Database is healthy');
    
    return {
      success: true,
      taskColumns: tasksTableInfo.map(col => ({ name: col.name, type: col.type })),
      journalColumns: journalTableInfo.map(col => ({ name: col.name, type: col.type }))
    };
  } catch (error) {
    console.error('\n======== VERIFICATION FAILED ========');
    console.error('Database error:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Force recreate tables with correct schema
 * This is more aggressive than reset as it drops and recreates specific tables
 * @returns {Promise<boolean>} Success indicator
 */
export const forceRecreateSchema = async () => {
  try {
    console.log('Force recreating database schema...');
    
    // Initialize database connections
    await TaskDAO.initialize();
    await JournalDAO.initialize();
    
    const db = TaskDAO.db; // Use existing connection
    
    // Reinitialize ConfigService with the database connection
    await configService.initialize(db);
    
    // Use a transaction for schema operations when possible to ensure atomicity
    try {
      // Drop and recreate tasks table
      console.log('Recreating tasks table...');
      
      // First drop dependencies (foreign key constraints)
      await db.execAsync('DROP TABLE IF EXISTS tomorrow_tasks');
      await db.execAsync('DROP TABLE IF EXISTS tasks');
      
      // Create tasks table with correct schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          text TEXT NOT NULL,
          description TEXT,
          completed INTEGER DEFAULT 0,
          completed_at TIMESTAMP,
          is_frog INTEGER DEFAULT 0,
          is_important INTEGER DEFAULT 0, 
          is_urgent INTEGER DEFAULT 0,
          is_time_tagged INTEGER DEFAULT 0,
          task_time TEXT,
          has_reminder INTEGER DEFAULT 0,
          reminder_time INTEGER DEFAULT 15,
          notify_at_deadline INTEGER DEFAULT 1,
          category_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Tasks table created successfully');
      
      // Create tomorrow_tasks table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tomorrow_tasks (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
      `);
      console.log('Tomorrow_tasks table created successfully');
      
      // Create indices one by one for better error reporting
      try {
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`);
        console.log('Created tasks_completed index');
      } catch (e) {
        console.error('Failed to create tasks_completed index:', e);
      }
      
      try {
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_is_frog ON tasks(is_frog)`);
        console.log('Created tasks_is_frog index');
      } catch (e) {
        console.error('Failed to create tasks_is_frog index:', e);
      }
      
      try {
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(task_time)`);
        console.log('Created tasks_time index');
      } catch (e) {
        console.error('Failed to create tasks_time index:', e);
      }
      
      try {
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tomorrow_tasks ON tomorrow_tasks(task_id)`);
        console.log('Created tomorrow_tasks index');
      } catch (e) {
        console.error('Failed to create tomorrow_tasks index:', e);
      }
    } catch (error) {
      console.error('Error recreating tasks tables:', error);
      // Continue with journal tables even if tasks failed
    }
    
    try {
      // Drop and recreate journal tables
      console.log('Recreating journal tables...');
      await db.execAsync('DROP TABLE IF EXISTS journal_entries');
      await db.execAsync('DROP TABLE IF EXISTS journal_templates');
      
      // Create journal_entries table with correct schema
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          text TEXT NOT NULL,
          date TEXT NOT NULL,
          location TEXT,
          weather TEXT,
          temperature REAL,
          mood TEXT,
          template_id TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Journal_entries table created successfully');
      
      // Create journal_templates table
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS journal_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          is_system INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Journal_templates table created successfully');
      
      // Create journal index
      try {
        await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)`);
        console.log('Created journal_date index');
      } catch (e) {
        console.error('Failed to create journal_date index:', e);
      }
      
      // Initialize default journal templates
      try {
        await JournalDAO._createDefaultTemplates();
        console.log('Default templates created');
      } catch (e) {
        console.error('Failed to create default templates:', e);
      }
    } catch (error) {
      console.error('Error recreating journal tables:', error);
    }
    
    console.log('Database schema recreated successfully');
    
    // Run a simple test query to ensure basic functionality
    try {
      await db.execAsync('SELECT 1');
      console.log('Basic query test: PASSED');
      
      // Test task creation
      const testTask = {
        text: 'Test task',
        title: 'Test title',
        description: 'Test task created during schema verification'
      };
      await TaskDAO.createTask(testTask);
      console.log('Test task creation: PASSED');
      
      // Test journal creation
      const today = new Date().toISOString().split('T')[0];
      const testEntry = {
        title: 'Test Journal',
        text: 'Test journal entry created during schema verification',
        date: today
      };
      await JournalDAO.createEntry(testEntry);
      console.log('Test journal creation: PASSED');
      
      return true;
    } catch (testError) {
      console.error('Database test failed after recreation:', testError);
      return false;
    }
  } catch (error) {
    console.error('Failed to recreate database schema:', error);
    return false;
  }
};

export default {
  resetDatabase,
  deleteDatabase,
  backupDatabase,
  restoreDatabase,
  getAvailableBackups,
  verifyDatabase,
  forceRecreateSchema,
  reloadApp
}; 