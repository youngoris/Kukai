/**
 * Services index
 * Central export point for all services in the application
 */

// Database services
import databaseService from './DatabaseService';
import databaseQueryOptimizer from './DatabaseQueryOptimizer';
import databaseBackupService from './DatabaseBackupService';
import databaseMigrationService from './DatabaseMigrationService';

// Configuration services
import configService from './ConfigService';

// Storage services
import storageService from './storage/StorageService';

// External services
import googleDriveService from './GoogleDriveService';
import notificationService from './NotificationService';
import speechService from './SpeechService';

// Error handling
import { errorLogger } from './errorLogger';
import { 
  AppError, 
  AppErrorCodes, 
  createAppError, 
  handleAppError 
} from './errors/AppError';
import { 
  DatabaseError,
  DatabaseErrorCodes,
  createDatabaseError,
  handleDatabaseError
} from './errors/DatabaseError';

// Export services
export {
  // Database services
  databaseService,
  databaseQueryOptimizer,
  databaseBackupService,
  databaseMigrationService,
  
  // Configuration services
  configService,
  
  // Storage services
  storageService,
  
  // External services
  googleDriveService,
  notificationService,
  speechService,
  
  // Error handling
  errorLogger,
  AppError,
  AppErrorCodes,
  createAppError,
  handleAppError,
  DatabaseError,
  DatabaseErrorCodes,
  createDatabaseError,
  handleDatabaseError
}; 