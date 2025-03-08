import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Custom hook for AsyncStorage operations with error handling
 * 
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value if nothing is stored
 * @returns {Array} - [storedValue, setValue, loading, error]
 */
const useAsyncStorage = (key, initialValue = null) => {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from storage
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      const item = await AsyncStorage.getItem(key);
      const value = item ? JSON.parse(item) : initialValue;
      setStoredValue(value);
      setError(null);
    } catch (e) {
      console.error(`Error reading from AsyncStorage (${key}):`, e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [key, initialValue]);

  // Save data to storage
  const setValue = useCallback(async (value) => {
    try {
      setLoading(true);
      // Allow value to be a function for previous state updates
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      await AsyncStorage.setItem(key, JSON.stringify(valueToStore));
      setError(null);
      return true;
    } catch (e) {
      console.error(`Error writing to AsyncStorage (${key}):`, e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [key, storedValue]);

  // Remove data from storage
  const removeValue = useCallback(async () => {
    try {
      setLoading(true);
      await AsyncStorage.removeItem(key);
      setStoredValue(initialValue);
      setError(null);
      return true;
    } catch (e) {
      console.error(`Error removing from AsyncStorage (${key}):`, e);
      setError(e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [key, initialValue]);

  // Initialize on first render
  useState(() => {
    initialize();
  }, [initialize]);

  return [storedValue, setValue, removeValue, loading, error, initialize];
};

export default useAsyncStorage; 