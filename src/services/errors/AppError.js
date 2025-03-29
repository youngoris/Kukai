/**
 * AppError - Base error class for application errors
 * Provides standard error handling with user-friendly messages
 */
export class AppError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }
  
  // Get a user-friendly message
  get userMessage() {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'Network connection issue. Please check your internet connection.';
      case 'TIMEOUT_ERROR':
        return 'Request timed out. Please try again.';
      case 'API_ERROR':
        return 'Service temporarily unavailable. Please try again later.';
      case 'AUTH_ERROR':
        return 'Authentication failed. Please log in again.';
      case 'PERMISSION_ERROR':
        return 'Permission denied. You don\'t have access to this feature.';
      case 'VALIDATION_ERROR':
        return 'Invalid input. Please check your information.';
      case 'SYNC_ERROR':
        return 'Data synchronization failed. Please try again.';
      case 'RESOURCE_ERROR':
        return 'Resource not available. Please try again later.';
      case 'UNKNOWN_ERROR':
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

/**
 * AppErrorCodes - Enum of application error codes
 */
export const AppErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  API_ERROR: 'API_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SYNC_ERROR: 'SYNC_ERROR',
  RESOURCE_ERROR: 'RESOURCE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * createAppError - Factory function to create appropriate application error
 */
export function createAppError(originalError, operation = 'unknown') {
  const errorMessage = originalError ? originalError.message : 'Unknown error';
  const errorDetails = {
    operation,
    timestamp: new Date().toISOString(),
    original: originalError
  };
  
  // Determine error code based on error message or type
  let errorCode = AppErrorCodes.UNKNOWN_ERROR;
  
  if (originalError) {
    const errorString = originalError.toString().toLowerCase();
    
    if (errorString.includes('network') || errorString.includes('offline') || errorString.includes('connection')) {
      errorCode = AppErrorCodes.NETWORK_ERROR;
    } else if (errorString.includes('timeout') || errorString.includes('timed out')) {
      errorCode = AppErrorCodes.TIMEOUT_ERROR;
    } else if (errorString.includes('api') || errorString.includes('server')) {
      errorCode = AppErrorCodes.API_ERROR;
    } else if (errorString.includes('auth') || errorString.includes('login') || errorString.includes('unauthorized')) {
      errorCode = AppErrorCodes.AUTH_ERROR;
    } else if (errorString.includes('permission') || errorString.includes('forbidden')) {
      errorCode = AppErrorCodes.PERMISSION_ERROR;
    } else if (errorString.includes('validation') || errorString.includes('invalid')) {
      errorCode = AppErrorCodes.VALIDATION_ERROR;
    } else if (errorString.includes('sync') || errorString.includes('synchronization')) {
      errorCode = AppErrorCodes.SYNC_ERROR;
    } else if (errorString.includes('resource') || errorString.includes('not found')) {
      errorCode = AppErrorCodes.RESOURCE_ERROR;
    }
  }
  
  return new AppError(errorMessage, errorCode, errorDetails);
}

/**
 * handleAppError - Function to handle application errors consistently
 */
export function handleAppError(error, operation = 'unknown') {
  // Convert to AppError if not already
  const appError = error instanceof AppError
    ? error
    : createAppError(error, operation);
  
  // Log the error
  console.error(`[AppError] ${appError.code}: ${appError.message}`);
  if (appError.details) {
    console.error('Details:', appError.details);
  }
  
  // Import errorLogger dynamically to avoid circular dependencies
  const { errorLogger } = require('../errorLogger');
  errorLogger.logError(appError, { componentStack: operation });
  
  // Return structured error for UI
  return {
    success: false,
    error: {
      code: appError.code,
      message: appError.userMessage,
      details: appError.details?.operation ? `Operation: ${appError.details.operation}` : undefined
    }
  };
} 