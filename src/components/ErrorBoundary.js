import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { errorLogger } from '../services/errorLogger';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      isFatal: false
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

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // If the error was in a screen component, attempt to navigate back
    if (this.props.navigation && this.state.isFatal) {
      try {
        this.props.navigation.goBack();
      } catch (e) {
        // If navigation fails, at least we've reset the error state
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Sorry, something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'The application encountered an unexpected error'}
          </Text>
          {__DEV__ && this.state.errorInfo && (
            <Text style={styles.details}>
              {this.state.errorInfo.componentStack.toString().slice(0, 500)}...
            </Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
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
  // Save the original error handler
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  // Create a new handler that logs errors and then calls the original
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to our system
    errorLogger.logError(error, { 
      componentStack: 'Global JS error - not from a React component',
      isFatal 
    });
    
    // Show a user-friendly alert if in production
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
  },
  buttonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
  },
}); 