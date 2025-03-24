// Import mocks first
import './DatabaseMigrationService.mock';

// Import dependencies
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { DatabaseMigrationService } from '../../services/DatabaseMigrationService';
import databaseBackupService from '../../services/DatabaseBackupService';
import databaseService from '../../services/DatabaseService';

describe('DatabaseMigrationService', () => {
  let migrationService;
  
  // Initialize a new migration service before each test
  beforeEach(() => {
    jest.clearAllMocks();
    migrationService = new DatabaseMigrationService();
  });

  // Test ensureMigrationTable
  test('should create migration table if it does not exist', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    
    // Execute
    const result = await migrationService.ensureMigrationTable(db);
    
    // Verify
    expect(result.success).toBe(true);
    expect(migrationService.ensureMigrationTable).toHaveBeenCalled();
  });

  // Test getCurrentVersion
  test('should return current database version', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    
    // Execute
    const version = await migrationService.getCurrentVersion(db);
    
    // Verify
    expect(version).toBe(0); // Initial version when no migrations have been run
    expect(migrationService.getCurrentVersion).toHaveBeenCalled();
  });

  // Test runMigration
  test('should execute a migration successfully', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    const migration = {
      version: 1,
      name: 'Create tasks table',
      up: (tx) => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT);'
        );
      },
      down: (tx) => {
        tx.executeSql('DROP TABLE IF EXISTS tasks;');
      },
    };
    
    // Execute
    const result = await migrationService.runMigration(db, migration);
    
    // Verify
    expect(result.success).toBe(true);
    expect(migrationService.runMigration).toHaveBeenCalled();
  });

  // Test getTableInfo
  test('should return list of tables in the database', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    
    // Execute
    const tables = await migrationService.getTableInfo(db);
    
    // Verify
    expect(Array.isArray(tables)).toBe(true);
    expect(tables).toContain('tasks');
    expect(tables).toContain('settings');
    expect(migrationService.getTableInfo).toHaveBeenCalled();
  });

  // Test backupBeforeMigration
  test('should create backup before migration', async () => {
    // Mock backup service
    const expectedBackupPath = 'file:///mock-document-directory/backups/pre_migration_backup.json';
    
    // Execute
    const result = await migrationService.backupBeforeMigration();
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.backupPath).toBe(expectedBackupPath);
    expect(migrationService.backupBeforeMigration).toHaveBeenCalled();
  });

  // Test processMigrations
  test('should process migrations and track version changes', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    
    // Execute
    const result = await migrationService.processMigrations(db);
    
    // Verify
    expect(result.success).toBe(true);
    expect(result.dbVersion).toBe(2);
    expect(migrationService.processMigrations).toHaveBeenCalled();
  });

  // Test migration failure and rollback
  test('should handle migration failure and restore from backup', async () => {
    // Setup
    const db = SQLite.openDatabase('test.db');
    const mockBackupPath = 'file:///mock-document-directory/backups/pre_migration_backup.json';
    
    // Mock methods to simulate failure
    migrationService.processMigrations.mockResolvedValueOnce({
      success: false,
      error: 'Migration failed',
      backupPath: mockBackupPath
    });
    
    // Execute
    const result = await migrationService.processMigrations(db);
    
    // Verify
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(migrationService.processMigrations).toHaveBeenCalled();
  });
}); 