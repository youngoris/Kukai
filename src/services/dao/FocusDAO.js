import { BaseDAO } from './BaseDAO';

export class FocusDAO extends BaseDAO {
  constructor() {
    super('focus_sessions');
  }

  async createSession(session) {
    const data = {
      id: session.id,
      duration: session.duration,
      task_id: session.taskId || null,
      start_time: session.startTime,
      end_time: session.endTime || null,
      completed: session.completed ? 1 : 0,
      interruptions: session.interruptions || 0,
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

  async getSessionsByTask(taskId) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE task_id = ? 
       ORDER BY start_time DESC`,
      [taskId]
    );
  }

  async getCompletedSessions() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE completed = 1 
       ORDER BY start_time DESC`
    );
  }

  async getFocusStatistics(startDate, endDate) {
    return await this.query(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration,
        SUM(interruptions) as total_interruptions,
        AVG(interruptions) as average_interruptions,
        COUNT(DISTINCT DATE(start_time)) as days_with_focus
      FROM ${this.tableName}
      WHERE start_time BETWEEN ? AND ?
    `, [startDate.toISOString(), endDate.toISOString()]);
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
        SUM(interruptions) as total_interruptions,
        AVG(interruptions) as average_interruptions,
        COUNT(DISTINCT DATE(start_time)) as days_with_focus,
        COUNT(DISTINCT task_id) as unique_tasks
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
      focus_days AS (
        SELECT DISTINCT DATE(start_time) as focus_date
        FROM ${this.tableName}
        WHERE completed = 1
      )
      SELECT 
        d.date,
        CASE WHEN fd.focus_date IS NOT NULL THEN 1 ELSE 0 END as has_focus
      FROM dates d
      LEFT JOIN focus_days fd ON d.date = fd.focus_date
      ORDER BY d.date
    `);
  }

  async getTaskFocusDistribution(taskId) {
    return await this.query(`
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as sessions,
        SUM(duration) as total_duration,
        AVG(duration) as average_duration,
        SUM(interruptions) as total_interruptions
      FROM ${this.tableName}
      WHERE task_id = ?
      GROUP BY DATE(start_time)
      ORDER BY date DESC
    `, [taskId]);
  }
} 