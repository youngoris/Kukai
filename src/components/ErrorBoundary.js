import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { errorLogger } from '../services/errorLogger';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';
import { AppErrorCodes } from '../services/errors/AppError';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      isFatal: false,
      isRetrying: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to our error logging service
    errorLogger.logError(error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = async () => {
    this.setState({ isRetrying: true });
    
    // Increment retry count
    const newRetryCount = this.state.retryCount + 1;
    this.setState({ retryCount: newRetryCount });
    
    // Add a slight delay to show the retry loading indicator
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Limit retry attempts (max 3)
    if (newRetryCount >= 3 && this.state.error) {
      this.setState({ isRetrying: false });
      Alert.alert(
        'Multiple Errors Detected',
        'We\'re having trouble recovering from this error. Would you like to restart the app?',
        [
          { 
            text: 'Restart', 
            onPress: () => {
              // In a real app, we would use a native module to restart
              // For now, we'll just reset the error state
              this.setState({ 
                hasError: false, 
                error: null, 
                errorInfo: null, 
                isRetrying: false,
                retryCount: 0
              });
            } 
          },
          { 
            text: 'Continue Anyway', 
            style: 'cancel',
            onPress: () => {
              // Reset error state but not retry count
              this.setState({ 
                hasError: false, 
                error: null, 
                errorInfo: null, 
                isRetrying: false
              });
            }
          }
        ]
      );
      return;
    }
    
    // Reset error state to trigger a re-render
    this.setState({ hasError: false, error: null, errorInfo: null, isRetrying: false });
    
    // If the error was in a screen component, attempt to navigate back
    if (this.props.navigation && this.state.isFatal) {
      try {
        this.props.navigation.goBack();
      } catch (e) {
        // If navigation fails, at least we've reset the error state
      }
    }
  };

  getFriendlyErrorMessage = () => {
    const { error } = this.state;
    if (!error) return 'The application encountered an unexpected error';
    
    // Check for known error types
    if (error.code) {
      switch(error.code) {
        case AppErrorCodes.NETWORK_ERROR:
          return 'Network connection issue. Please check your internet connection and try again.';
        case AppErrorCodes.TIMEOUT_ERROR:
          return 'The request timed out. Please try again.';
        case AppErrorCodes.API_ERROR:
          return 'Service temporarily unavailable. Please try again later.';
        case AppErrorCodes.AUTH_ERROR:
          return 'Your session has expired. Please log in again.';
        default:
          return error.userMessage || error.message || 'An unexpected error occurred';
      }
    }
    
    // Generic error message with the actual error text
    return error.message || 'An unexpected error occurred';
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Sorry, something went wrong</Text>
          <Text style={styles.message}>
            {this.getFriendlyErrorMessage()}
          </Text>
          {__DEV__ && this.state.errorInfo && (
            <Text style={styles.details}>
              {this.state.errorInfo.componentStack.toString().slice(0, 500)}...
            </Text>
          )}
          <TouchableOpacity 
            style={[styles.button, this.state.isRetrying && styles.buttonDisabled]} 
            onPress={this.handleRetry}
            disabled={this.state.isRetrying}
          >
            {this.state.isRetrying ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color={COLORS.background} />
                <Text style={styles.buttonText}>Retrying...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Retry</Text>
            )}
          </TouchableOpacity>
          {this.state.retryCount > 0 && (
            <Text style={styles.retryText}>
              Retry attempt {this.state.retryCount} of 3
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

// Create a higher-order component for screen-level error boundaries
export const withErrorBoundary = (WrappedComponent) => {
  return (props) => (
    <ErrorBoundary navigation={props.navigation}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
};

// Set up global error handler for JS errors
export const setupGlobalErrorHandler = () => {
  // Handle Promise rejection errors globally
  const handlePromiseRejection = event => {
    const error = event.reason;
    
    // Log to our system
    errorLogger.logError(error, { 
      componentStack: 'Unhandled Promise Rejection',
      isFatal: false
    });
    
    // Prevent the default handling - we've already logged it
    event.preventDefault();
  };
  
  // Add event listener for unhandled promise rejections
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledrejection', handlePromiseRejection);
  }
  
  // Save the original error handler
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  // Create a new handler that logs errors and then calls the original
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to our system
    errorLogger.logError(error, { 
      componentStack: 'Global JS error - not from a React component',
      isFatal 
    });
    
    // Show a user-friendly alert if in production and fatal
    if (!__DEV__ && isFatal) {
      Alert.alert(
        'Application Error',
        'We\'re sorry, the application encountered an unexpected error. The development team has been notified.',
        [{ text: 'OK' }]
      );
    }
    
    // Call the original handler
    originalHandler(error, isFatal);
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.m,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: FONT_SIZE.m,
    textAlign: 'center',
    marginBottom: SPACING.l,
    color: COLORS.text.secondary,
    paddingHorizontal: SPACING.l,
  },
  details: {
    fontSize: FONT_SIZE.xs,
    textAlign: 'left',
    marginBottom: SPACING.l,
    color: COLORS.text.tertiary,
    padding: SPACING.m,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    maxHeight: 200,
    width: '100%',
  },
  button: {
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.m,
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  retryText: {
    fontSize: FONT_SIZE.s,
    color: COLORS.text.tertiary,
    marginTop: SPACING.m,
  },
}); 