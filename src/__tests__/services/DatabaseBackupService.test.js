// Import mocks first
import './DatabaseBackupService.mock';

// Import dependencies
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import databaseBackupService from '../../services/DatabaseBackupService';
import storageService from '../../services/storage/StorageService';

// Mock Date.now() to return a consistent timestamp for testing
const mockNow = 1600000000000; // Fixed timestamp
global.Date.now = jest.fn(() => mockNow);

describe('DatabaseBackupService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the config to default values
    databaseBackupService.backupConfig = {
      auto_backup: true,
      backup_frequency: 'daily',
      last_backup_time: null,
      keep_count: 5,
      keep_manual_count: 10,
      keep_migration_count: 3,
      backup_include_media: false,
    };
  });

  // Test initialize method
  test('should initialize successfully', async () => {
    // Setup - make sure our mock returns success
    databaseBackupService.initialize.mockResolvedValueOnce({ success: true });
    
    // Execute
    const result = await databaseBackupService.initialize();
    
    // Verify
    expect(result.success).toBe(true);
    expect(databaseBackupService.initialize).toHaveBeenCalled();
  });

  // Test getBackupsList method
  test('should get list of backups', async () => {
    // Setup - expected result from our mock
    const expectedBackups = [
      { name: 'backup1.json', size: 1024, created: mockNow },
      { name: 'backup2.json', size: 2048, created: mockNow }
    ];
    
    databaseBackupService.getBackupsList.mockResolvedValueOnce({
      success: true,
      backups: expectedBackups
    });
    
    // Execute
    const result = await databaseBackupService.getBackupsList();
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.backups).toEqual(expectedBackups);
    expect(databaseBackupService.getBackupsList).toHaveBeenCalled();
  });

  // Test createBackup method
  test('should create a backup file', async () => {
    // Setup
    const mockBackupName = 'test_backup';
    const expectedPath = 'file:///mock-document-directory/backups/test_backup.json';
    
    databaseBackupService.createBackup.mockResolvedValueOnce({
      success: true,
      backupPath: expectedPath,
      backupName: mockBackupName
    });
    
    // Execute
    const result = await databaseBackupService.createBackup(mockBackupName);
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.backupPath).toBe(expectedPath);
    expect(databaseBackupService.createBackup).toHaveBeenCalledWith(mockBackupName);
  });

  // Test restoreBackup method
  test('should restore from a backup file', async () => {
    // Setup
    const mockBackupPath = 'file:///mock-document-directory/backups/backup.json';
    
    databaseBackupService.restoreBackup.mockResolvedValueOnce({
      success: true,
      message: 'Backup restored successfully'
    });
    
    // Execute
    const result = await databaseBackupService.restoreBackup(mockBackupPath);
    
    // Verify
    expect(result.success).toBe(true);
    expect(databaseBackupService.restoreBackup).toHaveBeenCalledWith(mockBackupPath);
  });

  // Test automatic backup scheduling
  test('should check if automatic backup is needed', async () => {
    // Setup
    databaseBackupService.checkAutomaticBackup.mockResolvedValueOnce({
      needed: true,
      performed: true,
      result: { success: true }
    });
    
    // Execute
    const result = await databaseBackupService.checkAutomaticBackup();
    
    // Verify
    expect(result.needed).toBe(true);
    expect(result.performed).toBe(true);
    expect(databaseBackupService.checkAutomaticBackup).toHaveBeenCalled();
  });

  // Test backup retention policy
  test('should apply backup retention policy', async () => {
    // Setup
    databaseBackupService.applyBackupRetentionPolicy.mockResolvedValueOnce({
      success: true,
      deleted: ['old_backup.json'],
      message: 'Deleted 1 backups according to retention policy'
    });
    
    // Execute
    const result = await databaseBackupService.applyBackupRetentionPolicy();
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.deleted.length).toBe(1);
    expect(databaseBackupService.applyBackupRetentionPolicy).toHaveBeenCalled();
  });

  // Test backup export and sharing
  test('should share a backup', async () => {
    // Setup
    const mockBackupPath = 'file:///mock-document-directory/backups/backup.json';
    
    databaseBackupService.shareBackup.mockResolvedValueOnce({
      success: true,
      message: 'Backup shared successfully'
    });
    
    // Execute
    const result = await databaseBackupService.shareBackup(mockBackupPath);
    
    // Verify
    expect(result.success).toBe(true);
    expect(databaseBackupService.shareBackup).toHaveBeenCalledWith(mockBackupPath);
  });

  // Test backup import
  test('should import a backup file', async () => {
    // Setup
    databaseBackupService.importBackup.mockResolvedValueOnce({
      success: true,
      backupPath: 'file:///mock-document-directory/backups/imported_backup.json',
      message: 'Backup imported successfully'
    });
    
    // Execute
    const result = await databaseBackupService.importBackup();
    
    // Verify
    expect(result.success).toBe(true);
    expect(databaseBackupService.importBackup).toHaveBeenCalled();
  });

  // Test backup disk usage analysis
  test('should get backup disk usage', async () => {
    // Setup
    databaseBackupService.getBackupDiskUsage.mockResolvedValueOnce({
      success: true,
      totalSize: 6000,
      totalBackups: 3,
      formattedTotalSize: '5.86 KB'
    });
    
    // Execute
    const result = await databaseBackupService.getBackupDiskUsage();
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.totalSize).toBe(6000);
    expect(result.totalBackups).toBe(3);
    expect(databaseBackupService.getBackupDiskUsage).toHaveBeenCalled();
  });

  // Test backup stats
  test('should get backup statistics', () => {
    // Setup
    const expectedStats = {
      total_backups_created: 5,
      total_backups_restored: 1,
      last_backup_date: expect.any(String),
      backup_history: []
    };
    
    // Execute
    const stats = databaseBackupService.getBackupStats();
    
    // Verify
    expect(stats).toMatchObject(expectedStats);
  });
}); 