import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_VERSION_KEY = '@db_version';
const DB_NAME = 'kukai.db';
const DB_VERSION = 1;

export class DatabaseMigrationService {
  constructor() {
    this.db = null;
    this.migrations = [
      this.migration_1_0_0
    ];
  }

  // Open database connection
  async openDatabase() {
    if (!this.db) {
      try {
        // Use the modern SQLite API
        // This is compatible with the latest Expo SQLite version
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        console.log('Migration service: Database connection opened');
      } catch (error) {
        console.error('Migration service: Error opening database:', error);
        throw error;
      }
    }
    return this.db;
  }

  // Migration 1.0.0 - Initial schema
  async migration_1_0_0(db) {
    try {
      // Use execAsync for multiple SQL statements
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS meditation_sessions (
          id TEXT PRIMARY KEY,
          duration INTEGER NOT NULL,
          sound_theme TEXT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          completed BOOLEAN DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          due_date DATETIME,
          priority INTEGER,
          completed BOOLEAN DEFAULT 0,
          is_frog BOOLEAN DEFAULT 0,
          is_important BOOLEAN DEFAULT 0,
          is_urgent BOOLEAN DEFAULT 0,
          reminder_time INTEGER,
          category_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS journal_entries (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          mood TEXT,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS journal_templates (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS focus_sessions (
          id TEXT PRIMARY KEY,
          duration INTEGER NOT NULL,
          task_id TEXT,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          completed BOOLEAN DEFAULT 0,
          interruptions INTEGER DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id)
        );
      `);
      
      return true;
    } catch (error) {
      console.error('Error in migration 1.0.0:', error);
      throw error;
    }
  }

  async getCurrentVersion() {
    try {
      const version = await AsyncStorage.getItem(DB_VERSION_KEY);
      return version ? parseInt(version, 10) : 0;
    } catch (error) {
      console.error('Error getting database version:', error);
      return 0;
    }
  }

  async setCurrentVersion(version) {
    try {
      await AsyncStorage.setItem(DB_VERSION_KEY, version.toString());
    } catch (error) {
      console.error('Error setting database version:', error);
      throw error;
    }
  }

  async migrate() {
    const currentVersion = await this.getCurrentVersion();
    console.log(`Current database version: ${currentVersion}`);

    if (currentVersion >= DB_VERSION) {
      console.log('Database is up to date');
      return true;
    }

    try {
      // Open database if not already open
      const db = await this.openDatabase();
      
      // Run migrations in sequence
      for (let i = currentVersion; i < DB_VERSION; i++) {
        console.log(`Running migration ${i + 1}`);
        await this.migrations[i](db);
      }

      // Update version after successful migration
      await this.setCurrentVersion(DB_VERSION);
      console.log('Database migration completed successfully');
      return true;
    } catch (error) {
      console.error('Database migration failed:', error);
      throw error;
    }
  }

  async resetDatabase() {
    try {
      // Open database if not already open
      const db = await this.openDatabase();
      
      // Drop all tables using execAsync
      await db.execAsync(`
        DROP TABLE IF EXISTS focus_sessions;
        DROP TABLE IF EXISTS journal_templates;
        DROP TABLE IF EXISTS journal_entries;
        DROP TABLE IF EXISTS categories;
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS meditation_sessions;
      `);
      
      console.log('Database reset transaction completed successfully');
      
      // Reset version
      await this.setCurrentVersion(0);
      
      // Run migrations again
      await this.migrate();
      
      console.log('Database reset completed successfully');
      return true;
    } catch (error) {
      console.error('Database reset failed:', error);
      throw error;
    }
  }
} 