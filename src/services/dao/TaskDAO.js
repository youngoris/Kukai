/**
 * TaskDAO - Data Access Object for tasks
 * Provides task-specific database operations
 */
import BaseDAO from './BaseDAO';

class TaskDAO extends BaseDAO {
  /**
   * Create task DAO
   */
  constructor() {
    super('tasks');
  }

  /**
   * Find important tasks
   * @returns {Promise<Array>} Important tasks sorted by due date
   */
  async findImportantTasks() {
    return await this.query(
      'SELECT * FROM tasks WHERE is_important = 1 ORDER BY due_date'
    );
  }

  /**
   * Find tasks due today
   * @returns {Promise<Array>} Tasks due today
   */
  async findTasksDueToday() {
    const today = new Date().toISOString().split('T')[0];
    return await this.query(
      'SELECT * FROM tasks WHERE date(due_date) = ? ORDER BY priority DESC',
      [today]
    );
  }

  /**
   * Find tasks by category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Array>} Tasks in the category
   */
  async findByCategory(categoryId) {
    return await this.query(
      'SELECT * FROM tasks WHERE category_id = ? ORDER BY due_date, priority DESC',
      [categoryId]
    );
  }

  /**
   * Find pending tasks (not completed)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pending tasks
   */
  async findPendingTasks(options = {}) {
    let sql = 'SELECT * FROM tasks WHERE completed = 0';
    const params = [];
    
    if (options.categoryId) {
      sql += ' AND category_id = ?';
      params.push(options.categoryId);
    }
    
    if (options.priorityAbove) {
      sql += ' AND priority >= ?';
      params.push(options.priorityAbove);
    }
    
    sql += ' ORDER BY ';
    sql += options.orderBy || 'due_date, priority DESC';
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    return await this.query(sql, params);
  }

  /**
   * Find frog tasks (most important/difficult tasks)
   * @returns {Promise<Array>} Frog tasks
   */
  async findFrogTasks() {
    return await this.query(
      'SELECT * FROM tasks WHERE is_frog = 1 AND completed = 0 ORDER BY due_date'
    );
  }

  /**
   * Mark task as completed
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Result object
   */
  async completeTask(id) {
    return await this.update(id, {
      completed: 1,
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Calculate task statistics
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStats() {
    const today = new Date().toISOString().split('T')[0];
    
    // Get counts using a single query for better performance
    const results = await this.query(`
      SELECT
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN date(due_date) = ? AND completed = 0 THEN 1 ELSE 0 END) AS due_today_count,
        SUM(CASE WHEN date(due_date) < ? AND completed = 0 THEN 1 ELSE 0 END) AS overdue_count,
        SUM(CASE WHEN is_frog = 1 AND completed = 0 THEN 1 ELSE 0 END) AS frog_count,
        SUM(CASE WHEN is_important = 1 AND completed = 0 THEN 1 ELSE 0 END) AS important_count
      FROM tasks
    `, [today, today]);
    
    return results[0] || {
      completed_count: 0,
      pending_count: 0,
      due_today_count: 0,
      overdue_count: 0,
      frog_count: 0,
      important_count: 0
    };
  }
}

// Export singleton instance
export default new TaskDAO(); 