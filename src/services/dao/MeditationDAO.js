/**
 * MeditationDAO - Data Access Object for meditation sessions
 * Provides meditation-specific database operations
 */
import BaseDAO from './BaseDAO';

class MeditationDAO extends BaseDAO {
  constructor() {
    super('meditation_sessions');
  }

  /**
   * Create a new meditation session
   * @param {Object} session - Session data
   * @returns {Promise<Object>} Result with insertId on success
   */
  async createSession(session) {
    const data = {
      id: session.id,
      duration: session.duration,
      sound_theme: session.soundTheme || 'default',
      start_time: session.startTime,
      end_time: session.endTime || null,
      completed: session.completed ? 1 : 0,
      notes: session.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return await this.create(data);
  }

  async updateSession(id, updates) {
    const data = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await this.update(id, data);
  }

  async getSessionsByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE start_time BETWEEN ? AND ? 
       ORDER BY start_time DESC`,
      [startOfDay.toISOString(), endOfDay.toISOString()]
    );
  }

  async getSessionsByDateRange(startDate, endDate) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE start_time BETWEEN ? AND ? 
       ORDER BY start_time DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  async getCompletedSessions() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE completed = 1 
       ORDER BY start_time DESC`
    );
  }

  async getSessionsBySoundTheme(soundTheme) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE sound_theme = ? 
       ORDER BY start_time DESC`,
      [soundTheme]
    );
  }

  async getSessionsByDuration(duration) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE duration = ? 
       ORDER BY start_time DESC`,
      [duration]
    );
  }

  async getMeditationStatistics(startDate, endDate) {
    return await this.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration,
        COUNT(DISTINCT DATE(start_time)) as days_with_meditation
      FROM ${this.tableName}
      WHERE start_time BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
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
      meditation_days AS (
        SELECT DISTINCT DATE(start_time) as meditation_date
        FROM ${this.tableName}
        WHERE completed = 1
      )
      SELECT 
        d.date,
        CASE WHEN md.meditation_date IS NOT NULL THEN 1 ELSE 0 END as has_meditation
      FROM dates d
      LEFT JOIN meditation_days md ON d.date = md.meditation_date
      ORDER BY d.date
    `);
  }

  async getMonthlyStatistics(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return await this.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration,
        COUNT(DISTINCT DATE(start_time)) as days_with_meditation,
        GROUP_CONCAT(DISTINCT sound_theme) as used_themes
      FROM ${this.tableName}
      WHERE start_time BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
  }
}

// Export singleton instance
export default new MeditationDAO(); 