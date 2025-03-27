/**
 * StorageService - Drop-in replacement for AsyncStorage
 * Provides the same API as AsyncStorage but uses ConfigService (SQLite) under the hood
 * EXCEPTION: User settings are stored in AsyncStorage for better reliability
 */

import configService from '../ConfigService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// List of keys that should be stored in AsyncStorage instead of SQLite
const ASYNC_STORAGE_KEYS = [
  'userSettings',
  'taskNotifications',
  'notificationSound', 
  'quietHoursEnabled',
  'quietHoursStart',
  'quietHoursEnd'
];

class StorageService {
  /**
   * Initialize the storage service
   */
  constructor() {
    this.initialized = false;
    this.useAsyncStorageFallback = false; // Disable AsyncStorage fallback since migration is complete
  }
  
  /**
   * Set initialization status
   */
  setInitialized(status) {
    this.initialized = status;
  }
  
  /**
   * Format key by removing @ prefix if present
   */
  formatKey(key) {
    return key.startsWith('@') ? key.substring(1) : key;
  }
  
  /**
   * Check if a key should use AsyncStorage instead of SQLite
   */
  shouldUseAsyncStorage(key) {
    return ASYNC_STORAGE_KEYS.includes(this.formatKey(key));
  }
  
  /**
   * Get item from storage
   */
  async getItem(key, defaultValue = null) {
    const formattedKey = this.formatKey(key);
    
    // For user settings, use AsyncStorage directly
    if (this.shouldUseAsyncStorage(formattedKey)) {
      try {
        const value = await AsyncStorage.getItem('@' + formattedKey);
        if (value !== null) {
          return value;
        }
      } catch (error) {
        console.error(`Error reading ${formattedKey} from AsyncStorage:`, error);
      }
      return defaultValue;
    }
    
    // For other data, use ConfigService
    if (this.initialized && configService.initialized) {
      const value = await configService.getItem(formattedKey);
      
      if (value !== null) {
        return value;
      }
    }
    
    return defaultValue;
  }
  
  /**
   * Set item in storage
   */
  async setItem(key, value) {
    const formattedKey = this.formatKey(key);
    
    // For user settings, use AsyncStorage directly
    if (this.shouldUseAsyncStorage(formattedKey)) {
      try {
        await AsyncStorage.setItem('@' + formattedKey, value);
        return true;
      } catch (error) {
        console.error(`Error saving ${formattedKey} to AsyncStorage:`, error);
        return false;
      }
    }
    
    // For other data, use ConfigService
    if (this.initialized && configService.initialized) {
      try {
        await configService.setItem(formattedKey, value);
        return true;
      } catch (error) {
        console.error(`Error saving ${formattedKey} to ConfigService:`, error);
        return false;
      }
    }
    
    return false;
  }
  
  /**
   * Remove item from storage
   */
  async removeItem(key) {
    const formattedKey = this.formatKey(key);
    
    // For user settings, use AsyncStorage directly
    if (this.shouldUseAsyncStorage(formattedKey)) {
      try {
        await AsyncStorage.removeItem('@' + formattedKey);
      } catch (error) {
        console.error(`Error removing ${formattedKey} from AsyncStorage:`, error);
      }
    }
    
    // Remove from ConfigService if initialized
    if (this.initialized && configService.initialized) {
      await configService.removeItem(formattedKey);
    }
    
    return true;
  }
  
  /**
   * Get all keys from storage
   */
  async getAllKeys() {
    let keys = [];
    
    // Get keys from AsyncStorage
    try {
      const asyncKeys = await AsyncStorage.getAllKeys();
      // Remove the @ prefix
      const formattedAsyncKeys = asyncKeys
        .filter(key => key.startsWith('@'))
        .map(key => key.substring(1));
      keys = [...formattedAsyncKeys];
    } catch (error) {
      console.error('Error getting keys from AsyncStorage:', error);
    }
    
    // Get keys from ConfigService if initialized
    if (this.initialized && configService.initialized) {
      const configKeys = await configService.getAllKeys();
      // Only add keys that aren't already in the list
      for (const key of configKeys) {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      }
    }
    
    return keys;
  }
  
  /**
   * Clear all items from storage
   */
  async clear() {
    // Clear AsyncStorage settings
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const settingsKeys = allKeys.filter(key => 
        ASYNC_STORAGE_KEYS.some(settingKey => key === '@' + settingKey)
      );
      if (settingsKeys.length > 0) {
        await AsyncStorage.multiRemove(settingsKeys);
      }
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }
    
    // Clear ConfigService if initialized
    if (this.initialized && configService.initialized) {
      const keys = await configService.getAllKeys();
      for (const key of keys) {
        await configService.removeItem(key);
      }
      configService.clearCache();
    }
    
    return true;
  }
  
  /**
   * Get multiple items at once
   */
  async multiGet(keys) {
    const result = [];
    
    for (const key of keys) {
      const value = await this.getItem(key);
      result.push([key, value]);
    }
    
    return result;
  }
  
  /**
   * Set multiple items at once
   */
  async multiSet(keyValuePairs) {
    for (const [key, value] of keyValuePairs) {
      await this.setItem(key, value);
    }
    
    return true;
  }
  
  /**
   * Remove multiple items at once
   */
  async multiRemove(keys) {
    for (const key of keys) {
      await this.removeItem(key);
    }
    
    return true;
  }
  
  /**
   * Merge an existing item with a new value
   */
  async mergeItem(key, value) {
    // Get existing item
    const existingItem = await this.getItem(key);
    
    if (existingItem) {
      let existingObject;
      
      // Parse existing item if it's a string
      if (typeof existingItem === 'string') {
        try {
          existingObject = JSON.parse(existingItem);
        } catch (e) {
          existingObject = { value: existingItem };
        }
      } else {
        existingObject = existingItem;
      }
      
      // Parse new value if it's a string
      let newValue;
      if (typeof value === 'string') {
        try {
          newValue = JSON.parse(value);
        } catch (e) {
          newValue = { value };
        }
      } else {
        newValue = value;
      }
      
      // Merge objects
      const mergedValue = { ...existingObject, ...newValue };
      
      // Store merged value
      await this.setItem(key, mergedValue);
    } else {
      // If item doesn't exist, just set it
      await this.setItem(key, value);
    }
    
    return true;
  }
  
  /**
   * Merge multiple items at once
   */
  async multiMerge(keyValuePairs) {
    for (const [key, value] of keyValuePairs) {
      await this.mergeItem(key, value);
    }
    
    return true;
  }
}

// Create singleton instance
const storageService = new StorageService();

// Migrate any settings from SQLite to AsyncStorage
export const migrateSettingsToAsyncStorage = async () => {
  try {
    // Only do this if ConfigService is initialized
    if (configService.initialized) {
      console.log('Checking for settings to migrate from SQLite to AsyncStorage...');
      
      // Check each settings key
      for (const key of ASYNC_STORAGE_KEYS) {
        // First check if the setting already exists in AsyncStorage
        const asyncValue = await AsyncStorage.getItem('@' + key);
        
        // If not in AsyncStorage, try to get it from ConfigService
        if (asyncValue === null) {
          const sqliteValue = await configService.getItem(key);
          
          // If found in ConfigService, save to AsyncStorage
          if (sqliteValue !== null) {
            console.log(`Migrating setting ${key} from SQLite to AsyncStorage`);
            // Convert to string if needed (AsyncStorage requires strings)
            const valueToStore = typeof sqliteValue === 'string' ? 
              sqliteValue : JSON.stringify(sqliteValue);
            
            await AsyncStorage.setItem('@' + key, valueToStore);
            
            // Clean up the old SQLite value (optional)
            await configService.removeItem(key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error migrating settings to AsyncStorage:', error);
  }
};

// Initialize when DatabaseService is ready
export const initializeStorageService = async () => {
  if (configService.initialized) {
    storageService.setInitialized(true);
    console.log('StorageService initialized successfully');
    
    // Migrate any settings from SQLite to AsyncStorage
    await migrateSettingsToAsyncStorage();
    
    return true;
  }
  return false;
};

export default storageService; 