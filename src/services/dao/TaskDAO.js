import { BaseDAO } from './BaseDAO';

export class TaskDAO extends BaseDAO {
  constructor() {
    super('tasks');
  }

  async createTask(task) {
    const data = {
      id: task.id,
      title: task.text,
      description: task.description || null,
      due_date: task.taskTime || null,
      priority: task.priority || 0,
      completed: task.completed ? 1 : 0,
      is_frog: task.isFrog ? 1 : 0,
      is_important: task.isImportant ? 1 : 0,
      is_urgent: task.isUrgent ? 1 : 0,
      reminder_time: task.reminderTime || null,
      category_id: task.categoryId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return await this.create(data);
  }

  async updateTask(id, updates) {
    const data = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await this.update(id, data);
  }

  async getTasksByStatus(completed = false) {
    return await this.query(
      `SELECT * FROM ${this.tableName} WHERE completed = ? ORDER BY created_at DESC`,
      [completed ? 1 : 0]
    );
  }

  async getTasksByCategory(categoryId) {
    return await this.query(
      `SELECT * FROM ${this.tableName} WHERE category_id = ? ORDER BY created_at DESC`,
      [categoryId]
    );
  }

  async getTasksByDate(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE due_date BETWEEN ? AND ? 
       ORDER BY due_date ASC`,
      [startOfDay.toISOString(), endOfDay.toISOString()]
    );
  }

  async getFrogTasks() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE is_frog = 1 AND completed = 0 
       ORDER BY created_at ASC`
    );
  }

  async getImportantTasks() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE is_important = 1 AND completed = 0 
       ORDER BY due_date ASC`
    );
  }

  async getUrgentTasks() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE is_urgent = 1 AND completed = 0 
       ORDER BY due_date ASC`
    );
  }

  async getTasksWithReminders() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE reminder_time IS NOT NULL 
       AND completed = 0 
       ORDER BY due_date ASC`
    );
  }

  async getTasksByPriority() {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE completed = 0 
       ORDER BY 
         CASE 
           WHEN is_urgent = 1 THEN 1
           WHEN is_important = 1 THEN 2
           WHEN is_frog = 1 THEN 3
           ELSE 4
         END,
         due_date ASC`
    );
  }

  async getCompletedTasksByDateRange(startDate, endDate) {
    return await this.query(
      `SELECT * FROM ${this.tableName} 
       WHERE completed = 1 
       AND updated_at BETWEEN ? AND ? 
       ORDER BY updated_at DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
  }

  async getTaskStatistics() {
    const stats = await this.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN is_frog = 1 THEN 1 ELSE 0 END) as frog_tasks,
        SUM(CASE WHEN is_important = 1 THEN 1 ELSE 0 END) as important_tasks,
        SUM(CASE WHEN is_urgent = 1 THEN 1 ELSE 0 END) as urgent_tasks
      FROM ${this.tableName}
    `);
    return stats[0];
  }
} 