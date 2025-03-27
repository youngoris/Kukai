/**
 * TaskDAO - Data Access Object for Tasks
 * 
 * Provides methods to interact with the tasks table in the SQLite database
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

class TaskDAO {
  constructor(dbName = 'kukai.db') {
    this.dbName = dbName;
    this.db = null;
  }

  /**
   * Initialize the TaskDAO
   * @returns {Promise<boolean>} Success indicator
   */
  async initialize() {
    try {
      // Ensure the SQLite directory exists
      const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      
      if (!dirInfo.exists) {
        console.log("Creating SQLite directory...");
        await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
      }
      
      // Specify full path to database file
      const dbPath = `${sqliteDir}/${this.dbName}`;
      console.log(`Opening database at: ${dbPath}`);
      
      // Open the database with proper error handling
      try {
        this.db = await SQLite.openDatabaseAsync(this.dbName);
        console.log('Database opened successfully using openDatabaseAsync');
      } catch (error) {
        console.error('Failed to open database:', error);
        
        // Try with full path if standard path fails
        try {
          console.log('Trying to open database with full path');
          this.db = await SQLite.openDatabaseAsync(dbPath);
          console.log('Database opened successfully using full path');
        } catch (error) {
          console.error('Failed to open database with full path:', error);
          throw new Error('Cannot open database: ' + error.message);
        }
      }
      
      if (!this.db) {
        throw new Error('Database connection could not be established');
      }
      
      // Create tables if they don't exist
      await this.createTables();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize TaskDAO:', error);
      return false;
    }
  }

  /**
   * Create necessary tables if they don't exist
   * @private
   */
  async createTables() {
    try {
      console.log("Starting table creation/verification");
      
      // First check if table exists using the exec method
      let tables = [];
      try {
        const tablesResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        // Extract table names from the result, being careful if result is undefined
        tables = tablesResult && tablesResult.rows && tablesResult.rows._array 
          ? tablesResult.rows._array.map(t => t.name) 
          : [];
        console.log('Existing tables:', tables);
      } catch (err) {
        console.error("Error fetching tables:", err);
        tables = []; // Default to empty array on error
      }
      
      const tableExists = tables.includes('tasks');
      
      if (!tableExists) {
        console.log("Creating new tasks table...");
        // Create tasks table
        try {
          // Create tasks table with single transaction (no indices yet)
          await this.db.execAsync(`
            BEGIN TRANSACTION;
            
            CREATE TABLE IF NOT EXISTS tasks (
              id TEXT PRIMARY KEY,
              text TEXT NOT NULL,
              description TEXT,
              completed INTEGER DEFAULT 0,
              completed_at TIMESTAMP,
              is_frog INTEGER DEFAULT 0,
              is_important INTEGER DEFAULT 0, 
              is_urgent INTEGER DEFAULT 0,
              is_time_tagged INTEGER DEFAULT 0,
              task_time TIMESTAMP,
              has_reminder INTEGER DEFAULT 0,
              reminder_time INTEGER DEFAULT 15,
              notify_at_deadline INTEGER DEFAULT 1,
              category_id TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS tomorrow_tasks (
              id TEXT PRIMARY KEY,
              task_id TEXT NOT NULL,
              sort_order INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            
            COMMIT;
          `);
          console.log("Tables created successfully");
          
          // Add a small delay before creating indices to ensure tables are fully created
          setTimeout(async () => {
            try {
              // Then create indices separately after tables are confirmed
              await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)`);
              await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_is_frog ON tasks(is_frog)`);
              await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(task_time)`);
              await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tomorrow_tasks ON tomorrow_tasks(task_id)`);
              console.log("Indices created successfully");
            } catch (indexError) {
              console.error("Error creating indices:", indexError);
            }
          }, 100);
        } catch (err) {
          console.error("Error creating tables:", err);
          // Re-throw to be caught by the outer try/catch
          throw err;
        }
      } else {
        // Table exists, check for required columns and add them if missing
        try {
          // Get existing columns in tasks table
          let columnNames = [];
          try {
            const taskColumnsResult = await this.db.execAsync("PRAGMA table_info(tasks)");
            columnNames = taskColumnsResult && taskColumnsResult.rows && taskColumnsResult.rows._array 
              ? taskColumnsResult.rows._array.map(col => col.name) 
              : [];
            console.log("Existing task table columns:", columnNames.join(", "));
          } catch (err) {
            console.error("Error getting task columns:", err);
            columnNames = []; // Default to empty array on error
          }
          
          const columnsToAdd = [
            { name: 'task_time', type: 'TIMESTAMP', defaultValue: null },
            { name: 'is_time_tagged', type: 'INTEGER', defaultValue: 0 },
            { name: 'is_frog', type: 'INTEGER', defaultValue: 0 },
            { name: 'is_important', type: 'INTEGER', defaultValue: 0 },
            { name: 'is_urgent', type: 'INTEGER', defaultValue: 0 },
            { name: 'has_reminder', type: 'INTEGER', defaultValue: 0 },
            { name: 'reminder_time', type: 'INTEGER', defaultValue: 15 },
            { name: 'notify_at_deadline', type: 'INTEGER', defaultValue: 1 },
          ];
          
          // Add any missing columns
          for (const column of columnsToAdd) {
            if (!columnNames.includes(column.name)) {
              try {
                let defaultClause = column.defaultValue === null ? '' : `DEFAULT ${column.defaultValue}`;
                await this.db.execAsync(`ALTER TABLE tasks ADD COLUMN ${column.name} ${column.type} ${defaultClause}`);
                console.log(`Added missing ${column.name} column to tasks table`);
              } catch (e) {
                // Log error but continue with other columns
                console.error(`Error adding column ${column.name}:`, e);
              }
            }
          }
        } catch (error) {
          console.error("Error checking task table columns:", error);
        }

        // Check if tomorrow_tasks table exists
        const tomorrowTableExists = tables.includes('tomorrow_tasks');
        
        if (!tomorrowTableExists) {
          console.log("Creating tomorrow_tasks table...");
          try {
            await this.db.execAsync(`
              CREATE TABLE IF NOT EXISTS tomorrow_tasks (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
              );
              
              CREATE INDEX IF NOT EXISTS idx_tomorrow_tasks ON tomorrow_tasks(task_id);
            `);
            console.log("Tomorrow_tasks table created");
          } catch (err) {
            console.error("Error creating tomorrow_tasks table:", err);
          }
        }
      }
      
      console.log("Table creation/verification completed successfully");
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  /**
   * Get all tasks
   * @returns {Promise<Array>} List of all tasks
   */
  async getAllTasks() {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      console.log("Retrieving all tasks");
      
      // Get columns first to construct a safe query
      let columnNames = [];
      try {
        const taskColumnsResult = await this.db.execAsync("PRAGMA table_info(tasks)");
        columnNames = taskColumnsResult && taskColumnsResult.rows && taskColumnsResult.rows._array 
          ? taskColumnsResult.rows._array.map(col => col.name) 
          : [];
        console.log("Task columns for query:", columnNames.join(", "));
      } catch (err) {
        console.error("Error getting task columns for query:", err);
      }
      
      // Build a query that only uses existing columns
      let query = "SELECT * FROM tasks";
      
      // Add ORDER BY clause based on available columns
      let orderClauses = [];
      if (columnNames.includes('completed')) orderClauses.push("completed ASC");
      if (columnNames.includes('is_frog')) orderClauses.push("is_frog DESC");
      if (columnNames.includes('is_urgent')) orderClauses.push("is_urgent DESC");
      if (columnNames.includes('is_important')) orderClauses.push("is_important DESC");
      
      // For task_time, handle NULLS LAST compatibility
      if (columnNames.includes('task_time')) {
        // Some SQLite versions don't support NULLS LAST syntax
        try {
          orderClauses.push("task_time ASC NULLS LAST");
        } catch (e) {
          // If NULLS LAST isn't supported, use CASE expression
          orderClauses.push("CASE WHEN task_time IS NULL THEN 1 ELSE 0 END, task_time ASC");
        }
      }
      
      if (columnNames.includes('created_at')) orderClauses.push("created_at DESC");
      
      if (orderClauses.length > 0) {
        query += " ORDER BY " + orderClauses.join(", ");
      }
      
      try {
        const result = await this.db.execAsync(query);
        const rows = result && result.rows && result.rows._array ? result.rows._array : [];
        console.log(`Retrieved ${rows.length} tasks`);
        return rows.map(row => this._convertRowToTask(row));
      } catch (err) {
        console.error("Error executing tasks query:", err);
        return [];
      }
    } catch (error) {
      console.error('Failed to get all tasks:', error);
      // Return empty array instead of throwing to avoid crashes
      return [];
    }
  }

  /**
   * Get a single task by ID
   * @param {string} id Task ID
   * @returns {Promise<Object|null>} Task object or null
   */
  async getTaskById(id) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      try {
        const result = await this.db.execAsync('SELECT * FROM tasks WHERE id = ?', [id]);
        const row = result && result.rows && result.rows._array && result.rows._array.length > 0 
          ? result.rows._array[0] 
          : null;
        return row ? this._convertRowToTask(row) : null;
      } catch (err) {
        console.error(`Error getting task by ID ${id}:`, err);
        return null;
      }
    } catch (error) {
      console.error('Failed to get task by ID:', error);
      return null;
    }
  }

  /**
   * Create a new task
   * @param {Object} task Task object
   * @returns {Promise<Object>} Created task with ID
   */
  async createTask(task) {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // Generate ID if not provided
      const taskWithId = {
        ...task,
        id: task.id || Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await this.db.runAsync(
        `INSERT INTO tasks (
          id, text, description, completed, completed_at, 
          is_frog, is_important, is_urgent, is_time_tagged, 
          task_time, has_reminder, reminder_time, notify_at_deadline, 
          category_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskWithId.id,
          taskWithId.text,
          taskWithId.description || null,
          taskWithId.completed ? 1 : 0,
          taskWithId.completedAt || null,
          taskWithId.isFrog ? 1 : 0,
          taskWithId.isImportant ? 1 : 0,
          taskWithId.isUrgent ? 1 : 0,
          taskWithId.isTimeTagged ? 1 : 0,
          taskWithId.taskTime || null,
          taskWithId.hasReminder ? 1 : 0,
          taskWithId.reminderTime || 15,
          taskWithId.notifyAtDeadline ? 1 : 0,
          taskWithId.categoryId || null,
          taskWithId.created_at,
          taskWithId.updated_at
        ]
      );
      
      return this._convertTaskForClient(taskWithId);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Update an existing task
   * @param {string} id Task ID
   * @param {Object} updates Task updates
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(id, updates) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      console.log(`Updating task: ${id}`);
      
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Build the SQL query dynamically based on the fields to update
      const fields = Object.keys(updatesWithTimestamp)
        .filter(key => key !== 'id') // Exclude ID from updates
        .map(key => {
          // Convert camelCase to snake_case for database fields
          const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          return `${dbField} = ?`;
        });

      // Get values for the SQL query
      const values = Object.keys(updatesWithTimestamp)
        .filter(key => key !== 'id')
        .map(key => {
          const value = updatesWithTimestamp[key];
          // Convert boolean values to integers
          if (typeof value === 'boolean') {
            return value ? 1 : 0;
          }
          return value;
        });

      // Add ID to the values array for the WHERE clause
      values.push(id);

      try {
        await this.db.runAsync(
          `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        
        // Get the updated task
        return await this.getTaskById(id);
      } catch (err) {
        console.error(`Error updating task ${id}:`, err);
        throw err;
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param {string} id Task ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteTask(id) {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // Delete from tomorrow_tasks first
      await this.db.runAsync('DELETE FROM tomorrow_tasks WHERE task_id = ?', [id]);
      
      // Then delete the main task
      await this.db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
      
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      return false;
    }
  }

  /**
   * Get tasks scheduled for tomorrow
   * @returns {Promise<Array>} List of tomorrow's tasks
   */
  async getTomorrowTasks() {
    try {
      if (!this.db) {
        await this.initialize();
      }

      console.log("Retrieving tomorrow tasks");
      
      try {
        const result = await this.db.execAsync(`
          SELECT t.*, tt.sort_order 
          FROM tasks t 
          INNER JOIN tomorrow_tasks tt ON t.id = tt.task_id
          ORDER BY tt.sort_order ASC
        `);
        
        const rows = result && result.rows && result.rows._array ? result.rows._array : [];
        console.log(`Retrieved ${rows.length} tomorrow tasks`);
        return rows.map(row => this._convertRowToTask(row));
      } catch (err) {
        console.error("Error executing tomorrow tasks query:", err);
        return [];
      }
    } catch (error) {
      console.error('Failed to get tomorrow tasks:', error);
      return [];
    }
  }

  /**
   * Add task to tomorrow's tasks
   * @param {string} taskId Task ID
   * @param {number} sortOrder Sort order (optional)
   * @returns {Promise<boolean>} Success indicator
   */
  async addTaskToTomorrow(taskId, sortOrder = null) {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // Get the current highest sort order if not provided
      let newSortOrder = sortOrder;
      if (newSortOrder === null) {
        try {
          const sortResult = await this.db.execAsync('SELECT MAX(sort_order) as max_sort FROM tomorrow_tasks');
          const maxSort = sortResult && sortResult.rows && sortResult.rows._array && sortResult.rows._array.length > 0 
            ? (sortResult.rows._array[0].max_sort || 0) 
            : 0;
          newSortOrder = maxSort + 1;
        } catch (err) {
          console.error("Error getting max sort order:", err);
          newSortOrder = 0; // Default to 0 on error
        }
      }
      
      // Insert the task into tomorrow_tasks
      try {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO tomorrow_tasks (
            id, task_id, sort_order, created_at
          ) VALUES (?, ?, ?, ?)`,
          [
            `tomorrow_${taskId}`,
            taskId,
            newSortOrder,
            new Date().toISOString()
          ]
        );
        return true;
      } catch (err) {
        console.error(`Error adding task ${taskId} to tomorrow:`, err);
        return false;
      }
    } catch (error) {
      console.error('Failed to add task to tomorrow:', error);
      return false;
    }
  }

  /**
   * Remove task from tomorrow's tasks
   * @param {string} taskId Task ID
   * @returns {Promise<boolean>} Success indicator
   */
  async removeTaskFromTomorrow(taskId) {
    try {
      await this.db.runAsync('DELETE FROM tomorrow_tasks WHERE task_id = ?', [taskId]);
      return true;
    } catch (error) {
      console.error('Failed to remove task from tomorrow:', error);
      return false;
    }
  }

  /**
   * Update sort order of tomorrow tasks
   * @param {Array} taskIds Array of task IDs in desired order
   * @returns {Promise<boolean>} Success indicator
   */
  async updateTomorrowTasksOrder(taskIds) {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // We'll use execAsync with a batch of UPDATE statements
      let updateQuery = '';
      
      for (let i = 0; i < taskIds.length; i++) {
        updateQuery += `UPDATE tomorrow_tasks SET sort_order = ${i} WHERE task_id = '${taskIds[i]}';`;
      }
      
      if (updateQuery) {
        await this.db.execAsync(updateQuery);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to update tomorrow tasks order:', error);
      return false;
    }
  }

  /**
   * Get task statistics
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStats() {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      console.log("Retrieving task statistics");
      
      // Get total task count
      let total = 0;
      let completed = 0;
      let priorityRow = { frog_count: 0, urgent_count: 0, important_count: 0 };
      let dailyCompletions = [];
      let todayCount = 0;
      
      try {
        const totalResult = await this.db.execAsync('SELECT COUNT(*) as total FROM tasks');
        total = totalResult && totalResult.rows && totalResult.rows._array && totalResult.rows._array.length > 0 
          ? totalResult.rows._array[0].total 
          : 0;
        
        const completedResult = await this.db.execAsync('SELECT COUNT(*) as completed FROM tasks WHERE completed = 1');
        completed = completedResult && completedResult.rows && completedResult.rows._array && completedResult.rows._array.length > 0 
          ? completedResult.rows._array[0].completed 
          : 0;
        
        // Get counts by priority
        const priorityResult = await this.db.execAsync(`
          SELECT 
            SUM(CASE WHEN is_frog = 1 THEN 1 ELSE 0 END) as frog_count,
            SUM(CASE WHEN is_urgent = 1 THEN 1 ELSE 0 END) as urgent_count,
            SUM(CASE WHEN is_important = 1 THEN 1 ELSE 0 END) as important_count
          FROM tasks
        `);
        
        priorityRow = priorityResult && priorityResult.rows && priorityResult.rows._array && priorityResult.rows._array.length > 0 
          ? priorityResult.rows._array[0] 
          : { frog_count: 0, urgent_count: 0, important_count: 0 };
        
        // Get completion rate by day for the last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const dailyCompletionResult = await this.db.execAsync(`
          SELECT 
            date(completed_at) as completion_date,
            COUNT(*) as count
          FROM tasks 
          WHERE 
            completed = 1 AND
            completed_at >= ?
          GROUP BY date(completed_at)
          ORDER BY completion_date ASC
        `, [oneWeekAgo.toISOString()]);
        
        dailyCompletions = dailyCompletionResult && dailyCompletionResult.rows && dailyCompletionResult.rows._array 
          ? dailyCompletionResult.rows._array.map(row => ({
              date: row.completion_date,
              count: row.count
            }))
          : [];
        
        // Calculate today's tasks
        const today = new Date().toISOString().split('T')[0];
        const todayResult = await this.db.execAsync(`
          SELECT COUNT(*) as today_count
          FROM tasks
          WHERE 
            date(created_at) = ? OR
            date(task_time) = ?
        `, [today, today]);
        
        todayCount = todayResult && todayResult.rows && todayResult.rows._array && todayResult.rows._array.length > 0 
          ? todayResult.rows._array[0].today_count 
          : 0;
      } catch (err) {
        console.error("Error getting task statistics:", err);
      }
      
      // Calculate completion rate
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      
      return {
        total,
        completed,
        pending: total - completed,
        completionRate,
        priorityCounts: {
          frog: priorityRow.frog_count || 0,
          urgent: priorityRow.urgent_count || 0,
          important: priorityRow.important_count || 0
        },
        dailyCompletions,
        todayCount
      };
    } catch (error) {
      console.error('Failed to get task stats:', error);
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionRate: 0,
        priorityCounts: { frog: 0, urgent: 0, important: 0 },
        dailyCompletions: [],
        todayCount: 0
      };
    }
  }

  /**
   * Get total task count
   * @returns {Promise<number>} Total task count
   */
  async count() {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      try {
        const result = await this.db.execAsync('SELECT COUNT(*) as count FROM tasks');
        return result && result.rows && result.rows._array && result.rows._array.length > 0 
          ? result.rows._array[0].count 
          : 0;
      } catch (err) {
        console.error("Error getting task count:", err);
        return 0;
      }
    } catch (error) {
      console.error('Failed to get task count:', error);
      return 0;
    }
  }

  /**
   * Convert a database row to a task object with JavaScript-friendly property names
   * @param {Object} row Database row
   * @returns {Object} Task object
   * @private
   */
  _convertRowToTask(row) {
    const task = {
      id: row.id,
      text: row.text,
      description: row.description,
      completed: !!row.completed,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    // Add optional properties only if they exist in the row
    if ('is_frog' in row) task.isFrog = !!row.is_frog;
    if ('is_important' in row) task.isImportant = !!row.is_important;
    if ('is_urgent' in row) task.isUrgent = !!row.is_urgent;
    if ('is_time_tagged' in row) task.isTimeTagged = !!row.is_time_tagged;
    if ('task_time' in row) task.taskTime = row.task_time;
    if ('has_reminder' in row) task.hasReminder = !!row.has_reminder;
    if ('reminder_time' in row) task.reminderTime = row.reminder_time;
    if ('notify_at_deadline' in row) task.notifyAtDeadline = !!row.notify_at_deadline;
    if ('category_id' in row) task.categoryId = row.category_id;
    if ('sort_order' in row) task.sortOrder = row.sort_order;
    
    return task;
  }

  /**
   * Convert a task object to the format expected by the client
   * @param {Object} task Task object
   * @returns {Object} Client-friendly task object
   * @private
   */
  _convertTaskForClient(task) {
    const result = {
      id: task.id,
      text: task.text,
      description: task.description,
      completed: task.completed === 1 || !!task.completed,
      createdAt: task.created_at || task.createdAt,
      updatedAt: task.updated_at || task.updatedAt
    };
    
    // Add completedAt if it exists
    if (task.completed_at || task.completedAt) {
      result.completedAt = task.completed_at || task.completedAt;
    }
    
    // Handle task properties conversion with existence checks
    if ('is_frog' in task || 'isFrog' in task) 
      result.isFrog = task.is_frog === 1 || !!task.isFrog;
    
    if ('is_important' in task || 'isImportant' in task) 
      result.isImportant = task.is_important === 1 || !!task.isImportant;
    
    if ('is_urgent' in task || 'isUrgent' in task) 
      result.isUrgent = task.is_urgent === 1 || !!task.isUrgent;
    
    if ('is_time_tagged' in task || 'isTimeTagged' in task) 
      result.isTimeTagged = task.is_time_tagged === 1 || !!task.isTimeTagged;
    
    if ('task_time' in task || 'taskTime' in task)
      result.taskTime = task.task_time || task.taskTime;
    
    if ('has_reminder' in task || 'hasReminder' in task)
      result.hasReminder = task.has_reminder === 1 || !!task.hasReminder;
    
    if ('reminder_time' in task || 'reminderTime' in task)
      result.reminderTime = task.reminder_time || task.reminderTime || 15;
    
    if ('notify_at_deadline' in task || 'notifyAtDeadline' in task)
      result.notifyAtDeadline = task.notify_at_deadline === 1 || !!task.notifyAtDeadline;
    
    if ('category_id' in task || 'categoryId' in task)
      result.categoryId = task.category_id || task.categoryId;
    
    return result;
  }
}

export default new TaskDAO();