/**
 * FocusDAO - Data Access Object for focus/pomodoro sessions
 * Provides focus-specific database operations
 */
import BaseDAO from './BaseDAO';

class FocusDAO extends BaseDAO {
  constructor() {
    super('focus_sessions');
  }

  /**
   * Create a new focus session
   * @param {Object} session - Focus session data
   * @returns {Promise<Object>} Result with insertId on success
   */
  async createSession(session) {
    const data = {
      id: session.id,
      duration: session.duration || 0,
      break_duration: session.breakDuration || 0,
      task_id: session.taskId || null,
      start_time: session.startTime || new Date().toISOString(),
      end_time: session.endTime || null,
      completed: session.completed ? 1 : 0,
      interrupted: session.interrupted ? 1 : 0,
      interruption_count: session.interruptionCount || 0,
      pomodoro_count: session.pomodoroCount || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return await this.create(data);
  }

  /**
   * Update a focus session
   * @param {string} id - Session ID
   * @param {Object} updates - Updated session data
   * @returns {Promise<Object>} Result object
   */
  async updateSession(id, updates) {
    const data = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await this.update(id, data);
  }

  /**
   * Mark a focus session as completed
   * @param {string} id - Session ID
   * @param {Object} sessionData - Completion data
   * @returns {Promise<Object>} Result object
   */
  async completeSession(id, sessionData = {}) {
    return await this.update(id, {
      completed: 1,
      end_time: sessionData.endTime || new Date().toISOString(),
      interruption_count: sessionData.interruptionCount,
      pomodoro_count: sessionData.pomodoroCount,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Get sessions by date
   * @param {Date} date - Target date
   * @returns {Promise<Array>} Focus sessions for the date
   */
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

  /**
   * Get sessions by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Focus sessions in the date range
   */
  async getSessionsByDateRange(startDate, endDate) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE start_time BETWEEN ? AND ? 
       ORDER BY start_time DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  /**
   * Get completed sessions
   * @returns {Promise<Array>} Completed focus sessions
   */
  async getCompletedSessions() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE completed = 1 
       ORDER BY start_time DESC`
    );
  }

  /**
   * Get sessions by task
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} Focus sessions for the task
   */
  async getSessionsByTask(taskId) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE task_id = ? 
       ORDER BY start_time DESC`,
      [taskId]
    );
  }

  /**
   * Get focus statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Focus statistics
   */
  async getFocusStatistics(startDate, endDate) {
    const stats = await this.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration,
        COUNT(DISTINCT DATE(start_time)) as days_with_focus,
        SUM(pomodoro_count) as total_pomodoros,
        SUM(interruption_count) as total_interruptions
      FROM ${this.tableName}
      WHERE start_time BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
    
    return stats[0];
  }

  /**
   * Get daily focus time
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<Array>} Daily focus time data
   */
  async getDailyFocusTime(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    return await this.query(`
      WITH RECURSIVE dates AS (
        SELECT date('now', '-${days-1} days') as date
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now')
      )
      SELECT 
        d.date,
        COALESCE(SUM(f.duration), 0) as total_duration,
        COUNT(f.id) as session_count
      FROM dates d
      LEFT JOIN ${this.tableName} f ON DATE(f.start_time) = d.date AND f.completed = 1
      GROUP BY d.date
      ORDER BY d.date
    `);
  }

  /**
   * Get task focus distribution
   * @returns {Promise<Array>} Task focus distribution data
   */
  async getTaskFocusDistribution() {
    return await this.query(`
      SELECT 
        t.id as task_id,
        t.title as task_title,
        COUNT(f.id) as session_count,
        SUM(f.duration) as total_duration,
        AVG(f.duration) as average_duration
      FROM ${this.tableName} f
      JOIN tasks t ON f.task_id = t.id
      WHERE f.completed = 1
      GROUP BY f.task_id
      ORDER BY total_duration DESC
      LIMIT 10
    `);
  }

  /**
   * Get weekly productivity pattern
   * @returns {Promise<Array>} Weekly productivity pattern data
   */
  async getWeeklyProductivityPattern() {
    return await this.query(`
      SELECT 
        strftime('%w', start_time) as day_of_week,
        COUNT(*) as session_count,
        SUM(duration) as total_duration,
        SUM(pomodoro_count) as total_pomodoros
      FROM ${this.tableName}
      WHERE completed = 1
      GROUP BY day_of_week
      ORDER BY day_of_week
    `);
  }

  /**
   * Get time of day productivity pattern
   * @returns {Promise<Array>} Time of day productivity pattern data
   */
  async getTimeOfDayProductivity() {
    return await this.query(`
      SELECT 
        CASE
          WHEN strftime('%H', start_time) BETWEEN '05' AND '11' THEN 'morning'
          WHEN strftime('%H', start_time) BETWEEN '12' AND '16' THEN 'afternoon'
          WHEN strftime('%H', start_time) BETWEEN '17' AND '21' THEN 'evening'
          ELSE 'night'
        END as time_of_day,
        COUNT(*) as session_count,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration
      FROM ${this.tableName}
      WHERE completed = 1
      GROUP BY time_of_day
      ORDER BY total_duration DESC
    `);
  }
}

// Export singleton instance
export default new FocusDAO(); 