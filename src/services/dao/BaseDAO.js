/**
 * BaseDAO - Base Data Access Object
 * Provides common database operations for all entity types
 */
import databaseService from '../DatabaseService';

class BaseDAO {
  /**
   * Create a new DAO for a specific entity type
   * @param {string} tableName - Database table name for this entity
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.cache = new Map();
    this.cacheTimeout = 60000; // Cache valid for 1 minute
  }

  /**
   * Create a new record
   * @param {Object} data - Entity data
   * @returns {Promise<Object>} Result with insertId on success
   */
  async create(data) {
    const result = await databaseService.create(this.tableName, data);
    this.invalidateCache();
    return result;
  }

  /**
   * Read a record by id
   * @param {string} id - Entity id
   * @returns {Promise<Object>} Result with data on success
   */
  async read(id) {
    const cacheKey = `${this.tableName}_${id}`;
    
    // Check if data is in cache and still valid
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    // Get from database
    const result = await databaseService.read(this.tableName, id);
    
    // Update cache if successful
    if (result.success && result.data) {
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  /**
   * Update a record
   * @param {string} id - Entity id
   * @param {Object} data - Updated entity data
   * @returns {Promise<Object>} Result object
   */
  async update(id, data) {
    const result = await databaseService.update(this.tableName, id, data);
    this.invalidateCache(id);
    return result;
  }

  /**
   * Delete a record
   * @param {string} id - Entity id
   * @returns {Promise<Object>} Result object
   */
  async delete(id) {
    const result = await databaseService.delete(this.tableName, id);
    this.invalidateCache(id);
    return result;
  }

  /**
   * Execute a custom query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async query(sql, params = []) {
    const result = await databaseService.query(sql, params);
    return result;
  }

  /**
   * Find all records
   * @param {Object} options - Query options (orderBy, limit, offset)
   * @returns {Promise<Array>} All entity records
   */
  async findAll(options = {}) {
    const cacheKey = `${this.tableName}_all_${JSON.stringify(options)}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    // Build query
    let sql = `SELECT * FROM ${this.tableName}`;
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
      
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }
    
    // Execute query
    const result = await databaseService.query(sql);
    
    // Cache results
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Find entities by multiple ids
   * @param {Array} ids - Array of entity ids
   * @returns {Promise<Array>} Matching entities
   */
  async findByIds(ids) {
    if (!ids || ids.length === 0) {
      return { success: true, data: [] };
    }
    
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`;
    
    return await databaseService.query(sql, ids);
  }

  /**
   * Count total records
   * @param {string} whereClause - Optional WHERE clause
   * @param {Array} params - Query parameters
   * @returns {Promise<number>} Count of records
   */
  async count(whereClause = '', params = []) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    const result = await databaseService.query(sql, params);
    return result[0]?.count || 0;
  }

  /**
   * Invalidate specific or all cache entries
   * @param {string} id - Optional entity id to invalidate
   */
  invalidateCache(id = null) {
    if (id) {
      // Clear specific entity
      this.cache.delete(`${this.tableName}_${id}`);
      
      // Clear collections that may contain this entity
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${this.tableName}_all`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache for this table
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${this.tableName}`)) {
          this.cache.delete(key);
        }
      }
    }
  }
}

export default BaseDAO; 