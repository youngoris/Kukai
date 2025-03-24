// Mock for expo-sqlite
jest.mock('expo-sqlite', () => ({
  __esModule: true,
  openDatabase: jest.fn(() => ({
    transaction: jest.fn((callback) => {
      const tx = {
        executeSql: jest.fn((query, args, success, error) => {
          if (query.includes('SELECT * FROM db_migrations')) {
            // Return empty array for migration table query
            success(tx, { rows: { _array: [], length: 0 } });
          } else if (query.includes('CREATE TABLE IF NOT EXISTS db_migrations')) {
            // Return success for create migration table
            success(tx, { rowsAffected: 1 });
          } else if (query.includes('INSERT INTO db_migrations')) {
            // Return success for insert migration
            success(tx, { rowsAffected: 1, insertId: 1 });
          } else if (query.includes('SELECT name FROM sqlite_master')) {
            // Return test tables for table list query
            success(tx, { 
              rows: { 
                _array: [
                  { name: 'tasks' },
                  { name: 'settings' },
                  { name: 'db_migrations' }
                ], 
                length: 3 
              } 
            });
          } else {
            // Default success response
            success(tx, { rows: { _array: [], length: 0 } });
          }
          return { rowsAffected: 1 };
        }),
      };
      callback(tx);
    }),
    exec: jest.fn((queries, readOnly, callback) => {
      callback(null, []);
    }),
  })),
}));

// Mock DatabaseMigrationService class
jest.mock('../../services/DatabaseMigrationService', () => {
  // Define mock implementation of DatabaseMigrationService
  const MockDatabaseMigrationService = jest.fn().mockImplementation(() => {
    return {
      ensureMigrationTable: jest.fn(() => Promise.resolve({ success: true })),
      getCurrentVersion: jest.fn(() => Promise.resolve(0)),
      runMigration: jest.fn(() => Promise.resolve({ success: true })),
      getTableInfo: jest.fn(() => Promise.resolve(['tasks', 'settings', 'db_migrations'])),
      backupBeforeMigration: jest.fn(() => Promise.resolve({ 
        success: true, 
        backupPath: 'file:///mock-document-directory/backups/pre_migration_backup.json'
      })),
      runAllMigrations: jest.fn(() => Promise.resolve({ 
        success: true, 
        migrationsRun: 2,
        currentVersion: 2
      })),
      processMigrations: jest.fn(() => Promise.resolve({ 
        success: true, 
        dbVersion: 2
      })),
      rollbackMigration: jest.fn(() => Promise.resolve({ success: true })),
      migrations: [
        {
          version: 1,
          name: 'Create tasks table',
          up: jest.fn(),
          down: jest.fn()
        },
        {
          version: 2,
          name: 'Add status column to tasks',
          up: jest.fn(),
          down: jest.fn()
        }
      ]
    };
  });

  return {
    __esModule: true,
    DatabaseMigrationService: MockDatabaseMigrationService
  };
});

// Mock for DatabaseBackupService
jest.mock('../../services/DatabaseBackupService', () => ({
  __esModule: true,
  default: {
    createBackup: jest.fn(() => Promise.resolve({ 
      success: true, 
      backupPath: 'file:///mock-document-directory/backups/pre_migration_backup.json' 
    })),
    restoreBackup: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

// Mock for DatabaseService
jest.mock('../../services/DatabaseService', () => ({
  __esModule: true,
  default: {
    getDBInstance: jest.fn(() => ({
      transaction: jest.fn((callback) => {
        const tx = {
          executeSql: jest.fn((query, args, success) => {
            success(tx, { rows: { _array: [], length: 0 } });
            return { rowsAffected: 0, insertId: 1 };
          }),
        };
        callback(tx);
      }),
    })),
    getCurrentDBPath: jest.fn(() => 'file:///mock-db-path/database.db'),
  },
}));

// Mock for FileSystem
jest.mock('expo-file-system', () => ({
  __esModule: true,
  documentDirectory: 'file:///mock-document-directory/',
  copyAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
}));

// Mock for console
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}; 