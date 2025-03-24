/**
 * Storage utilities for migrating from AsyncStorage to SQLite
 * This file provides helper functions to search for and replace AsyncStorage usage
 */

import storageService from '../services/storage/StorageService';

/**
 * Helper function for safely migrating AsyncStorage data to StorageService
 * 
 * @param {string} key The key to migrate
 * @param {Function} transformer Optional function to transform the data
 * @returns {Promise<{success: boolean, data: any}>} The result of the migration
 */
export const migrateKey = async (key, transformer = null) => {
  try {
    // Import AsyncStorage directly to avoid circular dependencies
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Get the value from AsyncStorage
    const value = await AsyncStorage.getItem(key);
    
    if (value !== null) {
      // Transform the value if a transformer is provided
      const transformedValue = transformer ? transformer(value) : value;
      
      // Save to StorageService
      await storageService.setItem(key, transformedValue);
      
      console.log(`Migrated key ${key} to StorageService`);
      return { success: true, data: transformedValue };
    }
    
    return { success: false, message: 'Key not found in AsyncStorage' };
  } catch (error) {
    console.error(`Error migrating key ${key}:`, error);
    return { success: false, error };
  }
};

/**
 * Helper function to check if all keys are migrated
 * 
 * @param {string[]} keys Array of keys to check
 * @returns {Promise<{success: boolean, migratedKeys: string[], pendingKeys: string[]}>}
 */
export const checkMigrationStatus = async (keys) => {
  try {
    // Import AsyncStorage directly to avoid circular dependencies
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    const migratedKeys = [];
    const pendingKeys = [];
    
    for (const key of keys) {
      // Check if the key exists in both AsyncStorage and StorageService
      const [asyncValue, storageValue] = await Promise.all([
        AsyncStorage.getItem(key),
        storageService.getItem(key)
      ]);
      
      if (asyncValue === null || storageValue !== null) {
        migratedKeys.push(key);
      } else {
        pendingKeys.push(key);
      }
    }
    
    return {
      success: true,
      migratedKeys,
      pendingKeys,
      allMigrated: pendingKeys.length === 0
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { success: false, error };
  }
};

/**
 * Documentation comment to place at the top of files when replacing AsyncStorage
 */
export const migrationComment = `
/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
`;

export default {
  migrateKey,
  checkMigrationStatus,
  migrationComment
}; 