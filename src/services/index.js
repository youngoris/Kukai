/**
 * Services index
 * Central export point for all services in the application
 */

// Database Core Services
import databaseService from './DatabaseService';
import { DatabaseMigrationService } from './DatabaseMigrationService';
import databaseBackupService from './DatabaseBackupService';
import databaseQueryOptimizer from './DatabaseQueryOptimizer';


// Validation and Error Services
import validationService from './validation/ValidationService';
import { 
  DatabaseError, 
  DatabaseErrorCodes, 
  createDatabaseError, 
  handleDatabaseError 
} from './errors/DatabaseError';

// Export all services
export {
  // Database core
  databaseService,
  DatabaseMigrationService,
  databaseBackupService,
  databaseQueryOptimizer,
  
  
  // Validation and errors
  validationService,
  DatabaseError,
  DatabaseErrorCodes,
  createDatabaseError,
  handleDatabaseError
}; 