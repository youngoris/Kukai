/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import * as FileSystem from 'expo-file-system';
import storageService from "./storage/StorageService";
import databaseService from './DatabaseService';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import configService from './ConfigService';

// Tables to backup
const TABLES_TO_BACKUP = [
  'meditation_sessions',
  'tasks',
  'categories',
  'journal_entries',
  'journal_templates',
  'focus_sessions'
];

// Backup metadata keys
const LAST_BACKUP_DATE_KEY = '@lastBackupDate';
const BACKUP_COUNT_KEY = '@backupCount';

class DatabaseBackupService {
  constructor() {
    this.backupDir = FileSystem.documentDirectory + 'backups/';
    this.backupConfig = {
      enabled: false,
      frequency: 'weekly', // daily, weekly, monthly
      keep_count: 5, // Number of backups to keep
      auto_backup_on_app_start: true
    };
  }

  /**
   * Initialize the backup service
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      // Load backup configuration
      await this.loadBackupConfig();
      
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize backup service:', error);
      return { success: false, error };
    }
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.backupDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.backupDir, { intermediates: true });
        console.log('Created backup directory');
      }
      
      return true;
    } catch (error) {
      console.error('Error creating backup directory:', error);
      throw error;
    }
  }

  /**
   * Load backup configuration from ConfigService
   */
  async loadBackupConfig() {
    try {
      const savedConfig = await configService.getItem('backup_config');
      if (savedConfig) {
        this.backupConfig = { ...this.backupConfig, ...savedConfig };
      } else {
        // Save default config if none exists
        await configService.setItem('backup_config', this.backupConfig);
      }
    } catch (error) {
      console.error('Error loading backup config:', error);
    }
  }

  /**
   * Save backup configuration
   */
  async saveBackupConfig(config) {
    try {
      this.backupConfig = { ...this.backupConfig, ...config };
      await configService.setItem('backup_config', this.backupConfig);
      
      // If backup is enabled, schedule next backup
      if (this.backupConfig.enabled) {
        await this.scheduleNextBackup();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error saving backup config:', error);
      return { success: false, error };
    }
  }

  /**
   * Schedule next automatic backup
   */
  async scheduleNextBackup() {
    const nextBackupDate = this.calculateNextBackupDate();
    await configService.setItem('next_automatic_backup', nextBackupDate.toISOString());
    console.log(`Next backup scheduled for: ${nextBackupDate.toISOString()}`);
    return nextBackupDate;
  }

  /**
   * Calculate next backup date based on frequency
   */
  calculateNextBackupDate() {
    const now = new Date();
    let nextDate = new Date();
    
    switch (this.backupConfig.frequency) {
      case 'daily':
        nextDate.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(now.getMonth() + 1);
        break;
      default:
        nextDate.setDate(now.getDate() + 7); // Default to weekly
    }
    
    return nextDate;
  }

  /**
   * Check if automatic backup is needed and perform it if so
   */
  async checkAutomaticBackup() {
    try {
      // If automatic backup is disabled, do nothing
      if (!this.backupConfig.enabled) {
        return { needed: false };
      }
      
      // Check if next backup date is set
      const nextBackupDateStr = await configService.getItem('next_automatic_backup');
      if (!nextBackupDateStr) {
        // If not set, schedule one and return
        await this.scheduleNextBackup();
        return { needed: false };
      }
      
      // Check if it's time for backup
      const nextBackupDate = new Date(nextBackupDateStr);
      const now = new Date();
      
      if (now >= nextBackupDate) {
        console.log('Automatic backup needed');
        
        // Create automatic backup
        const backupName = `auto_${now.toISOString().split('T')[0]}`;
        const backupResult = await this.createBackup(backupName);
        
        // Schedule next backup
        await this.scheduleNextBackup();
        
        // Clean up old backups
        await this.cleanupOldBackups();
        
        return { 
          needed: true, 
          performed: true, 
          result: backupResult 
        };
      }
      
      return { 
        needed: false, 
        nextBackup: nextBackupDate 
      };
    } catch (error) {
      console.error('Error checking automatic backup:', error);
      return { 
        needed: false, 
        error 
      };
    }
  }

  /**
   * Clean up old backups, keeping only the specified number
   */
  async cleanupOldBackups() {
    try {
      // Get list of backups
      const backupsList = await this.getBackupsList();
      
      if (!backupsList.success) {
        return { success: false, error: backupsList.error };
      }
      
      // Filter automatic backups
      const autoBackups = backupsList.backups.filter(
        backup => backup.name.startsWith('auto_')
      );
      
      // If we have more than keep_count backups, delete oldest ones
      if (autoBackups.length > this.backupConfig.keep_count) {
        // Sort by date (newest first)
        autoBackups.sort((a, b) => b.created - a.created);
        
        // Get backups to delete
        const backupsToDelete = autoBackups.slice(this.backupConfig.keep_count);
        
        // Delete each backup
        for (const backup of backupsToDelete) {
          try {
            await FileSystem.deleteAsync(backup.path);
            console.log(`Deleted old backup: ${backup.name}`);
          } catch (error) {
            console.error(`Error deleting backup ${backup.name}:`, error);
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
      return { success: false, error };
    }
  }

  /**
   * Get list of available backups
   */
  async getBackupsList() {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      // Get files in backup directory
      const fileList = await FileSystem.readDirectoryAsync(this.backupDir);
      
      // Filter only .json files
      const backupFiles = fileList.filter(file => file.endsWith('.json'));
      
      // Get info for each backup
      const backups = await Promise.all(
        backupFiles.map(async (fileName) => {
          try {
            const fileInfo = await FileSystem.getInfoAsync(this.backupDir + fileName);
            
            // Parse creation date from file name if possible
            let created;
            if (fileName.startsWith('auto_') || fileName.startsWith('backup_')) {
              const dateStr = fileName.split('_')[1].split('.')[0];
              created = new Date(dateStr);
              if (isNaN(created.getTime())) {
                created = new Date(fileInfo.modificationTime * 1000);
              }
            } else {
              created = new Date(fileInfo.modificationTime * 1000);
            }
            
            return {
              name: fileName.replace('.json', ''),
              path: this.backupDir + fileName,
              size: fileInfo.size,
              created
            };
          } catch (error) {
            console.error(`Error getting info for ${fileName}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null entries and sort by date (newest first)
      const validBackups = backups.filter(Boolean).sort((a, b) => b.created - a.created);
      
      return { success: true, backups: validBackups };
    } catch (error) {
      console.error('Error getting backups list:', error);
      return { success: false, error };
    }
  }

  /**
   * Create a database backup
   */
  async createBackup(name = null) {
    try {
      // Generate backup name if not provided
      const backupName = name || `backup_${new Date().toISOString().split('T')[0]}`;
      const backupPath = this.backupDir + backupName + '.json';
      
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      // Get database version
      const dbVersion = await databaseService.getDbVersion();
      
      // Get all tables
      const tables = await databaseService.getAllTableNames();
      
      // Get data from each table
      const backupData = {
        version: dbVersion,
        timestamp: new Date().toISOString(),
        tables: {}
      };
      
      for (const table of tables) {
        try {
          const tableData = await databaseService.query(`SELECT * FROM ${table}`);
          backupData.tables[table] = tableData;
        } catch (error) {
          console.error(`Error backing up table ${table}:`, error);
          backupData.tables[table] = { error: error.message };
        }
      }
      
      // Write backup to file
      await FileSystem.writeAsStringAsync(
        backupPath,
        JSON.stringify(backupData, null, 2)
      );
      
      console.log(`Backup created: ${backupName}`);
      
      return { 
        success: true, 
        path: backupPath, 
        name: backupName,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error };
    }
  }

  /**
   * Restore a database backup
   */
  async restoreBackup(backupNameOrPath) {
    try {
      // Determine backup path
      let backupPath = backupNameOrPath;
      if (!backupPath.includes('/')) {
        backupPath = this.backupDir + backupNameOrPath + 
          (backupNameOrPath.endsWith('.json') ? '' : '.json');
      }
      
      // Check if backup exists
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        return { 
          success: false, 
          error: `Backup file does not exist: ${backupPath}` 
        };
      }
      
      // Read backup file
      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);
      
      // Create a pre-restore backup just in case
      const preRestoreBackup = await this.createBackup('pre_restore_' + new Date().toISOString().split('T')[0]);
      
      // Close database connection
      await databaseService.closeDatabase();
      
      // Delete the database file to avoid any issues with schema differences
      try {
        const dbPath = FileSystem.documentDirectory + 'SQLite/kukai.db';
        const dbInfo = await FileSystem.getInfoAsync(dbPath);
        if (dbInfo.exists) {
          await FileSystem.deleteAsync(dbPath);
        }
      } catch (error) {
        console.error('Error deleting database file:', error);
        // Continue anyway as this might fail on some platforms
      }
      
      // Reopen database to recreate it
      await databaseService.initialize();
      
      // Restore data to each table
      for (const [tableName, tableData] of Object.entries(backupData.tables)) {
        if (Array.isArray(tableData) && tableData.length > 0) {
          try {
            // Delete existing data
            await databaseService.query(`DELETE FROM ${tableName}`);
            
            // Insert each row
            for (const row of tableData) {
              await databaseService.create(tableName, row);
            }
            
            console.log(`Restored table ${tableName}: ${tableData.length} rows`);
          } catch (error) {
            console.error(`Error restoring table ${tableName}:`, error);
          }
        }
      }
      
      // Record restore information
      await configService.setItem('last_restore', {
        timestamp: new Date().toISOString(),
        backup: backupNameOrPath,
        version: backupData.version
      });
      
      return { 
        success: true, 
        message: 'Backup restored successfully',
        tablesRestored: Object.keys(backupData.tables).length,
        version: backupData.version,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('Error restoring backup:', error);
      
      // Try to reinitialize database
      try {
        await databaseService.initialize();
      } catch (reInitError) {
        console.error('Failed to reinitialize database after restore error:', reInitError);
      }
      
      return { success: false, error };
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupNameOrPath) {
    try {
      // Determine backup path
      let backupPath = backupNameOrPath;
      if (!backupPath.includes('/')) {
        backupPath = this.backupDir + backupNameOrPath + 
          (backupNameOrPath.endsWith('.json') ? '' : '.json');
      }
      
      // Check if backup exists
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        return { 
          success: false, 
          error: `Backup file does not exist: ${backupPath}` 
        };
      }
      
      // Delete backup file
      await FileSystem.deleteAsync(backupPath);
      
      return { 
        success: true, 
        message: `Backup deleted: ${backupNameOrPath}` 
      };
    } catch (error) {
      console.error('Error deleting backup:', error);
      return { success: false, error };
    }
  }
}

// Create singleton instance
const databaseBackupService = new DatabaseBackupService();
export default databaseBackupService; 