import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import databaseService from './DatabaseService';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

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
    // Create backup directory if it doesn't exist
    this.backupDir = `${FileSystem.documentDirectory}backups/`;
    this.ensureBackupDirExists();
  }

  async ensureBackupDirExists() {
    const dirInfo = await FileSystem.getInfoAsync(this.backupDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.backupDir, { intermediates: true });
      console.log('Created backup directory');
    }
  }

  // Create a backup of the database
  async createBackup(includeMetadata = true) {
    try {
      await this.ensureBackupDirExists();
      
      // Generate backup data
      const backupData = {
        tables: {},
        metadata: includeMetadata ? await this.getBackupMetadata() : null,
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0' // Should come from app config
      };
      
      // Export data from each table
      for (const table of TABLES_TO_BACKUP) {
        const tableData = await databaseService.query(`SELECT * FROM ${table}`);
        backupData.tables[table] = tableData;
      }
      
      // Create backup file
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupFileName = `kukai_backup_${timestamp}.json`;
      const backupPath = `${this.backupDir}${backupFileName}`;
      
      await FileSystem.writeAsStringAsync(
        backupPath,
        JSON.stringify(backupData, null, 2)
      );
      
      // Update backup metadata
      await this.updateBackupMetadata();
      
      console.log(`Backup created at ${backupPath}`);
      return { success: true, path: backupPath, fileName: backupFileName };
    } catch (error) {
      console.error('Failed to create backup:', error);
      return { success: false, error };
    }
  }
  
  // Share a backup file
  async shareBackup() {
    try {
      const result = await this.createBackup();
      if (!result.success) {
        throw new Error('Failed to create backup');
      }
      
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device');
      }
      
      await Sharing.shareAsync(result.path, {
        mimeType: 'application/json',
        dialogTitle: 'Share Kukai Backup',
        UTI: 'public.json'
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to share backup:', error);
      return { success: false, error };
    }
  }
  
  // List all available backups
  async listBackups() {
    try {
      await this.ensureBackupDirExists();
      
      const backupFiles = await FileSystem.readDirectoryAsync(this.backupDir);
      const backups = [];
      
      for (const file of backupFiles) {
        if (file.endsWith('.json')) {
          const fileInfo = await FileSystem.getInfoAsync(`${this.backupDir}${file}`);
          try {
            const content = await FileSystem.readAsStringAsync(`${this.backupDir}${file}`);
            const data = JSON.parse(content);
            
            backups.push({
              fileName: file,
              path: `${this.backupDir}${file}`,
              timestamp: data.timestamp,
              size: fileInfo.size,
              tableCount: Object.keys(data.tables).length,
              recordCounts: this.getRecordCounts(data)
            });
          } catch (e) {
            console.error(`Error parsing backup file ${file}:`, e);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return { success: true, backups };
    } catch (error) {
      console.error('Failed to list backups:', error);
      return { success: false, error };
    }
  }
  
  // Delete a backup file
  async deleteBackup(backupPath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        throw new Error('Backup file does not exist');
      }
      
      await FileSystem.deleteAsync(backupPath);
      console.log(`Deleted backup at ${backupPath}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return { success: false, error };
    }
  }
  
  // Restore from a backup file
  async restoreFromBackup(backupPath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(backupPath);
      if (!fileInfo.exists) {
        throw new Error('Backup file does not exist');
      }
      
      // Read and parse backup file
      const backupContent = await FileSystem.readAsStringAsync(backupPath);
      const backupData = JSON.parse(backupContent);
      
      // Validate backup data
      if (!backupData.tables || !backupData.timestamp) {
        throw new Error('Invalid backup file format');
      }
      
      // Reset the database before restoring
      await databaseService.resetDatabase();
      
      // Restore each table
      for (const [tableName, records] of Object.entries(backupData.tables)) {
        if (records && records.length > 0) {
          for (const record of records) {
            await databaseService.create(tableName, record);
          }
          console.log(`Restored ${records.length} records to ${tableName}`);
        }
      }
      
      console.log('Database restored successfully');
      return { success: true };
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return { success: false, error };
    }
  }
  
  // Import a backup file from device storage
  async importBackup() {
    try {
      // Pick a document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      
      // Copy file to backups directory
      const fileName = result.assets[0].name;
      const backupPath = `${this.backupDir}${fileName}`;
      
      await FileSystem.copyAsync({
        from: result.assets[0].uri,
        to: backupPath
      });
      
      console.log(`Imported backup to ${backupPath}`);
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('Failed to import backup:', error);
      return { success: false, error };
    }
  }
  
  // Schedule automatic backups
  async scheduleAutomaticBackups(intervalDays = 7) {
    // Store backup schedule settings
    await AsyncStorage.setItem('@backupScheduleInterval', intervalDays.toString());
    await AsyncStorage.setItem('@backupScheduleEnabled', 'true');
    await AsyncStorage.setItem('@backupScheduleLastCheck', new Date().toISOString());
    
    console.log(`Automatic backups scheduled every ${intervalDays} days`);
    return true;
  }
  
  // Check if automatic backup is needed
  async checkAutomaticBackup() {
    const enabled = await AsyncStorage.getItem('@backupScheduleEnabled');
    if (enabled !== 'true') {
      return false;
    }
    
    const lastCheckString = await AsyncStorage.getItem('@backupScheduleLastCheck');
    const intervalDaysString = await AsyncStorage.getItem('@backupScheduleInterval');
    
    if (!lastCheckString || !intervalDaysString) {
      return false;
    }
    
    const lastCheck = new Date(lastCheckString);
    const intervalDays = parseInt(intervalDaysString, 10);
    const now = new Date();
    
    // Calculate if it's time for a backup
    const daysSinceLastCheck = Math.floor((now - lastCheck) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastCheck >= intervalDays) {
      // Create a backup
      const result = await this.createBackup();
      
      // Update last check time
      await AsyncStorage.setItem('@backupScheduleLastCheck', now.toISOString());
      
      return result.success;
    }
    
    return false;
  }
  
  // Get backup metadata
  async getBackupMetadata() {
    const lastBackupDate = await AsyncStorage.getItem(LAST_BACKUP_DATE_KEY);
    const backupCount = await AsyncStorage.getItem(BACKUP_COUNT_KEY) || '0';
    
    return {
      lastBackupDate: lastBackupDate || null,
      backupCount: parseInt(backupCount, 10),
      device: Platform.OS,
      deviceVersion: Platform.Version
    };
  }
  
  // Update backup metadata
  async updateBackupMetadata() {
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_BACKUP_DATE_KEY, now);
    
    const count = await AsyncStorage.getItem(BACKUP_COUNT_KEY) || '0';
    await AsyncStorage.setItem(BACKUP_COUNT_KEY, (parseInt(count, 10) + 1).toString());
  }
  
  // Helper to calculate record counts for each table
  getRecordCounts(data) {
    const counts = {};
    for (const [table, records] of Object.entries(data.tables)) {
      counts[table] = records.length;
    }
    return counts;
  }
  
  // Clean up old backups, keeping only the most recent ones
  async cleanupOldBackups(keepCount = 5) {
    try {
      const { success, backups } = await this.listBackups();
      
      if (!success || !backups || backups.length <= keepCount) {
        return { success: true, deletedCount: 0 };
      }
      
      // Keep the most recent backups and delete the rest
      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of backupsToDelete) {
        const result = await this.deleteBackup(backup.path);
        if (result.success) {
          deletedCount++;
        }
      }
      
      return { success: true, deletedCount };
    } catch (error) {
      console.error('Failed to clean up old backups:', error);
      return { success: false, error };
    }
  }
}

export default new DatabaseBackupService(); 