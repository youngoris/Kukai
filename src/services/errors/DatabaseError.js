/**
 * DatabaseError - Custom error class for database operations
 */
export class DatabaseError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
  
  // Get a user-friendly message
  get userMessage() {
    switch (this.code) {
      case 'CONSTRAINT_ERROR':
        return 'Data violates constraints and cannot be saved.';
      case 'TABLE_NOT_EXISTS':
        return 'The requested data table does not exist.';
      case 'RECORD_NOT_FOUND':
        return 'The requested record was not found.';
      case 'VALIDATION_ERROR':
        return 'Data validation failed. Please check your input.';
      case 'CONNECTION_ERROR':
        return 'Database connection failed. Please try again later.';
      case 'MIGRATION_ERROR':
        return 'Database migration failed. Please contact support.';
      case 'TRANSACTION_ERROR':
        return 'Transaction processing failed. Please try again.';
      case 'INITIALIZATION_ERROR':
        return 'Database initialization failed. Please restart the application.';
      case 'BACKUP_ERROR':
        return 'Data backup failed. Please check storage space.';
      case 'RESTORE_ERROR':
        return 'Data restoration failed. The backup file may be corrupted.';
      case 'UNKNOWN_ERROR':
      default:
        return 'An unknown error occurred. Please try again.';
    }
  }
}

/**
 * DatabaseErrorCodes - Enum of database error codes
 */
export const DatabaseErrorCodes = {
  CONSTRAINT_ERROR: 'CONSTRAINT_ERROR',
  TABLE_NOT_EXISTS: 'TABLE_NOT_EXISTS',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  MIGRATION_ERROR: 'MIGRATION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  BACKUP_ERROR: 'BACKUP_ERROR',
  RESTORE_ERROR: 'RESTORE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * createDatabaseError - Factory function to create appropriate database error
 */
export function createDatabaseError(originalError, operation = 'unknown') {
  const errorMessage = originalError ? originalError.message : 'Unknown error';
  const errorDetails = {
    operation,
    timestamp: new Date().toISOString(),
    original: originalError
  };
  
  // Determine error code based on error message or type
  let errorCode = DatabaseErrorCodes.UNKNOWN_ERROR;
  
  if (originalError) {
    const errorString = originalError.toString().toLowerCase();
    
    if (errorString.includes('no such table')) {
      errorCode = DatabaseErrorCodes.TABLE_NOT_EXISTS;
    } else if (errorString.includes('constraint failed') || errorString.includes('unique constraint')) {
      errorCode = DatabaseErrorCodes.CONSTRAINT_ERROR;
    } else if (errorString.includes('not found') || errorString.includes('no rows')) {
      errorCode = DatabaseErrorCodes.RECORD_NOT_FOUND;
    } else if (errorString.includes('validation')) {
      errorCode = DatabaseErrorCodes.VALIDATION_ERROR;
    } else if (errorString.includes('connect') || errorString.includes('open database')) {
      errorCode = DatabaseErrorCodes.CONNECTION_ERROR;
    } else if (errorString.includes('migration')) {
      errorCode = DatabaseErrorCodes.MIGRATION_ERROR;
    } else if (errorString.includes('transaction')) {
      errorCode = DatabaseErrorCodes.TRANSACTION_ERROR;
    } else if (errorString.includes('initialize')) {
      errorCode = DatabaseErrorCodes.INITIALIZATION_ERROR;
    } else if (errorString.includes('backup')) {
      errorCode = DatabaseErrorCodes.BACKUP_ERROR;
    } else if (errorString.includes('restore')) {
      errorCode = DatabaseErrorCodes.RESTORE_ERROR;
    }
  }
  
  return new DatabaseError(errorMessage, errorCode, errorDetails);
}

/**
 * handleDatabaseError - Function to handle database errors consistently
 */
export function handleDatabaseError(error, operation = 'unknown') {
  // Convert to DatabaseError if not already
  const dbError = error instanceof DatabaseError
    ? error
    : createDatabaseError(error, operation);
  
  // Log the error
  console.error(`[DatabaseError] ${dbError.code}: ${dbError.message}`);
  if (dbError.details) {
    console.error('Details:', dbError.details);
  }
  
  // Return structured error for UI
  return {
    success: false,
    error: {
      code: dbError.code,
      message: dbError.userMessage,
      details: dbError.details?.operation ? `Operation: ${dbError.details.operation}` : undefined
    }
  };
} 