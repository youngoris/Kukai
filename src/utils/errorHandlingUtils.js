/**
 * Error handling utilities for consistent error management across the app
 */
import { handleAppError, AppErrorCodes, createAppError } from '../services/errors/AppError';

/**
 * Error boundaries for network requests - wraps async functions with consistent error handling
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Options for error handling
 * @param {string} options.operation - Name of the operation for error context
 * @param {Function} options.onError - Optional callback for custom error handling
 * @param {boolean} options.silent - Whether to suppress error logs
 * @returns {Promise<Object>} - Result object with success flag
 */
export const withErrorHandling = async (asyncFn, options = {}) => {
  const { operation = 'unknown', onError, silent = false } = options;
  
  try {
    const result = await asyncFn();
    return { success: true, data: result };
  } catch (error) {
    if (!silent) {
      console.log(`Error in operation ${operation}:`, error);
    }
    
    // Call custom error handler if provided
    if (onError && typeof onError === 'function') {
      onError(error);
    }
    
    return handleAppError(error, operation);
  }
};

/**
 * Handle network requests with timeout and error handling
 * @param {Function} fetchFn - Function that returns a fetch promise
 * @param {Object} options - Request options
 * @param {number} options.timeout - Timeout in milliseconds (default: 30000)
 * @param {string} options.operation - Name of the operation
 * @param {Function} options.onError - Custom error handler
 * @param {boolean} options.returnRawResponse - Whether to return the raw response
 * @returns {Promise<Object>} - Result object with success flag
 */
export const handleApiRequest = async (fetchFn, options = {}) => {
  const { 
    timeout = 30000, 
    operation = 'api_request',
    onError,
    returnRawResponse = false,
  } = options;
  
  // Create a timeout promise that rejects after the specified time
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(createAppError(
      new Error(`Request timed out after ${timeout}ms`),
      AppErrorCodes.TIMEOUT_ERROR
    )), timeout);
  });
  
  try {
    // Race between the fetch and the timeout
    const response = await Promise.race([fetchFn(), timeoutPromise]);
    
    // Return raw response if requested
    if (returnRawResponse) {
      return { success: true, data: response };
    }
    
    // Check if response is ok
    if (!response.ok) {
      const errorText = await response.text();
      throw createAppError(
        new Error(`Request failed with status ${response.status}: ${errorText}`),
        response.status === 401 ? AppErrorCodes.AUTH_ERROR :
        response.status === 403 ? AppErrorCodes.PERMISSION_ERROR :
        response.status >= 500 ? AppErrorCodes.API_ERROR : 
        AppErrorCodes.UNKNOWN_ERROR
      );
    }
    
    // Parse JSON response
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (onError && typeof onError === 'function') {
      onError(error);
    }
    
    return handleAppError(error, operation);
  }
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in milliseconds (default: 300)
 * @param {Function} options.shouldRetry - Function that determines if retry should happen
 * @returns {Promise<any>} - Result of the function
 */
export const withRetry = async (fn, options = {}) => {
  const { 
    maxRetries = 3, 
    initialDelay = 300,
    shouldRetry = (error) => true // Default to retry for any error
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      // Don't wait on the last attempt
      if (attempt === maxRetries) break;
      
      // Check if we should retry
      if (!shouldRetry(error)) throw error;
      
      // Exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}; 