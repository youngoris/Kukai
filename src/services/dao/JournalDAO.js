import { BaseDAO } from './BaseDAO';

export class JournalDAO extends BaseDAO {
  constructor() {
    super('journal_entries');
  }

  async createEntry(entry) {
    const data = {
      id: entry.id,
      content: entry.content,
      mood: entry.mood || null,
      timestamp: entry.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return await this.create(data);
  }

  async updateEntry(id, updates) {
    const data = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await this.update(id, data);
  }

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

  async getEntriesByDateRange(startDate, endDate) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE timestamp BETWEEN ? AND ? 
       ORDER BY timestamp DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  async getEntriesByMood(mood) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE mood = ? 
       ORDER BY timestamp DESC`,
      [mood]
    );
  }

  async getJournalStatistics(startDate, endDate) {
    return await this.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT DATE(timestamp)) as days_with_entries,
        GROUP_CONCAT(DISTINCT mood) as moods_used,
        COUNT(DISTINCT mood) as unique_moods
      FROM ${this.tableName}
      WHERE timestamp BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
  }

  async getMoodDistribution(startDate, endDate) {
    return await this.query(`
      SELECT 
        mood,
        COUNT(*) as count
      FROM ${this.tableName}
      WHERE timestamp BETWEEN ? AND ?
        AND mood IS NOT NULL
      GROUP BY mood
      ORDER BY count DESC
    `, [startDate.toISOString(), endDate.toISOString()]);
  }

  async getMonthlyStatistics(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return await this.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT DATE(timestamp)) as days_with_entries,
        GROUP_CONCAT(DISTINCT mood) as moods_used,
        COUNT(DISTINCT mood) as unique_moods,
        AVG(LENGTH(content)) as average_entry_length
      FROM ${this.tableName}
      WHERE timestamp BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
  }

  async searchEntries(keyword) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE content LIKE ? 
       ORDER BY timestamp DESC`,
      [`%${keyword}%`]
    );
  }

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
        CASE WHEN jd.journal_date IS NOT NULL THEN 1 ELSE 0 END as has_entry
      FROM dates d
      LEFT JOIN journal_days jd ON d.date = jd.journal_date
      ORDER BY d.date
    `);
  }
} 