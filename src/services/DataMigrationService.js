/**
 * DataMigrationService
 * 
 * A service to migrate data from AsyncStorage to SQLite database
 * Handles converting AsyncStorage data format to the appropriate SQLite tables
 */
import * as SQLite from 'expo-sqlite';
import storageService from './storage/StorageService';

class DataMigrationService {
  constructor(dbName = 'kukai.db') {
    this.db = SQLite.openDatabaseAsync(dbName);
  }

  /**
   * Migrate all data from AsyncStorage to SQLite
   * @returns {Promise<Object>} Migration results
   */
  async migrateAllData() {
    try {
      console.log('Starting data migration from AsyncStorage to SQLite...');
      
      const migrationResults = {
        tasks: await this.migrateTasksData(),
        journal: await this.migrateJournalData(),
        success: true
      };
      
      console.log('Migration complete with results:', migrationResults);
      return migrationResults;
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Migrate tasks data from AsyncStorage to SQLite
   * @returns {Promise<Object>} Task migration results
   */
  async migrateTasksData() {
    try {
      console.log('Migrating tasks data...');
      
      // Get tasks from AsyncStorage
      const tasksData = await storageService.getItem('tasks');
      const tomorrowTasksData = await storageService.getItem('tomorrowTasks');
      
      if (!tasksData) {
        console.log('No tasks data found in AsyncStorage');
        return { tasksCount: 0, tomorrowTasksCount: 0 };
      }
      
      const tasks = JSON.parse(tasksData);
      const tomorrowTasks = tomorrowTasksData ? JSON.parse(tomorrowTasksData) : [];
      
      // Begin transaction for atomicity
      return new Promise((resolve, reject) => {
        this.db.transaction(
          tx => {
            // Insert each task
            tasks.forEach(task => {
              tx.executeSql(
                `INSERT OR REPLACE INTO tasks (
                  id, text, completed, completed_at, is_frog, is_important, 
                  is_urgent, is_time_tagged, task_time, has_reminder, 
                  reminder_time, notify_at_deadline, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  task.id,
                  task.text,
                  task.completed ? 1 : 0,
                  task.completedAt,
                  task.isFrog ? 1 : 0,
                  task.isImportant ? 1 : 0,
                  task.isUrgent ? 1 : 0,
                  task.isTimeTagged ? 1 : 0,
                  task.taskTime,
                  task.hasReminder ? 1 : 0,
                  task.reminderTime || 15,
                  task.notifyAtDeadline ? 1 : 0,
                  task.createdAt || new Date().toISOString(),
                  new Date().toISOString()
                ]
              );
            });
            
            // Insert tomorrow tasks with relation to main tasks
            tomorrowTasks.forEach((task, index) => {
              // First ensure the main task exists
              tx.executeSql(
                `SELECT id FROM tasks WHERE id = ?`,
                [task.id],
                (_, resultSet) => {
                  if (resultSet.rows.length > 0) {
                    tx.executeSql(
                      `INSERT OR REPLACE INTO tomorrow_tasks (
                        id, task_id, sort_order, created_at
                      ) VALUES (?, ?, ?, ?)`,
                      [
                        `tomorrow_${task.id}`,
                        task.id,
                        index,
                        new Date().toISOString()
                      ]
                    );
                  }
                }
              );
            });
          },
          error => {
            console.error('Error during tasks migration transaction:', error);
            reject({
              success: false,
              error: error.message
            });
          },
          () => {
            resolve({
              tasksCount: tasks.length,
              tomorrowTasksCount: tomorrowTasks.length,
              success: true
            });
          }
        );
      });
    } catch (error) {
      console.error('Tasks migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Migrate journal data from AsyncStorage to SQLite
   * @returns {Promise<Object>} Journal migration results
   */
  async migrateJournalData() {
    try {
      console.log('Migrating journal data...');
      
      // Get journal entries from AsyncStorage
      const journalData = await storageService.getItem('journal');
      
      if (!journalData) {
        console.log('No journal data found in AsyncStorage');
        return { journalEntriesCount: 0 };
      }
      
      const journalEntries = JSON.parse(journalData);
      
      // Also check for per-date journal entries
      const allKeys = await storageService.getAllKeys();
      const datePrefixedJournalKeys = allKeys.filter(key => key.startsWith('journal_') && key !== 'journal');
      
      // Begin transaction for atomicity
      return new Promise((resolve, reject) => {
        this.db.transaction(
          tx => {
            // First, migrate journal templates if they don't exist
            this.ensureJournalTemplatesExist(tx);
            
            // Insert each journal entry from the main journal storage
            journalEntries.forEach(entry => {
              tx.executeSql(
                `INSERT OR REPLACE INTO journal_entries (
                  id, title, text, date, location, weather, 
                  temperature, mood, timestamp, updated_at, template_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  entry.id || `journal_${entry.date}_${new Date().getTime()}`,
                  entry.title || `Journal for ${entry.date}`,
                  entry.text,
                  entry.date,
                  entry.location || null,
                  entry.weather || null,
                  entry.temperature || null,
                  entry.mood || null,
                  entry.timestamp || new Date().toISOString(),
                  new Date().toISOString(),
                  'default' // Default template
                ]
              );
            });
            
            // Handle individual date entries that might not be in the main journal array
            datePrefixedJournalKeys.forEach(async key => {
              const date = key.replace('journal_', '');
              
              // Check if this date already exists in the journal entries we processed
              if (!journalEntries.some(entry => entry.date === date)) {
                const entryText = await storageService.getItem(key);
                if (entryText) {
                  tx.executeSql(
                    `INSERT OR REPLACE INTO journal_entries (
                      id, title, text, date, timestamp, updated_at, template_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                      `journal_${date}_${new Date().getTime()}`,
                      `Journal for ${date}`,
                      entryText,
                      date,
                      new Date().toISOString(),
                      new Date().toISOString(),
                      'default'
                    ]
                  );
                }
              }
            });
          },
          error => {
            console.error('Error during journal migration transaction:', error);
            reject({
              success: false,
              error: error.message
            });
          },
          () => {
            resolve({
              journalEntriesCount: journalEntries.length,
              datePrefixedJournalKeysCount: datePrefixedJournalKeys.length,
              success: true
            });
          }
        );
      });
    } catch (error) {
      console.error('Journal migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure journal templates exist in the database
   * @param {SQLTransaction} tx SQLite transaction object
   */
  ensureJournalTemplatesExist(tx) {
    // Insert default templates if not already present
    const templates = [
      {
        id: 'default',
        name: 'Default',
        content: '# Today\'s Journal\n\n_Write freely about your day..._',
        is_system: 1
      },
      {
        id: 'gratitude',
        name: 'Gratitude',
        content: '# Gratitude Journal\n\n## I am grateful for:\n1. \n2. \n3. \n\n## Today I appreciated:\n\n## One small joy I experienced:',
        is_system: 1
      },
      {
        id: 'reflection',
        name: 'Reflection',
        content: '# Daily Reflection\n\n## What went well today?\n\n## What could have gone better?\n\n## What did I learn?\n\n## What will I focus on tomorrow?',
        is_system: 1
      },
      {
        id: 'achievement',
        name: 'Achievement',
        content: '# Achievement Journal\n\n## Today\'s wins (big or small):\n- \n\n## Challenges I overcame:\n\n## Progress on goals:\n- [ ] Goal 1:\n- [ ] Goal 2:\n- [ ] Goal 3:\n\n## What did I do to take care of myself today?',
        is_system: 1
      },
      {
        id: 'evening',
        name: 'Evening',
        content: '# Evening Reflection\n\n## Three things that happened today:\n1. \n2. \n3. \n\n## How am I feeling right now?\n\n## One thing I\'m looking forward to tomorrow:',
        is_system: 1
      },
      {
        id: 'custom',
        name: 'Custom',
        content: '',
        is_system: 0
      }
    ];
    
    templates.forEach(template => {
      tx.executeSql(
        `INSERT OR IGNORE INTO journal_templates (
          id, name, content, is_system, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          template.id,
          template.name,
          template.content,
          template.is_system,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    });
  }
}

export default new DataMigrationService(); 