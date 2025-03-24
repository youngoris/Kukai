// Database Services
import databaseService from './DatabaseService';
import { DatabaseMigrationService } from './DatabaseMigrationService';
import databaseBackupService from './DatabaseBackupService';
import databaseQueryOptimizer from './DatabaseQueryOptimizer';

// DAO Services
import { BaseDAO } from './dao/BaseDAO';
import { TaskDAO } from './dao/TaskDAO';
import { MeditationDAO } from './dao/MeditationDAO';
import { JournalDAO } from './dao/JournalDAO';
import { FocusDAO } from './dao/FocusDAO';

// Validation and Error Services
import validationService from './validation/ValidationService';
import { 
  DatabaseError, 
  DatabaseErrorCodes, 
  createDatabaseError, 
  handleDatabaseError 
} from './errors/DatabaseError';

// Create DAO instances
const taskDAO = new TaskDAO();
const meditationDAO = new MeditationDAO();
const journalDAO = new JournalDAO();
const focusDAO = new FocusDAO();

// Export all services
export {
  // Database core
  databaseService,
  DatabaseMigrationService,
  databaseBackupService,
  databaseQueryOptimizer,
  
  // DAOs
  BaseDAO,
  TaskDAO,
  MeditationDAO,
  JournalDAO,
  FocusDAO,
  
  // DAO instances
  taskDAO,
  meditationDAO,
  journalDAO,
  focusDAO,
  
  // Validation and errors
  validationService,
  DatabaseError,
  DatabaseErrorCodes,
  createDatabaseError,
  handleDatabaseError
}; 