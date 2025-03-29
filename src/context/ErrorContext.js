import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import ErrorToast from '../components/ErrorToast';
import { errorLogger } from '../services/errorLogger';
import { 
  AppError, 
  AppErrorCodes, 
  createAppError 
} from '../services/errors/AppError';

// Create context
const ErrorContext = createContext(null);

/**
 * ErrorProvider - Provides error handling functionality to the app
 * - Manages global error state
 * - Shows error toasts for non-critical errors
 * - Logs errors to the error logger
 */
export const ErrorProvider = ({ children }) => {
  const [errorState, setErrorState] = useState({
    hasError: false,
    error: null,
    errorInfo: null
  });
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'error',
    duration: 3000
  });
  
  // Track app state for error reporting
  const [appState, setAppState] = useState(AppState.currentState);
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Set critical error
  const setCriticalError = useCallback((error, errorInfo = {}) => {
    // Log the error
    errorLogger.logError(error, errorInfo);
    
    // Update state
    setErrorState({
      hasError: true,
      error,
      errorInfo
    });
  }, []);
  
  // Clear critical error
  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }, []);
  
  // Show toast for non-critical errors
  const showToast = useCallback((message, options = {}) => {
    setToast({
      visible: true,
      message,
      type: options.type || 'error',
      duration: options.duration || 3000
    });
    
    // Log non-critical errors too
    if (options.error) {
      errorLogger.logError(options.error, { 
        componentStack: options.source || 'Toast Error',
        isFatal: false
      });
    }
  }, []);
  
  // Hide toast
  const hideToast = useCallback(() => {
    setToast(prev => ({
      ...prev,
      visible: false
    }));
  }, []);
  
  // Handle error and determine if it should be critical or a toast
  const handleError = useCallback((error, options = {}) => {
    const { 
      isCritical = false, 
      errorInfo = {}, 
      source = 'unknown',
      showToastForNonCritical = true
    } = options;
    
    // Ensure error is an AppError
    const appError = error instanceof AppError 
      ? error 
      : createAppError(error, source);
    
    // Log all errors
    errorLogger.logError(appError, { 
      componentStack: errorInfo.componentStack || source,
      isFatal: isCritical
    });
    
    // Handle critical errors
    if (isCritical) {
      setCriticalError(appError, errorInfo);
      return;
    }
    
    // Show toast for non-critical errors
    if (showToastForNonCritical) {
      showToast(appError.userMessage, {
        type: 'error',
        error: appError,
        source
      });
    }
    
    // Return structured error object for component-level handling
    return {
      success: false,
      error: {
        code: appError.code,
        message: appError.userMessage,
        details: appError.details
      }
    };
  }, [setCriticalError, showToast]);
  
  // Context value
  const contextValue = {
    ...errorState,
    setCriticalError,
    clearError,
    showToast,
    hideToast,
    handleError,
    toast
  };
  
  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      
      {/* Render toast if visible */}
      {toast.visible && (
        <ErrorToast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={hideToast}
        />
      )}
    </ErrorContext.Provider>
  );
};

// Custom hook for using error context
export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

export default ErrorContext; 