/**
 * ConfigService - A service to manage application configuration
 * Replaces AsyncStorage with SQLite-backed storage
 */

class ConfigService {
  constructor() {
    this.db = null;
    this.cache = new Map();
    this.initialized = false;
  }
  
  /**
   * Initialize the config service with a database connection
   */
  async initialize(database) {
    this.db = database;
    
    await this.ensureConfigTable();
    await this.preloadConfigs();
    
    this.initialized = true;
    console.log('ConfigService initialized successfully');
    return { success: true };
  }
  
  /**
   * Ensure config table exists
   */
  async ensureConfigTable() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        value_type TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  
  /**
   * Preload configs to memory for faster access
   */
  async preloadConfigs() {
    const configs = await this.db.getAllAsync('SELECT * FROM app_config');
    
    for (const config of configs) {
      this.cache.set(config.key, this.parseStoredValue(config));
    }
    
    console.log(`Preloaded ${configs.length} config items`);
  }
  
  /**
   * Parse stored value based on its type
   */
  parseStoredValue(config) {
    try {
      switch (config.value_type) {
        case 'boolean': 
          return config.value === 'true';
        case 'number': 
          return Number(config.value);
        case 'json': 
          return JSON.parse(config.value);
        default: 
          return config.value;
      }
    } catch (error) {
      console.error(`Failed to parse config value: ${config.key}`, error);
      return config.value; // Return original string if parsing fails
    }
  }
  
  /**
   * Prepare value for storage
   */
  prepareValueForStorage(value) {
    const type = typeof value;
    
    if (value === null || value === undefined) {
      return { stringValue: '', valueType: 'null' };
    }
    
    if (type === 'object') {
      return { 
        stringValue: JSON.stringify(value), 
        valueType: 'json' 
      };
    }
    
    return { 
      stringValue: String(value), 
      valueType: type 
    };
  }
  
  /**
   * Get a config item
   */
  async getItem(key, defaultValue = null) {
    if (!this.initialized) {
      throw new Error('ConfigService not initialized');
    }
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM app_config WHERE key = ?', 
        [key]
      );
      
      if (!result) {
        return defaultValue;
      }
      
      const value = this.parseStoredValue(result);
      this.cache.set(key, value);
      
      return value;
    } catch (error) {
      console.error(`Error getting config item ${key}:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Set a config item
   */
  async setItem(key, value, description = null) {
    if (!this.initialized) {
      throw new Error('ConfigService not initialized');
    }
    
    try {
      const { stringValue, valueType } = this.prepareValueForStorage(value);
      
      await this.db.runAsync(
        `INSERT OR REPLACE INTO app_config 
         (key, value, value_type, description, updated_at) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [key, stringValue, valueType, description]
      );
      
      // Update cache
      this.cache.set(key, value);
      
      return { success: true };
    } catch (error) {
      console.error(`Error setting config item ${key}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all config keys
   */
  async getAllKeys() {
    try {
      const results = await this.db.getAllAsync('SELECT key FROM app_config');
      return results.map(row => row.key);
    } catch (error) {
      console.error('Error getting all keys:', error);
      return [];
    }
  }
  
  /**
   * Remove a config item
   */
  async removeItem(key) {
    try {
      await this.db.runAsync('DELETE FROM app_config WHERE key = ?', [key]);
      this.cache.delete(key);
      return { success: true };
    } catch (error) {
      console.error(`Error removing config item ${key}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    return { success: true };
  }
}

export default new ConfigService(); 