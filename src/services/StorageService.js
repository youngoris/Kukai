/**
 * StorageService - Drop-in replacement for AsyncStorage
 * Provides the same API as AsyncStorage but uses ConfigService (SQLite) under the hood
 */

import configService from './ConfigService';

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
   * Get item from storage
   */
  async getItem(key, defaultValue = null) {
    // Check ConfigService
    if (this.initialized && configService.initialized) {
      const formattedKey = this.formatKey(key);
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
    // No need to manually stringify - ConfigService handles serialization
    
    // Store in ConfigService if initialized
    if (this.initialized && configService.initialized) {
      await configService.setItem(formattedKey, value);
    }
    
    return true;
  }
  
  /**
   * Remove item from storage
   */
  async removeItem(key) {
    // Remove from ConfigService if initialized
    if (this.initialized && configService.initialized) {
      const formattedKey = this.formatKey(key);
      await configService.removeItem(formattedKey);
    }
    
    return true;
  }
  
  /**
   * Get all keys from storage
   */
  async getAllKeys() {
    let keys = [];
    
    // Get keys from ConfigService if initialized
    if (this.initialized && configService.initialized) {
      const configKeys = await configService.getAllKeys();
      keys = [...configKeys];
    }
    
    return keys;
  }
  
  /**
   * Clear all items from storage
   */
  async clear() {
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

// Initialize when DatabaseService is ready
export const initializeStorageService = async () => {
  if (configService.initialized) {
    storageService.setInitialized(true);
    console.log('StorageService initialized successfully');
    return true;
  }
  return false;
};

export default storageService; 