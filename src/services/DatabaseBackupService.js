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
import * as Application from 'expo-application';
import * as Network from 'expo-network';
import * as Device from 'expo-device';

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

// Backup types
const BACKUP_TYPES = {
  AUTO: 'auto',       // Automatic backup based on schedule
  MANUAL: 'manual',   // User-initiated backup
  PRE_UPDATE: 'pre_update', // Before app update
  PRE_RESTORE: 'pre_restore', // Before restoring another backup
  PRE_MIGRATION: 'pre_migration', // Before database migration
  DAILY: 'daily',     // Daily backup
  WEEKLY: 'weekly',   // Weekly backup
  MONTHLY: 'monthly', // Monthly backup
};

// Backup frequency options
const BACKUP_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  MANUAL_ONLY: 'manual_only'
};

/**
 * Enhanced DatabaseBackupService for automatic and manual backups
 * Supports various backup schedules, cloud backup, and advanced restore options
 */
class DatabaseBackupService {
  constructor() {
    this.backupDir = FileSystem.documentDirectory + 'backups/';
    this.cloudBackupDir = FileSystem.documentDirectory + 'cloud_backups/';
    this.tempBackupDir = FileSystem.cacheDirectory + 'temp_backups/';
    
    // Default backup configuration
    this.backupConfig = {
      enabled: false,
      frequency: BACKUP_FREQUENCIES.WEEKLY,
      keep_count: 10,               // Number of automatic backups to keep
      keep_manual_count: 20,        // Number of manual backups to keep
      keep_migration_count: 5,      // Number of pre-migration backups to keep
      auto_backup_on_app_start: true,
      auto_backup_before_update: true,
      enable_cloud_backup: false,
      backup_stats_tracking: true,
      compression_enabled: true,    // Enable backup compression
      include_app_metadata: true,   // Include app version, device info, etc.
      backup_notifications: true    // Show user notifications about backups
    };
    
    // Backup statistics
    this.backupStats = {
      total_backups_created: 0,
      total_backups_restored: 0,
      last_backup: null,
      last_restore: null,
      backup_success_rate: 100,
      average_backup_size: 0,
      largest_backup_size: 0,
      backup_history: []
    };
    
    // Backup operations tracking
    this.isBackupInProgress = false;
    this.isRestoreInProgress = false;
    this.currentBackupProgress = 0;
    this.currentRestoreProgress = 0;
    this.lastBackupError = null;
    this.lastRestoreError = null;
  }

  /**
   * Initialize the backup service
   */
  async initialize() {
    try {
      // Ensure backup directories exist
      await this.ensureBackupDirectory();
      await this.ensureCloudBackupDirectory();
      await this.ensureTempBackupDirectory();
      
      // Load backup configuration
      await this.loadBackupConfig();
      
      // Load backup statistics
      await this.loadBackupStats();
      
      // Calculate next backup date if automatic backups are enabled
      if (this.backupConfig.enabled) {
        await this.updateBackupSchedule();
      }
      
      console.log('Backup service initialized successfully');
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
   * Ensure cloud backup directory exists
   */
  async ensureCloudBackupDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cloudBackupDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cloudBackupDir, { intermediates: true });
        console.log('Created cloud backup directory');
      }
      
      return true;
    } catch (error) {
      console.error('Error creating cloud backup directory:', error);
      throw error;
    }
  }
  
  /**
   * Ensure temporary backup directory exists
   */
  async ensureTempBackupDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.tempBackupDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.tempBackupDir, { intermediates: true });
        console.log('Created temporary backup directory');
      }
      
      return true;
    } catch (error) {
      console.error('Error creating temporary backup directory:', error);
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
   * Load backup statistics from ConfigService
   */
  async loadBackupStats() {
    try {
      const savedStats = await configService.getItem('backup_stats');
      if (savedStats) {
        this.backupStats = { ...this.backupStats, ...savedStats };
      } else {
        // Save default stats if none exist
        await configService.setItem('backup_stats', this.backupStats);
      }
    } catch (error) {
      console.error('Error loading backup stats:', error);
    }
  }

  /**
   * Update backup statistics
   * @param {Object} stats - New stats to merge with existing stats
   */
  async updateBackupStats(stats) {
    try {
      this.backupStats = { ...this.backupStats, ...stats };
      await configService.setItem('backup_stats', this.backupStats);
      return true;
    } catch (error) {
      console.error('Error updating backup stats:', error);
      return false;
    }
  }
  
  /**
   * Add entry to backup history
   * @param {Object} entry - Backup history entry
   */
  async addBackupHistoryEntry(entry) {
    try {
      // Limit history to last 50 entries
      const history = [...this.backupStats.backup_history];
      history.unshift(entry);
      
      if (history.length > 50) {
        history.length = 50;
      }
      
      await this.updateBackupStats({
        backup_history: history
      });
      
      return true;
    } catch (error) {
      console.error('Error updating backup history:', error);
      return false;
    }
  }

  /**
   * Save backup configuration
   * @param {Object} config - New configuration to save
   */
  async saveBackupConfig(config) {
    try {
      this.backupConfig = { ...this.backupConfig, ...config };
      await configService.setItem('backup_config', this.backupConfig);
      
      // If backup is enabled, update backup schedule
      if (this.backupConfig.enabled) {
        await this.updateBackupSchedule();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error saving backup config:', error);
      return { success: false, error };
    }
  }

  /**
   * Update backup schedule based on current configuration
   */
  async updateBackupSchedule() {
    try {
      // If automatic backups are disabled, clear any scheduled backups
      if (!this.backupConfig.enabled || this.backupConfig.frequency === BACKUP_FREQUENCIES.MANUAL_ONLY) {
        await configService.removeItem('next_automatic_backup');
        return { success: true, message: 'Automatic backups disabled' };
      }
      
      // Schedule next backup based on frequency
      const nextBackupDate = this.calculateNextBackupDate();
      await configService.setItem('next_automatic_backup', nextBackupDate.toISOString());
      
      console.log(`Next backup scheduled for: ${nextBackupDate.toISOString()}`);
      return { success: true, nextBackup: nextBackupDate };
    } catch (error) {
      console.error('Error updating backup schedule:', error);
      return { success: false, error };
    }
  }

  /**
   * Calculate next backup date based on frequency
   * @returns {Date} Next backup date
   */
  calculateNextBackupDate() {
    const now = new Date();
    let nextDate = new Date();
    
    switch (this.backupConfig.frequency) {
      case BACKUP_FREQUENCIES.DAILY:
        // Schedule for next day at 3 AM
        nextDate.setDate(now.getDate() + 1);
        nextDate.setHours(3, 0, 0, 0);
        break;
      
      case BACKUP_FREQUENCIES.WEEKLY:
        // Schedule for next week, same day at 3 AM
        nextDate.setDate(now.getDate() + 7);
        nextDate.setHours(3, 0, 0, 0);
        break;
      
      case BACKUP_FREQUENCIES.MONTHLY:
        // Schedule for next month, same day at 3 AM
        nextDate.setMonth(now.getMonth() + 1);
        nextDate.setHours(3, 0, 0, 0);
        break;
      
      default:
        // Default to weekly backup at 3 AM
        nextDate.setDate(now.getDate() + 7);
        nextDate.setHours(3, 0, 0, 0);
    }
    
    return nextDate;
  }

  /**
   * Check if automatic backup is needed and perform it if so
   * @returns {Object} Result of backup check and operation if performed
   */
  async checkAutomaticBackup() {
    try {
      // If automatic backup is disabled, do nothing
      if (!this.backupConfig.enabled || this.backupConfig.frequency === BACKUP_FREQUENCIES.MANUAL_ONLY) {
        return { needed: false, reason: 'Automatic backups disabled' };
      }
      
      // Check if next backup date is set
      const nextBackupDateStr = await configService.getItem('next_automatic_backup');
      if (!nextBackupDateStr) {
        // If not set, schedule one and return
        await this.updateBackupSchedule();
        return { needed: false, reason: 'No backup scheduled, new schedule created' };
      }
      
      // Check if it's time for backup
      const nextBackupDate = new Date(nextBackupDateStr);
      const now = new Date();
      
      if (now >= nextBackupDate) {
        console.log('Automatic backup needed');
        
        // Determine backup type based on frequency
        let backupType = BACKUP_TYPES.AUTO;
        if (this.backupConfig.frequency === BACKUP_FREQUENCIES.DAILY) {
          backupType = BACKUP_TYPES.DAILY;
        } else if (this.backupConfig.frequency === BACKUP_FREQUENCIES.WEEKLY) {
          backupType = BACKUP_TYPES.WEEKLY;
        } else if (this.backupConfig.frequency === BACKUP_FREQUENCIES.MONTHLY) {
          backupType = BACKUP_TYPES.MONTHLY;
        }
        
        // Create automatic backup
        const backupPrefix = `${backupType}_`;
        const backupName = `${backupPrefix}${now.toISOString().split('T')[0]}`;
        
        // Perform the backup
        const backupResult = await this.createBackup(backupName, { type: backupType });
        
        // Schedule next backup
        await this.updateBackupSchedule();
        
        // Clean up old backups by type
        await this.cleanupOldBackups(backupType);
        
        // Update backup statistics
        if (backupResult.success) {
          await this.updateBackupStats({
            total_backups_created: this.backupStats.total_backups_created + 1,
            last_backup: {
              name: backupResult.name,
              timestamp: backupResult.timestamp,
              type: backupType,
              size: backupResult.size
            }
          });
          
          // Add to backup history
          await this.addBackupHistoryEntry({
            name: backupResult.name,
            timestamp: backupResult.timestamp,
            type: backupType,
            size: backupResult.size,
            success: true
          });
        } else {
          // Record backup failure
          await this.addBackupHistoryEntry({
            timestamp: new Date().toISOString(),
            type: backupType,
            success: false,
            error: backupResult.error
          });
          
          this.lastBackupError = backupResult.error;
        }
        
        return { 
          needed: true, 
          performed: true, 
          type: backupType,
          result: backupResult 
        };
      }
      
      return { 
        needed: false, 
        nextBackup: nextBackupDate,
        reason: 'Scheduled backup is in the future' 
      };
    } catch (error) {
      console.error('Error checking automatic backup:', error);
      this.lastBackupError = error.message;
      
      return { 
        needed: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old backups by type, keeping only the specified number
   * @param {String} backupType - Type of backup to clean up (optional, cleans all if not specified)
   */
  async cleanupOldBackups(backupType = null) {
    try {
      // Get list of backups
      const backupsList = await this.getBackupsList();
      
      if (!backupsList.success) {
        return { success: false, error: backupsList.error };
      }
      
      if (backupType) {
        // Clean up specific backup type
        await this.cleanupBackupsByType(backupsList.backups, backupType);
      } else {
        // Clean up all backup types
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.AUTO);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.MANUAL);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.PRE_MIGRATION);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.PRE_RESTORE);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.DAILY);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.WEEKLY);
        await this.cleanupBackupsByType(backupsList.backups, BACKUP_TYPES.MONTHLY);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Clean up backups of a specific type, keeping only the specified number
   * @param {Array} backups - List of backup objects
   * @param {String} backupType - Type of backup to clean up
   */
  async cleanupBackupsByType(backups, backupType) {
    try {
      // Determine prefix for the backup type
      const prefix = backupType + '_';
      
      // Filter backups of the specified type
      const typeBackups = backups.filter(
        backup => backup.name.startsWith(prefix)
      );
      
      // Determine how many to keep
      let keepCount = this.backupConfig.keep_count;
      
      if (backupType === BACKUP_TYPES.MANUAL) {
        keepCount = this.backupConfig.keep_manual_count;
      } else if (backupType === BACKUP_TYPES.PRE_MIGRATION) {
        keepCount = this.backupConfig.keep_migration_count;
      } else if (backupType === BACKUP_TYPES.DAILY) {
        keepCount = 7; // Keep a week of daily backups
      } else if (backupType === BACKUP_TYPES.WEEKLY) {
        keepCount = 4; // Keep a month of weekly backups
      } else if (backupType === BACKUP_TYPES.MONTHLY) {
        keepCount = 12; // Keep a year of monthly backups
      }
      
      // If we have more than keep_count backups, delete oldest ones
      if (typeBackups.length > keepCount) {
        // Sort by date (newest first)
        typeBackups.sort((a, b) => b.created - a.created);
        
        // Get backups to delete
        const backupsToDelete = typeBackups.slice(keepCount);
        
        // Delete each backup
        for (const backup of backupsToDelete) {
          try {
            await FileSystem.deleteAsync(backup.path);
            console.log(`Deleted old ${backupType} backup: ${backup.name}`);
          } catch (error) {
            console.error(`Error deleting backup ${backup.name}:`, error);
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error cleaning up ${backupType} backups:`, error);
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
   * @param {String} name - Optional name for the backup
   * @param {Object} options - Backup options
   * @returns {Object} Backup result
   */
  async createBackup(name = null, options = {}) {
    try {
      // If backup is already in progress, return
      if (this.isBackupInProgress) {
        return {
          success: false,
          error: 'Backup already in progress'
        };
      }
      
      this.isBackupInProgress = true;
      this.currentBackupProgress = 0;
      
      // Generate backup name if not provided
      const backupName = name || `backup_${new Date().toISOString().split('T')[0]}`;
      const backupType = options.type || BACKUP_TYPES.MANUAL;
      const backupPath = this.backupDir + backupName + '.json';
      
      // Ensure backup directory exists
      await this.ensureBackupDirectory();
      
      try {
        // Update progress
        this.currentBackupProgress = 10;
        
        // Get system information for metadata
        let appInfo = {};
        let deviceInfo = {};
        let networkInfo = {};
        
        if (this.backupConfig.include_app_metadata) {
          try {
            appInfo = {
              appName: Application.applicationName,
              appVersion: Application.nativeApplicationVersion,
              buildVersion: Application.nativeBuildVersion
            };
            
            deviceInfo = {
              brand: Device.brand,
              modelName: Device.modelName,
              osName: Device.osName,
              osVersion: Device.osVersion,
              deviceYearClass: await Device.getDeviceYearClassAsync()
            };
            
            networkInfo = {
              networkType: (await Network.getNetworkStateAsync()).type
            };
          } catch (metadataError) {
            console.warn('Error collecting metadata:', metadataError);
          }
        }
        
        // Update progress
        this.currentBackupProgress = 20;
        
        // Get database version
        const dbVersion = await databaseService.getDbVersion();
        
        // Get all tables
        const tables = await databaseService.getAllTableNames();
        
        // Update progress
        this.currentBackupProgress = 30;
        
        // Get data from each table
        const backupData = {
          version: dbVersion,
          timestamp: new Date().toISOString(),
          tables: {},
          metadata: {
            backupType,
            app: appInfo,
            device: deviceInfo,
            network: networkInfo
          }
        };
        
        // Calculate progress increment per table
        const progressPerTable = 60 / tables.length;
        
        // Get data from each table
        for (let i = 0; i < tables.length; i++) {
          const table = tables[i];
          try {
            // Skip migration tracking table
            if (table === 'db_migrations') {
              continue;
            }
            
            const tableData = await databaseService.query(`SELECT * FROM ${table}`);
            backupData.tables[table] = tableData;
            
            // Update progress
            this.currentBackupProgress = 30 + (i + 1) * progressPerTable;
          } catch (error) {
            console.error(`Error backing up table ${table}:`, error);
            backupData.tables[table] = { error: error.message };
          }
        }
        
        // Update progress
        this.currentBackupProgress = 90;
        
        // Add backup summary
        backupData.summary = {
          totalTables: Object.keys(backupData.tables).length,
          totalRecords: Object.values(backupData.tables).reduce((sum, table) => {
            return sum + (Array.isArray(table) ? table.length : 0);
          }, 0),
          dbVersion
        };
        
        // Write backup to file
        await FileSystem.writeAsStringAsync(
          backupPath,
          JSON.stringify(backupData, null, 2)
        );
        
        // Get file info to determine size
        const fileInfo = await FileSystem.getInfoAsync(backupPath);
        
        // Update progress
        this.currentBackupProgress = 100;
        
        console.log(`Backup created: ${backupName}, size: ${fileInfo.size} bytes`);
        
        // Update backup statistics
        const backupSize = fileInfo.size;
        const totalBackups = this.backupStats.total_backups_created + 1;
        const newAvgSize = ((this.backupStats.average_backup_size * (totalBackups - 1)) + backupSize) / totalBackups;
        const newLargestSize = Math.max(this.backupStats.largest_backup_size, backupSize);
        
        this.updateBackupStats({
          average_backup_size: newAvgSize,
          largest_backup_size: newLargestSize
        });
        
        // Reset tracking
        this.isBackupInProgress = false;
        
        return { 
          success: true, 
          path: backupPath, 
          name: backupName,
          timestamp: backupData.timestamp,
          size: fileInfo.size,
          summary: backupData.summary
        };
      } catch (error) {
        // Reset tracking on error
        this.isBackupInProgress = false;
        this.lastBackupError = error.message;
        throw error;
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Share backup file with user
   * @param {String} backupNameOrPath - Backup name or path
   */
  async shareBackup(backupNameOrPath) {
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
      
      // Check if sharing is available
      if (!(await Sharing.isAvailableAsync())) {
        return {
          success: false,
          error: 'Sharing is not available on this device'
        };
      }
      
      // Share the file
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/json',
        dialogTitle: 'Share Database Backup'
      });
      
      return {
        success: true,
        message: 'Backup shared successfully'
      };
    } catch (error) {
      console.error('Error sharing backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import backup from device storage
   */
  async importBackup() {
    try {
      // Pick a document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return {
          success: false,
          error: 'No file selected'
        };
      }
      
      const file = result.assets[0];
      
      // Copy file to backups directory
      const fileName = file.name || `imported_backup_${Date.now()}.json`;
      const newPath = this.backupDir + fileName;
      
      await FileSystem.copyAsync({
        from: file.uri,
        to: newPath
      });
      
      // Validate backup file
      const validationResult = await this.validateBackupFile(newPath);
      
      if (!validationResult.success) {
        // Delete invalid file
        await FileSystem.deleteAsync(newPath);
        
        return {
          success: false,
          error: `Invalid backup file: ${validationResult.error}`
        };
      }
      
      return {
        success: true,
        message: 'Backup imported successfully',
        path: newPath,
        name: fileName.replace('.json', ''),
        backup: validationResult.backup
      };
    } catch (error) {
      console.error('Error importing backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate backup file structure
   * @param {String} backupPath - Path to backup file
   */
  async validateBackupFile(backupPath) {
    try {
      // Read backup file
      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);
      
      // Check required fields
      if (!backupData.timestamp || !backupData.tables || typeof backupData.tables !== 'object') {
        return {
          success: false,
          error: 'Invalid backup format: missing required fields'
        };
      }
      
      // Check tables structure
      for (const tableName in backupData.tables) {
        const tableData = backupData.tables[tableName];
        if (!Array.isArray(tableData) && !tableData.error) {
          return {
            success: false,
            error: `Invalid table format for ${tableName}`
          };
        }
      }
      
      return {
        success: true,
        backup: backupData
      };
    } catch (error) {
      console.error('Error validating backup file:', error);
      return {
        success: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Restore a database backup with progress tracking
   * @param {String} backupNameOrPath - Backup name or path
   * @param {Object} options - Restore options
   */
  async restoreBackup(backupNameOrPath, options = {}) {
    try {
      // If restore is already in progress, return
      if (this.isRestoreInProgress) {
        return {
          success: false,
          error: 'Restore already in progress'
        };
      }
      
      this.isRestoreInProgress = true;
      this.currentRestoreProgress = 0;
      
      // Determine backup path
      let backupPath = backupNameOrPath;
      if (!backupPath.includes('/')) {
        backupPath = this.backupDir + backupNameOrPath + 
          (backupNameOrPath.endsWith('.json') ? '' : '.json');
      }
      
      // Check if backup exists
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        this.isRestoreInProgress = false;
        return { 
          success: false, 
          error: `Backup file does not exist: ${backupPath}` 
        };
      }
      
      try {
        // Update progress
        this.currentRestoreProgress = 10;
        
        // Read backup file
        const backupContent = await FileSystem.readAsStringAsync(backupPath);
        const backupData = JSON.parse(backupContent);
        
        // Update progress
        this.currentRestoreProgress = 20;
        
        // Create a pre-restore backup just in case, unless disabled
        if (options.skipPreRestoreBackup !== true) {
          await this.createBackup('pre_restore_' + new Date().toISOString().split('T')[0], {
            type: BACKUP_TYPES.PRE_RESTORE
          });
        }
        
        // Update progress
        this.currentRestoreProgress = 40;
        
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
        
        // Update progress
        this.currentRestoreProgress = 50;
        
        // Reopen database to recreate it
        await databaseService.initialize();
        
        // Update progress
        this.currentRestoreProgress = 60;
        
        // Calculate progress increment per table
        const tablesToRestore = Object.keys(backupData.tables).filter(
          tableName => Array.isArray(backupData.tables[tableName]) && 
                      backupData.tables[tableName].length > 0
        );
        
        const progressPerTable = 30 / Math.max(tablesToRestore.length, 1);
        
        // Restore data to each table
        let restoredCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < tablesToRestore.length; i++) {
          const tableName = tablesToRestore[i];
          const tableData = backupData.tables[tableName];
          
          try {
            // Delete existing data
            await databaseService.query(`DELETE FROM ${tableName}`);
            
            // Insert each row
            for (const row of tableData) {
              await databaseService.create(tableName, row);
            }
            
            restoredCount++;
            console.log(`Restored table ${tableName}: ${tableData.length} rows`);
          } catch (error) {
            errorCount++;
            console.error(`Error restoring table ${tableName}:`, error);
          }
          
          // Update progress
          this.currentRestoreProgress = 60 + (i + 1) * progressPerTable;
        }
        
        // Update progress
        this.currentRestoreProgress = 95;
        
        // Record restore information
        const restoreInfo = {
          timestamp: new Date().toISOString(),
          backup: backupNameOrPath,
          version: backupData.version,
          tablesRestored: restoredCount,
          errors: errorCount
        };
        
        await configService.setItem('last_restore', restoreInfo);
        
        // Update backup statistics
        await this.updateBackupStats({
          total_backups_restored: this.backupStats.total_backups_restored + 1,
          last_restore: restoreInfo
        });
        
        // Add to backup history
        await this.addBackupHistoryEntry({
          type: 'restore',
          timestamp: restoreInfo.timestamp,
          backupName: backupNameOrPath,
          success: true,
          tablesRestored: restoredCount,
          errors: errorCount
        });
        
        // Update progress
        this.currentRestoreProgress = 100;
        
        // Reset tracking
        this.isRestoreInProgress = false;
        
        return { 
          success: true, 
          message: 'Backup restored successfully',
          tablesRestored: restoredCount,
          errors: errorCount,
          version: backupData.version,
          timestamp: backupData.timestamp
        };
      } catch (error) {
        // Reset tracking on error
        this.isRestoreInProgress = false;
        this.lastRestoreError = error.message;
        
        // Add to backup history
        await this.addBackupHistoryEntry({
          type: 'restore',
          timestamp: new Date().toISOString(),
          backupName: backupNameOrPath,
          success: false,
          error: error.message
        });
        
        // Try to reinitialize database
        try {
          await databaseService.initialize();
        } catch (reInitError) {
          console.error('Failed to reinitialize database after restore error:', reInitError);
        }
        
        throw error;
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get backup progress information
   */
  getBackupProgress() {
    return {
      isBackupInProgress: this.isBackupInProgress,
      isRestoreInProgress: this.isRestoreInProgress,
      currentBackupProgress: this.currentBackupProgress,
      currentRestoreProgress: this.currentRestoreProgress,
      lastBackupError: this.lastBackupError,
      lastRestoreError: this.lastRestoreError
    };
  }
  
  /**
   * Get backup statistics and history
   */
  getBackupStats() {
    return {
      ...this.backupStats,
      config: this.backupConfig
    };
  }
  
  /**
   * Get next scheduled backup information
   */
  async getNextScheduledBackup() {
    try {
      if (!this.backupConfig.enabled ||
          this.backupConfig.frequency === BACKUP_FREQUENCIES.MANUAL_ONLY) {
        return {
          scheduled: false,
          reason: 'Automatic backups are disabled'
        };
      }
      
      const nextBackupDateStr = await configService.getItem('next_automatic_backup');
      if (!nextBackupDateStr) {
        // Schedule one and return it
        const result = await this.updateBackupSchedule();
        return {
          scheduled: true,
          nextBackup: result.nextBackup,
          frequency: this.backupConfig.frequency
        };
      }
      
      return {
        scheduled: true,
        nextBackup: new Date(nextBackupDateStr),
        frequency: this.backupConfig.frequency
      };
    } catch (error) {
      console.error('Error getting next scheduled backup:', error);
      return {
        scheduled: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a backup
   * @param {String} backupNameOrPath - Backup name or path
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
      
      // Update backup history to mark as deleted
      await this.addBackupHistoryEntry({
        type: 'delete',
        timestamp: new Date().toISOString(),
        backupName: backupNameOrPath.replace('.json', ''),
        success: true
      });
      
      return { 
        success: true, 
        message: `Backup deleted: ${backupNameOrPath}` 
      };
    } catch (error) {
      console.error('Error deleting backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Categorize backups by type
   * @returns {Object} Backups sorted by type
   */
  async categorizeBackups() {
    try {
      // Get all backups
      const backupsList = await this.getBackupsList();
      
      if (!backupsList.success) {
        return { success: false, error: backupsList.error };
      }
      
      // Initialize categories
      const categories = {
        auto: [],
        manual: [],
        daily: [],
        weekly: [],
        monthly: [],
        pre_restore: [],
        pre_migration: [],
        pre_update: [],
        imported: [],
        other: []
      };
      
      // Categorize each backup
      for (const backup of backupsList.backups) {
        const name = backup.name;
        
        if (name.startsWith(BACKUP_TYPES.AUTO + '_')) {
          categories.auto.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.MANUAL + '_')) {
          categories.manual.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.DAILY + '_')) {
          categories.daily.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.WEEKLY + '_')) {
          categories.weekly.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.MONTHLY + '_')) {
          categories.monthly.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.PRE_RESTORE + '_')) {
          categories.pre_restore.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.PRE_MIGRATION + '_')) {
          categories.pre_migration.push(backup);
        } else if (name.startsWith(BACKUP_TYPES.PRE_UPDATE + '_')) {
          categories.pre_update.push(backup);
        } else if (name.startsWith('imported_')) {
          categories.imported.push(backup);
        } else {
          categories.other.push(backup);
        }
      }
      
      // Sort each category by date (newest first)
      for (const category in categories) {
        categories[category].sort((a, b) => b.created - a.created);
      }
      
      // Calculate total sizes
      const totalSizes = {};
      for (const category in categories) {
        totalSizes[category] = categories[category].reduce((sum, backup) => sum + backup.size, 0);
      }
      
      return {
        success: true,
        categories,
        totalSizes,
        totalBackups: backupsList.backups.length
      };
    } catch (error) {
      console.error('Error categorizing backups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up backups based on policy
   * This applies all retention policies at once
   */
  async applyBackupRetentionPolicy() {
    try {
      // Get categorized backups
      const categorizedBackups = await this.categorizeBackups();
      
      if (!categorizedBackups.success) {
        return { success: false, error: categorizedBackups.error };
      }
      
      const { categories } = categorizedBackups;
      const deleted = [];
      
      // Apply retention policy for each category
      const policies = {
        auto: this.backupConfig.keep_count,
        manual: this.backupConfig.keep_manual_count,
        daily: 7,  // Keep last 7 days
        weekly: 4,  // Keep last 4 weeks
        monthly: 12,  // Keep last 12 months
        pre_restore: 3,  // Keep last 3 pre-restore backups
        pre_migration: this.backupConfig.keep_migration_count,
        pre_update: 3,  // Keep last 3 pre-update backups
        imported: 10  // Keep last 10 imported backups
      };
      
      for (const category in policies) {
        if (categories[category].length > policies[category]) {
          // Get backups to delete (oldest ones)
          const toDelete = categories[category].slice(policies[category]);
          
          // Delete each backup
          for (const backup of toDelete) {
            try {
              await this.deleteBackup(backup.name);
              deleted.push(backup.name);
            } catch (error) {
              console.error(`Error deleting backup ${backup.name}:`, error);
            }
          }
        }
      }
      
      return {
        success: true,
        message: `Deleted ${deleted.length} backups according to retention policy`,
        deleted
      };
    } catch (error) {
      console.error('Error applying backup retention policy:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get disk usage information for backups
   */
  async getBackupDiskUsage() {
    try {
      // Get categorized backups
      const categorizedBackups = await this.categorizeBackups();
      
      if (!categorizedBackups.success) {
        return { success: false, error: categorizedBackups.error };
      }
      
      const { totalSizes, totalBackups } = categorizedBackups;
      
      // Calculate total size
      const totalSize = Object.values(totalSizes).reduce((sum, size) => sum + size, 0);
      
      // Calculate percentage by category
      const percentages = {};
      for (const category in totalSizes) {
        percentages[category] = totalSize ? (totalSizes[category] / totalSize) * 100 : 0;
      }
      
      return {
        success: true,
        totalSize,
        totalBackups,
        sizeByCategory: totalSizes,
        percentageByCategory: percentages,
        formattedTotalSize: this.formatSize(totalSize)
      };
    } catch (error) {
      console.error('Error getting backup disk usage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format size in bytes to human-readable format
   * @param {Number} bytes - Size in bytes
   * @returns {String} Formatted size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create a backup naming strategy for different backup types
   * @param {String} backupType - Type of backup
   * @returns {String} Backup name
   */
  createBackupName(backupType = BACKUP_TYPES.MANUAL) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toISOString().split('T')[1].substr(0, 8).replace(/:/g, '-');
    
    return `${backupType}_${dateStr}_${timeStr}`;
  }
}

// Create singleton instance
const databaseBackupService = new DatabaseBackupService();
export default databaseBackupService; 