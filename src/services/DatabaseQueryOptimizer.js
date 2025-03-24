/**
 * DatabaseQueryOptimizer - Provides optimized query generation and performance enhancement
 */
import databaseService from './DatabaseService';

class DatabaseQueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.cacheEnabled = true;
    this.cacheTimeout = 60000; // 1 minute default cache timeout
    this.indexStatus = {};
  }
  
  /**
   * Enable or disable query caching
   */
  setCacheEnabled(enabled) {
    this.cacheEnabled = enabled;
  }
  
  /**
   * Set cache timeout in milliseconds
   */
  setCacheTimeout(timeout) {
    this.cacheTimeout = timeout;
  }
  
  /**
   * Clear the entire query cache
   */
  clearCache() {
    this.queryCache.clear();
  }
  
  /**
   * Clear specific cached query by key
   */
  clearCacheForKey(key) {
    this.queryCache.delete(key);
  }
  
  /**
   * Generate cache key for a query
   */
  generateCacheKey(sql, params) {
    return `${sql}:${JSON.stringify(params || [])}`;
  }
  
  /**
   * Execute query with caching
   */
  async executeQuery(sql, params = [], bypassCache = false) {
    const key = this.generateCacheKey(sql, params);
    
    // Check cache if enabled and not bypassed
    if (this.cacheEnabled && !bypassCache) {
      const cachedResult = this.queryCache.get(key);
      if (cachedResult && (Date.now() - cachedResult.timestamp < this.cacheTimeout)) {
        return { ...cachedResult.result, fromCache: true };
      }
    }
    
    // Execute query
    const result = await databaseService.query(sql, params);
    
    // Cache result if caching is enabled and query was successful
    if (this.cacheEnabled && !bypassCache && result && result.success) {
      this.queryCache.set(key, {
        result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }
  
  /**
   * Ensure proper indexes exist for tables
   */
  async ensureIndexes() {
    try {
      // Task indexes
      await this.createIndexIfNotExists('idx_tasks_completed', 'tasks', 'completed');
      await this.createIndexIfNotExists('idx_tasks_due_date', 'tasks', 'due_date');
      await this.createIndexIfNotExists('idx_tasks_priority', 'tasks', 'priority');
      await this.createIndexIfNotExists('idx_tasks_category', 'tasks', 'category_id');
      await this.createIndexIfNotExists('idx_tasks_frog', 'tasks', 'is_frog');
      await this.createIndexIfNotExists('idx_tasks_important', 'tasks', 'is_important');
      await this.createIndexIfNotExists('idx_tasks_urgent', 'tasks', 'is_urgent');
      
      // Journal entries indexes
      await this.createIndexIfNotExists('idx_journal_timestamp', 'journal_entries', 'timestamp');
      await this.createIndexIfNotExists('idx_journal_mood', 'journal_entries', 'mood');
      
      // Meditation sessions indexes
      await this.createIndexIfNotExists('idx_meditation_start_time', 'meditation_sessions', 'start_time');
      await this.createIndexIfNotExists('idx_meditation_completed', 'meditation_sessions', 'completed');
      await this.createIndexIfNotExists('idx_meditation_duration', 'meditation_sessions', 'duration');
      
      // Focus sessions indexes
      await this.createIndexIfNotExists('idx_focus_start_time', 'focus_sessions', 'start_time');
      await this.createIndexIfNotExists('idx_focus_completed', 'focus_sessions', 'completed');
      await this.createIndexIfNotExists('idx_focus_task', 'focus_sessions', 'task_id');
      
      console.log('Database indexes have been created or verified');
      return { success: true };
    } catch (error) {
      console.error('Failed to ensure indexes:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Create an index if it doesn't exist
   */
  async createIndexIfNotExists(indexName, tableName, columnName) {
    try {
      // Try to create the index using modern SQLite API
      try {
        // Attempt to create the index
        await databaseService.db.runAsync(
          `CREATE INDEX ${indexName} ON ${tableName} (${columnName})`
        );
        
        console.log(`Created index ${indexName} on ${tableName}(${columnName})`);
        this.indexStatus[indexName] = true;
        return { success: true };
      } catch (error) {
        // Check if the error is due to index already existing
        const errorString = error.toString().toLowerCase();
        if (errorString.includes('already exists')) {
          // This is expected if index already exists - not an error
          console.log(`Index ${indexName} already exists`);
          this.indexStatus[indexName] = true;
          return { success: true };
        } else {
          // Other error - propagate it
          console.error(`Failed to create index ${indexName}:`, error);
          this.indexStatus[indexName] = false;
          throw error;
        }
      }
    } catch (error) {
      console.error(`Failed to create index ${indexName}:`, error);
      this.indexStatus[indexName] = false;
      return { success: false, error };
    }
  }
  
  /**
   * Check if an index exists
   */
  async checkIndexExists(indexName) {
    try {
      const result = await databaseService.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        [indexName]
      );
      
      // Check if index exists in the result
      if (!result || !result.success) {
        return false;
      }
      
      // With new API, data property contains the rows
      return result.data && result.data.length > 0;
    } catch (error) {
      console.error(`Failed to check if index ${indexName} exists:`, error);
      return false;
    }
  }
  
  /**
   * Optimize a query by rewriting it
   */
  optimizeQuery(sql) {
    // Add query optimization logic here
    // Examples:
    // - Use EXISTS instead of IN for subqueries
    // - Add LIMIT to queries that don't need all results
    // - Use indexed columns in WHERE clauses
    
    let optimizedSql = sql;
    
    // Optimize COUNT queries
    if (optimizedSql.includes('COUNT(*)') && !optimizedSql.includes('GROUP BY')) {
      optimizedSql = optimizedSql.replace('COUNT(*)', 'COUNT(1)');
    }
    
    // Optimize LIKE queries to use indexes where possible
    if (optimizedSql.includes('LIKE \'%')) {
      optimizedSql = optimizedSql.replace(/LIKE\s+'%([^%]+)'/g, "LIKE '$1%'");
    }
    
    return optimizedSql;
  }
  
  /**
   * Create optimized paging query
   */
  createPagingQuery(baseQuery, page = 1, pageSize = 20, orderBy = 'id', direction = 'ASC') {
    const offset = (page - 1) * pageSize;
    return `${baseQuery} ORDER BY ${orderBy} ${direction} LIMIT ${pageSize} OFFSET ${offset}`;
  }
  
  /**
   * Execute a paging query and return formatted result
   */
  async executePagingQuery(baseQuery, countQuery, params = [], page = 1, pageSize = 20, orderBy = 'id', direction = 'ASC') {
    const pagingQuery = this.createPagingQuery(baseQuery, page, pageSize, orderBy, direction);
    
    // Execute both the paging query and the count query
    const [resultsQuery, countResultQuery] = await Promise.all([
      this.executeQuery(pagingQuery, params),
      this.executeQuery(countQuery, params)
    ]);
    
    // Extract data from the results (new API structure)
    const results = resultsQuery.data || [];
    const countResult = countResultQuery.data || [];
    
    // Get total count from first row of count query result
    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return {
      success: true,
      data: results,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }
  
  /**
   * Create a full text search query
   */
  createFullTextSearchQuery(table, columns, searchTerm) {
    const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
    
    // Create WHERE conditions for each column
    const searchConditions = Array.isArray(columns) 
      ? columns.map(col => `${col} LIKE ?`).join(' OR ')
      : `${columns} LIKE ?`;
    
    // Create parameters with wildcards
    const params = Array.isArray(columns)
      ? columns.map(() => `%${searchTerm}%`)
      : [`%${searchTerm}%`];
    
    const sql = `SELECT * FROM ${table} WHERE ${searchConditions}`;
    return { sql, params };
  }
  
  /**
   * Execute a full text search
   */
  async executeFullTextSearch(table, columns, searchTerm, page = 1, pageSize = 20) {
    const { sql, params } = this.createFullTextSearchQuery(table, columns, searchTerm);
    const countSql = `SELECT COUNT(*) as count FROM ${table} WHERE ${Array.isArray(columns) 
      ? columns.map(col => `${col} LIKE ?`).join(' OR ')
      : `${columns} LIKE ?`}`;
    
    return await this.executePagingQuery(sql, countSql, params, page, pageSize);
  }
  
  /**
   * Analyze a query and provide optimization suggestions
   */
  async analyzeQuery(sql, params = []) {
    try {
      const explainResult = await databaseService.query(`EXPLAIN QUERY PLAN ${sql}`, params);
      
      // Parse the explain query plan
      const analysis = {
        usesIndexes: false,
        tableScan: false,
        suggestedIndexes: [],
        explanation: explainResult
      };
      
      // Analyze the query plan
      for (const row of explainResult) {
        const detail = row.detail.toLowerCase();
        
        if (detail.includes('using index')) {
          analysis.usesIndexes = true;
        }
        
        if (detail.includes('scan') && !detail.includes('index')) {
          analysis.tableScan = true;
          
          // Extract potential column to index
          const matches = detail.match(/scan table ([^\s]+) using ([^\s]+)/i);
          if (matches && matches.length >= 3) {
            const table = matches[1];
            const column = matches[2];
            analysis.suggestedIndexes.push({ table, column });
          }
        }
      }
      
      return {
        success: true,
        analysis
      };
    } catch (error) {
      console.error('Failed to analyze query:', error);
      return { success: false, error };
    }
  }
}

export default new DatabaseQueryOptimizer(); 