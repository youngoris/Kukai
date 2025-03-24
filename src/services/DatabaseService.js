import * as SQLite from 'expo-sqlite';
import { DatabaseMigrationService } from './DatabaseMigrationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import validationService from './validation/ValidationService';
import { handleDatabaseError, DatabaseErrorCodes, DatabaseError } from './errors/DatabaseError';

const DB_NAME = 'kukai.db';

// Map of table names to validation functions
const TABLE_VALIDATORS = {
  'tasks': validationService.validateTask.bind(validationService),
  'meditation_sessions': validationService.validateMeditationSession.bind(validationService),
  'journal_entries': validationService.validateJournalEntry.bind(validationService),
  'focus_sessions': validationService.validateFocusSession.bind(validationService),
  'categories': validationService.validateCategory.bind(validationService),
  'journal_templates': validationService.validateJournalTemplate.bind(validationService)
};

class DatabaseService {
  constructor() {
    this.db = null;
    this.migrationService = new DatabaseMigrationService();
    this.initialized = false;
  }

  // Open database connection
  async openDatabase() {
    if (!this.db) {
      try {
        // Use the modern SQLite API
        // This is compatible with the latest Expo SQLite version
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        console.log('Database connection opened');
      } catch (error) {
        console.error('Error opening database:', error);
        throw new DatabaseError(
          'Failed to open database',
          DatabaseErrorCodes.CONNECTION_ERROR,
          { operation: 'openDatabase', original: error }
        );
      }
    }
    return this.db;
  }

  async initialize() {
    if (this.initialized) {
      return { success: true };
    }

    try {
      // Open database
      this.db = await this.openDatabase();
      console.log('Database opened successfully');

      // Run migrations
      await this.migrationService.migrate();
      
      this.initialized = true;
      console.log('Database initialized successfully');
      return { success: true };
    } catch (error) {
      return handleDatabaseError(error, 'initialize');
    }
  }

  async migrateFromAsyncStorage() {
    try {
      // Check if migration has been done before
      const migrationDone = await AsyncStorage.getItem('@dbMigrationCompleted');
      if (migrationDone === 'true') {
        console.log('Data migration already completed');
        return { success: true };
      }

      console.log('Starting data migration from AsyncStorage to SQLite...');
      
      // Migrate meditation sessions
      const meditationSessions = await AsyncStorage.getItem('@meditationSessions');
      if (meditationSessions) {
        const sessions = JSON.parse(meditationSessions);
        for (const session of sessions) {
          await this.create('meditation_sessions', {
            id: session.id,
            duration: session.duration,
            sound_theme: session.soundTheme || 'default',
            start_time: session.startTime,
            end_time: session.endTime || null,
            completed: session.completed ? 1 : 0,
            notes: session.notes || null
          });
        }
        console.log(`Migrated ${sessions.length} meditation sessions`);
      }

      // Migrate tasks
      const tasks = await AsyncStorage.getItem('@tasks');
      if (tasks) {
        const taskList = JSON.parse(tasks);
        for (const task of taskList) {
          await this.create('tasks', {
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
            category_id: task.categoryId || null
          });
        }
        console.log(`Migrated ${taskList.length} tasks`);
      }

      // Migrate journal entries
      const journalEntries = await AsyncStorage.getItem('@journalEntries');
      if (journalEntries) {
        const entries = JSON.parse(journalEntries);
        for (const entry of entries) {
          await this.create('journal_entries', {
            id: entry.id,
            content: entry.content,
            mood: entry.mood || null,
            timestamp: entry.timestamp || new Date().toISOString()
          });
        }
        console.log(`Migrated ${entries.length} journal entries`);
      }

      // Mark migration as completed
      await AsyncStorage.setItem('@dbMigrationCompleted', 'true');
      console.log('Data migration completed successfully');
      return { success: true };
    } catch (error) {
      return handleDatabaseError(error, 'migrateFromAsyncStorage');
    }
  }

  async create(table, data) {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      // Validate data if validator exists for this table
      if (TABLE_VALIDATORS[table]) {
        const processResult = validationService.processDataForDatabase(
          data,
          TABLE_VALIDATORS[table]
        );
        
        if (!processResult.success) {
          throw new DatabaseError(
            `Validation failed: ${processResult.errors.join(', ')}`,
            DatabaseErrorCodes.VALIDATION_ERROR,
            { table, data, errors: processResult.errors }
          );
        }
        
        data = processResult.data;
      }

      const columns = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);

      // Use new SQLite API
      try {
        const result = await this.db.runAsync(
          `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
          values
        );
        return { success: true, insertId: result.lastInsertRowId };
      } catch (sqlError) {
        throw new DatabaseError(
          `SQL error: ${sqlError.message}`,
          DatabaseErrorCodes.SQL_ERROR,
          { table, data, operation: 'create', original: sqlError }
        );
      }
    } catch (error) {
      return handleDatabaseError(error, `create_${table}`);
    }
  }

  async read(table, id) {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      // Use new SQLite API
      try {
        const result = await this.db.getFirstAsync(
          `SELECT * FROM ${table} WHERE id = ?`,
          [id]
        );
        
        if (!result) {
          return { 
            success: false, 
            error: {
              code: DatabaseErrorCodes.RECORD_NOT_FOUND,
              message: `Record with id ${id} not found in ${table}`
            }
          };
        }
        
        return { success: true, data: result };
      } catch (sqlError) {
        throw new DatabaseError(
          `SQL error: ${sqlError.message}`,
          DatabaseErrorCodes.SQL_ERROR,
          { table, id, operation: 'read', original: sqlError }
        );
      }
    } catch (error) {
      return handleDatabaseError(error, `read_${table}`);
    }
  }

  async update(table, id, data) {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      // Validate data if validator exists for this table
      if (TABLE_VALIDATORS[table]) {
        // Only validate the fields being updated
        const processResult = validationService.processDataForDatabase(
          data,
          TABLE_VALIDATORS[table],
          true // Partial validation for update
        );
        
        if (!processResult.success) {
          throw new DatabaseError(
            `Validation failed: ${processResult.errors.join(', ')}`,
            DatabaseErrorCodes.VALIDATION_ERROR,
            { table, id, data, errors: processResult.errors }
          );
        }
        
        data = processResult.data;
      }

      // Build set clause
      const setClause = Object.keys(data)
        .map(key => `${key} = ?`)
        .join(', ');
      
      // Add updated_at timestamp
      data.updated_at = new Date().toISOString();
      
      const values = [...Object.values(data), id];

      // Use new SQLite API
      try {
        const result = await this.db.runAsync(
          `UPDATE ${table} SET ${setClause} WHERE id = ?`,
          values
        );
        
        if (result.changes === 0) {
          return { 
            success: false, 
            error: {
              code: DatabaseErrorCodes.RECORD_NOT_FOUND,
              message: `Record with id ${id} not found in ${table}`
            }
          };
        }
        
        return { success: true, changes: result.changes };
      } catch (sqlError) {
        throw new DatabaseError(
          `SQL error: ${sqlError.message}`,
          DatabaseErrorCodes.SQL_ERROR,
          { table, id, data, operation: 'update', original: sqlError }
        );
      }
    } catch (error) {
      return handleDatabaseError(error, `update_${table}`);
    }
  }

  async delete(table, id) {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      // Use new SQLite API
      try {
        const result = await this.db.runAsync(
          `DELETE FROM ${table} WHERE id = ?`,
          [id]
        );
        
        if (result.changes === 0) {
          return { 
            success: false, 
            error: {
              code: DatabaseErrorCodes.RECORD_NOT_FOUND,
              message: `Record with id ${id} not found in ${table}`
            }
          };
        }
        
        return { success: true, changes: result.changes };
      } catch (sqlError) {
        throw new DatabaseError(
          `SQL error: ${sqlError.message}`,
          DatabaseErrorCodes.SQL_ERROR,
          { table, id, operation: 'delete', original: sqlError }
        );
      }
    } catch (error) {
      return handleDatabaseError(error, `delete_${table}`);
    }
  }

  async query(sql, params = []) {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      // Use new SQLite API
      try {
        const rows = await this.db.getAllAsync(sql, params);
        return { success: true, data: rows };
      } catch (sqlError) {
        throw new DatabaseError(
          `SQL error: ${sqlError.message}`,
          DatabaseErrorCodes.SQL_ERROR,
          { sql, params, operation: 'query', original: sqlError }
        );
      }
    } catch (error) {
      return handleDatabaseError(error, 'query');
    }
  }

  async resetDatabase() {
    if (!this.initialized) {
      throw new DatabaseError(
        'Database not initialized',
        DatabaseErrorCodes.INITIALIZATION_ERROR
      );
    }

    try {
      await this.migrationService.resetDatabase();
      console.log('Database reset completed');
      return { success: true };
    } catch (error) {
      return handleDatabaseError(error, 'resetDatabase');
    }
  }
  
  // Begin a transaction
  async beginTransaction() {
    try {
      const result = await this.db.execAsync('BEGIN TRANSACTION');
      return { success: true, result };
    } catch (error) {
      return handleDatabaseError(error, 'beginTransaction');
    }
  }
  
  // Commit a transaction
  async commitTransaction() {
    try {
      const result = await this.db.execAsync('COMMIT');
      return { success: true, result };
    } catch (error) {
      return handleDatabaseError(error, 'commitTransaction');
    }
  }
  
  // Rollback a transaction
  async rollbackTransaction() {
    try {
      const result = await this.db.execAsync('ROLLBACK');
      return { success: true, result };
    } catch (error) {
      return handleDatabaseError(error, 'rollbackTransaction');
    }
  }
  
  // Execute multiple statements in a transaction
  async executeTransaction(statements) {
    try {
      await this.beginTransaction();
      
      const results = [];
      for (const statement of statements) {
        const { sql, params } = statement;
        const result = await this.query(sql, params);
        results.push(result);
      }
      
      await this.commitTransaction();
      return { success: true, results };
    } catch (error) {
      await this.rollbackTransaction().catch(rollbackError => {
        console.error('Failed to rollback transaction:', rollbackError);
      });
      return handleDatabaseError(error, 'executeTransaction');
    }
  }
  
  // Optimize a table
  async optimizeTable(table) {
    try {
      await this.db.execAsync(`VACUUM ${table}`);
      return { success: true };
    } catch (error) {
      return handleDatabaseError(error, `optimizeTable_${table}`);
    }
  }
  
  // Get database size
  async getDatabaseSize() {
    try {
      const result = await this.db.execAsync('PRAGMA page_count');
      const pageCount = result.rows[0].page_count;
      
      const pageSize = await this.db.execAsync('PRAGMA page_size');
      const pageSizeValue = pageSize.rows[0].page_size;
      
      const sizeInBytes = pageCount * pageSizeValue;
      return { success: true, size: sizeInBytes };
    } catch (error) {
      return handleDatabaseError(error, 'getDatabaseSize');
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();
export default databaseService; 