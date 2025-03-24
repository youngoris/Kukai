// Mock for expo-file-system
jest.mock('expo-file-system', () => ({
  __esModule: true,
  documentDirectory: 'file:///mock-document-directory/',
  cacheDirectory: 'file:///mock-cache-directory/',
  readAsStringAsync: jest.fn(() => Promise.resolve('{"tables":[{"name":"tasks","rows":[]}],"metadata":{"appVersion":"1.0.0"}}')),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 1024, isDirectory: false, modificationTime: 1600000000 })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  readDirectoryAsync: jest.fn(() => Promise.resolve(['backup1.json', 'backup2.json'])),
  copyAsync: jest.fn(() => Promise.resolve()),
  moveAsync: jest.fn(() => Promise.resolve()),
  downloadAsync: jest.fn(() => Promise.resolve({ md5: 'mock-md5', uri: 'file://mock-uri' })),
}));

// Mock for expo-sharing
jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mock for expo-document-picker
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(() => Promise.resolve({
    type: 'success',
    uri: 'file:///mock-uri/backup.json',
    name: 'backup.json',
    size: 1024,
  })),
}));

// Mock for expo-application
jest.mock('expo-application', () => ({
  __esModule: true,
  applicationName: 'MockApp',
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

// Mock for expo-network
jest.mock('expo-network', () => ({
  __esModule: true,
  getNetworkStateAsync: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

// Mock for expo-device
jest.mock('expo-device', () => ({
  __esModule: true,
  brand: 'Mock',
  manufacturer: 'Mock Inc.',
  modelName: 'Mock Device',
  osName: 'MockOS',
  osVersion: '10.0.0',
  deviceName: 'Mock Device',
  DeviceType: { PHONE: 1 },
  deviceType: 1,
}));

// Mock for Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn(obj => obj.ios),
  },
}));

// Mock for ConfigService
jest.mock('../../services/ConfigService', () => ({
  __esModule: true,
  default: {
    getConfig: jest.fn(() => ({
      backup_dir: 'backups/',
      cloud_backup_enabled: false,
    })),
  },
}));

// Mock for StorageService
jest.mock('../../services/storage/StorageService', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key) => {
      if (key === 'backupConfig') {
        return Promise.resolve(JSON.stringify({
          auto_backup: true,
          backup_frequency: 'daily',
          last_backup_time: null,
          keep_count: 5,
          keep_manual_count: 10,
        }));
      } else if (key === 'backupStats') {
        return Promise.resolve(JSON.stringify({
          total_backups_created: 5,
          total_backups_restored: 1,
          last_backup_date: new Date().toISOString(),
          backup_history: [],
        }));
      }
      return Promise.resolve(null);
    }),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock for DatabaseService
jest.mock('../../services/DatabaseService', () => {
  const mockDb = {
    transaction: jest.fn((callback) => {
      const tx = {
        executeSql: jest.fn((query, args, success) => {
          if (query.includes('SELECT * FROM')) {
            // Return mock data for any SELECT query
            success(tx, { 
              rows: { 
                _array: [
                  { id: 1, title: 'Task 1' },
                  { id: 2, title: 'Task 2' },
                ], 
                length: 2 
              } 
            });
          } else {
            // Default success response
            success(tx, { rows: { _array: [], length: 0 } });
          }
          return { rowsAffected: 1, insertId: 1 };
        }),
      };
      callback(tx);
      return Promise.resolve();
    }),
  };

  return {
    __esModule: true,
    default: {
      getDBInstance: jest.fn(() => mockDb),
      getTableNames: jest.fn(() => Promise.resolve(['tasks', 'meditation_sessions', 'journal_entries'])),
      executeQuery: jest.fn((db, query, params) => {
        if (query.includes('SELECT * FROM')) {
          return Promise.resolve({ 
            rows: { 
              _array: [
                { id: 1, title: 'Task 1' },
                { id: 2, title: 'Task 2' },
              ], 
              length: 2 
            } 
          });
        }
        return Promise.resolve({ rows: { _array: [], length: 0 } });
      }),
    },
  };
});

// Mock for actual DatabaseBackupService methods
// This simulates the real implementation of key methods
jest.mock('../../services/DatabaseBackupService', () => {
  const original = jest.requireActual('../../services/DatabaseBackupService');
  
  return {
    __esModule: true,
    default: {
      backupConfig: {
        auto_backup: true,
        backup_frequency: 'daily',
        last_backup_time: null,
        keep_count: 5,
        keep_manual_count: 10,
        keep_migration_count: 3,
        backup_include_media: false,
      },
      backupStats: {
        total_backups_created: 5,
        total_backups_restored: 1,
        last_backup_date: new Date().toISOString(),
        backup_history: [],
      },
      backupDir: 'file:///mock-document-directory/backups/',
      initialize: jest.fn(() => Promise.resolve({ success: true })),
      ensureBackupDirectory: jest.fn(() => Promise.resolve({ success: true })),
      loadBackupConfig: jest.fn(() => Promise.resolve({ success: true })),
      loadBackupStats: jest.fn(() => Promise.resolve({ success: true })),
      getBackupsList: jest.fn(() => Promise.resolve({ 
        success: true, 
        backups: [
          { name: 'backup1.json', size: 1024, created: 1600000000000 },
          { name: 'backup2.json', size: 2048, created: 1600000000000 },
        ]
      })),
      createBackup: jest.fn(() => Promise.resolve({ success: true, backupPath: 'file:///mock-document-directory/backups/manual_backup.json' })),
      restoreBackup: jest.fn(() => Promise.resolve({ success: true })),
      validateBackup: jest.fn(() => Promise.resolve({ valid: true })),
      restoreFromBackupData: jest.fn(() => Promise.resolve({ success: true })),
      collectBackupData: jest.fn(() => Promise.resolve({ tables: [], metadata: {} })),
      deleteBackup: jest.fn(() => Promise.resolve({ success: true })),
      categorizeBackups: jest.fn(() => Promise.resolve({ 
        success: true, 
        categories: {
          auto: [{ name: 'auto_backup.json', size: 1024, created: 1600000000000 }],
          manual: [{ name: 'manual_backup.json', size: 2048, created: 1600000000000 }],
        },
        totalSizes: { auto: 1024, manual: 2048 },
        totalBackups: 2
      })),
      applyBackupRetentionPolicy: jest.fn(() => Promise.resolve({ 
        success: true, 
        deleted: ['old_backup.json'],
        message: 'Deleted 1 backups according to retention policy'
      })),
      checkAutomaticBackup: jest.fn(() => Promise.resolve({ 
        needed: true, 
        performed: true, 
        result: { success: true } 
      })),
      getBackupDiskUsage: jest.fn(() => Promise.resolve({ 
        success: true, 
        totalSize: 6000, 
        totalBackups: 3,
        formattedTotalSize: '5.86 KB'
      })),
      shareBackup: jest.fn(() => Promise.resolve({ success: true })),
      importBackup: jest.fn(() => Promise.resolve({ success: true })),
      getBackupStats: jest.fn(() => ({
        total_backups_created: 5,
        total_backups_restored: 1,
        last_backup_date: new Date().toISOString(),
        backup_history: [],
      })),
    },
  };
});

// Mock for console
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}; 