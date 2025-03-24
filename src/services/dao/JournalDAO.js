/**
 * JournalDAO - Data Access Object for journal entries
 * Provides journal-specific database operations
 */
import BaseDAO from './BaseDAO';

class JournalDAO extends BaseDAO {
  constructor() {
    super('journal_entries');
  }

  /**
   * Create a new journal entry
   * @param {Object} entry - Journal entry data
   * @returns {Promise<Object>} Result with insertId on success
   */
  async createEntry(entry) {
    const data = {
      id: entry.id,
      content: entry.content,
      mood: entry.mood || null,
      tags: entry.tags || null,
      timestamp: entry.timestamp || new Date().toISOString(),
      weather: entry.weather || null,
      location: entry.location || null,
      template_id: entry.templateId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return await this.create(data);
  }

  /**
   * Update a journal entry
   * @param {string} id - Entry ID
   * @param {Object} updates - Updated entry data
   * @returns {Promise<Object>} Result object
   */
  async updateEntry(id, updates) {
    const data = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await this.update(id, data);
  }

  /**
   * Get entries by date
   * @param {Date} date - Target date
   * @returns {Promise<Array>} Journal entries for the date
   */
  async getEntriesByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE timestamp BETWEEN ? AND ? 
       ORDER BY timestamp DESC`,
      [startOfDay.toISOString(), endOfDay.toISOString()]
    );
  }

  /**
   * Get entries by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Journal entries in the date range
   */
  async getEntriesByDateRange(startDate, endDate) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE timestamp BETWEEN ? AND ? 
       ORDER BY timestamp DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  /**
   * Search entries by content
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching journal entries
   */
  async searchEntries(searchTerm) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE content LIKE ? 
       ORDER BY timestamp DESC`,
      [`%${searchTerm}%`]
    );
  }

  /**
   * Get entries by mood
   * @param {string} mood - Mood to filter by
   * @returns {Promise<Array>} Journal entries with the specified mood
   */
  async getEntriesByMood(mood) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE mood = ? 
       ORDER BY timestamp DESC`,
      [mood]
    );
  }

  /**
   * Get entries by template
   * @param {string} templateId - Template ID
   * @returns {Promise<Array>} Journal entries using the specified template
   */
  async getEntriesByTemplate(templateId) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE template_id = ? 
       ORDER BY timestamp DESC`,
      [templateId]
    );
  }

  /**
   * Calculate weekly streak
   * @returns {Promise<Array>} Weekly journal writing streak data
   */
  async getWeeklyStreak() {
    return await this.query(`
      WITH RECURSIVE dates AS (
        SELECT date('now', '-6 days') as date
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now')
      ),
      journal_days AS (
        SELECT DISTINCT DATE(timestamp) as journal_date
        FROM ${this.tableName}
      )
      SELECT 
        d.date,
        CASE WHEN j.journal_date IS NOT NULL THEN 1 ELSE 0 END as has_entry
      FROM dates d
      LEFT JOIN journal_days j ON d.date = j.journal_date
      ORDER BY d.date
    `);
  }

  /**
   * Get journal statistics
   * @returns {Promise<Object>} Journal usage statistics
   */
  async getJournalStatistics() {
    const counts = await this.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT DATE(timestamp)) as total_days,
        COUNT(DISTINCT mood) as mood_variety,
        AVG(LENGTH(content)) as avg_length,
        MAX(LENGTH(content)) as max_length,
        MIN(LENGTH(content)) as min_length
      FROM ${this.tableName}
    `);
    
    const moodDistribution = await this.query(`
      SELECT 
        mood, 
        COUNT(*) as count 
      FROM ${this.tableName} 
      WHERE mood IS NOT NULL 
      GROUP BY mood 
      ORDER BY count DESC
    `);
    
    const templateUsage = await this.query(`
      SELECT 
        template_id, 
        COUNT(*) as count 
      FROM ${this.tableName} 
      WHERE template_id IS NOT NULL 
      GROUP BY template_id 
      ORDER BY count DESC
    `);
    
    return {
      counts: counts[0],
      moodDistribution,
      templateUsage
    };
  }
}

// Export singleton instance
export default new JournalDAO(); 