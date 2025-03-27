-- SQLite Database Schema for Kukai App
-- This schema replaces the AsyncStorage implementation with SQLite tables

-- Database version tracking for migrations
CREATE TABLE IF NOT EXISTS db_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0, -- Boolean (0/1)
    completed_at TIMESTAMP,
    is_frog INTEGER DEFAULT 0, -- Boolean for "Eat That Frog" methodology
    is_important INTEGER DEFAULT 0, -- Boolean
    is_urgent INTEGER DEFAULT 0, -- Boolean
    is_time_tagged INTEGER DEFAULT 0, -- Boolean 
    task_time TEXT, -- ISO string date for scheduled time
    has_reminder INTEGER DEFAULT 0, -- Boolean
    reminder_time INTEGER DEFAULT 15, -- Minutes before task to remind
    notify_at_deadline INTEGER DEFAULT 1, -- Boolean
    category_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

-- Tomorrow's tasks (tasks scheduled for tomorrow)
CREATE TABLE IF NOT EXISTS tomorrow_tasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    date TEXT NOT NULL, -- Date in YYYY-MM-DD format
    location TEXT,
    weather TEXT,
    temperature REAL,
    mood TEXT,
    template_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES journal_templates(id) ON DELETE SET NULL
);



-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_is_frog ON tasks(is_frog);
CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(task_time);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_tomorrow_tasks ON tomorrow_tasks(task_id);

