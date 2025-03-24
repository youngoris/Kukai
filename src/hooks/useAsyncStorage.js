/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */

import { useState, useCallback } from "react";
import storageService from "../services/storage/StorageService";

/**
 * Custom hook for storage operations with error handling
 * Originally used AsyncStorage, now uses StorageService backed by SQLite
 *
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value if nothing is stored
 * @returns {Array} - [storedValue, setValue, removeValue, loading, error, initialize]
 */
const useAsyncStorage = (key, initialValue = null) => {
  const [storedValue, setStoredValue] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from storage
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      const item = await storageService.getItem(key);
      // Handle both string and parsed values from StorageService
      let value = item;
      if (typeof item === 'string') {
        try {
          value = JSON.parse(item);
        } catch {
          // If item isn't valid JSON, use it as-is
          value = item;
        }
      }
      // If no item was found, use initialValue
      if (item === null) {
        value = initialValue;
      }
      setStoredValue(value);
      setError(null);
    } catch (e) {
      console.error(`Error reading from storage (${key}):`, e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [key, initialValue]);

  // Save data to storage
  const setValue = useCallback(
    async (value) => {
      try {
        setLoading(true);
        // Allow value to be a function for previous state updates
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        await storageService.setItem(key, valueToStore);
        setError(null);
        return true;
      } catch (e) {
        console.error(`Error writing to storage (${key}):`, e);
        setError(e);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [key, storedValue],
  );

  // Remove data from storage
  const removeValue = useCallback(async () => {
    try {
      setLoading(true);
      await storageService.removeItem(key);
      setStoredValue(initialValue);
      setError(null);
      return true;
    } catch (e) {
      console.error(`Error removing from storage (${key}):`, e);
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
