/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import storageService from '../services/storage/StorageService';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const ERROR_LOG_KEY = '@kukai/error_logs';
const MAX_LOGS = 100; // Limit the number of logs to store

class ErrorLogger {
  constructor() {
    this.lastErrors = {}; // Used to prevent duplicate error logs in rapid succession
  }

  async saveErrorLog(log) {
    try {
      // Check for duplicate errors within a short time window (5 seconds)
      const errorKey = `${log.error}_${log.componentInfo}`;
      const now = Date.now();
      
      if (this.lastErrors[errorKey] && now - this.lastErrors[errorKey] < 5000) {
        console.log('Duplicate error log suppressed');
        return; // Skip duplicate errors
      }
      
      // Update the timestamp of the last occurrence of this error
      this.lastErrors[errorKey] = now;
      
      // Add device info to the log
      const enhancedLog = {
        ...log,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
          model: Device.modelName,
          appVersion: Constants.manifest.version || 'unknown',
        }
      };
      
      const existingLogs = await this.getErrorLogs();
      
      // Add the new log and limit to MAX_LOGS
      const updatedLogs = [enhancedLog, ...existingLogs].slice(0, MAX_LOGS);
      
      await storageService.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Failed to save error log:', error);
    }
  }

  async getErrorLogs() {
    try {
      const logs = await storageService.getItem(ERROR_LOG_KEY);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  }

  async clearErrorLogs() {
    try {
      await storageService.removeItem(ERROR_LOG_KEY);
      this.lastErrors = {}; // Reset duplicate tracking
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  }

  logError(error, errorInfo, userInfo) {
    // Create a standardized error log object
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error?.toString() || 'Unknown error',
      stack: error?.stack,
      componentInfo: errorInfo?.componentStack || 'No component stack',
      userInfo,
      severity: errorInfo?.isFatal ? 'FATAL' : 'ERROR',
    };

    // Print errors in development mode
    if (__DEV__) {
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
    }

    // Save error log to local storage
    this.saveErrorLog(errorLog);

    // Here you could add logic to send the error to a server
    // Only in production to avoid spam during development
    if (!__DEV__) {
      this.reportErrorToServer(errorLog);
    }
  }
  
  // Method to report errors to a backend service
  async reportErrorToServer(errorLog) {
    // Implement error reporting to your backend service
    // Example:
    // try {
    //   const response = await fetch('https://your-api.com/error-reporting', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(errorLog),
    //   });
    //   console.log('Error reported to server:', response.status);
    // } catch (error) {
    //   console.error('Failed to report error to server:', error);
    // }
  }
  
  // Export logs for debugging or support
  async exportLogs() {
    try {
      const logs = await this.getErrorLogs();
      return JSON.stringify(logs, null, 2); // Prettified JSON
    } catch (error) {
      console.error('Failed to export logs:', error);
      return JSON.stringify({ error: 'Failed to export logs' });
    }
  }
}

export const errorLogger = new ErrorLogger(); 