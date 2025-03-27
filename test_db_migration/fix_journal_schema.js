/**
 * Journal Schema Fix Script
 * 
 * This script modifies the journal_entries table to make the title field optional.
 * Run with:
 *   node test_db_migration/fix_journal_schema.js
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const run = async () => {
  console.log('======== JOURNAL SCHEMA FIX SCRIPT ========');
  try {
    // Ensure the SQLite directory exists
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }).catch(e => {
      // Directory may already exist, which is fine
      if (!e.message.includes('exists')) throw e;
    });
    
    // Open the database
    const dbPath = `${sqliteDir}/kukai.db`;
    console.log(`Opening database at: ${dbPath}`);
    
    const db = await SQLite.openDatabaseAsync(dbPath);
    console.log('Database opened successfully');
    
    // Check the current schema
    console.log('Checking current schema...');
    const columnsResult = await db.execAsync('PRAGMA table_info(journal_entries)');
    const columns = columnsResult?.rows?._array || [];
    
    console.log('Current journal_entries columns:');
    columns.forEach(col => {
      console.log(`- ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if we need to fix the title field
    const titleColumn = columns.find(col => col.name === 'title');
    if (!titleColumn) {
      console.log('Title column not found in schema, nothing to fix');
      return;
    }
    
    if (titleColumn.notnull !== 1) {
      console.log('Title column is already nullable, no fix needed');
      return;
    }
    
    console.log('Title column has NOT NULL constraint, fixing...');
    
    // The best way to modify a column constraint is to rebuild the table
    console.log('Creating a backup of the journal_entries table...');
    
    // Begin a transaction for safety
    await db.execAsync('BEGIN TRANSACTION');
    
    // Rename the existing table
    await db.execAsync('ALTER TABLE journal_entries RENAME TO journal_entries_old');
    
    // Create a new table with the correct schema
    console.log('Creating new table with correct schema...');
    await db.execAsync(`
      CREATE TABLE journal_entries (
        id TEXT PRIMARY KEY,
        title TEXT,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT,
        weather TEXT,
        temperature REAL,
        mood TEXT,
        template_id TEXT,
        timestamp TEXT,
        updated_at TEXT
      )
    `);
    
    // Copy data from old table to new table
    console.log('Copying data from old table to new table...');
    await db.execAsync(`
      INSERT INTO journal_entries
      SELECT id, title, text, date, location, weather, temperature, mood,
             template_id, timestamp, updated_at
      FROM journal_entries_old
    `);
    
    // Check if the copy was successful
    const countOldResult = await db.execAsync('SELECT COUNT(*) as count FROM journal_entries_old');
    const countOld = countOldResult?.rows?._array[0]?.count || 0;
    
    const countNewResult = await db.execAsync('SELECT COUNT(*) as count FROM journal_entries');
    const countNew = countNewResult?.rows?._array[0]?.count || 0;
    
    if (countOld === countNew) {
      console.log(`Successfully copied ${countNew} entries from old table to new table`);
      
      // Drop the old table
      console.log('Dropping old table...');
      await db.execAsync('DROP TABLE journal_entries_old');
      
      // Recreate index for date searches
      console.log('Creating index on date column...');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)');
      
      // Commit the transaction
      await db.execAsync('COMMIT');
      console.log('Schema fix committed successfully');
    } else {
      // Data count mismatch, rollback for safety
      console.error(`Data count mismatch: old=${countOld}, new=${countNew}`);
      await db.execAsync('ROLLBACK');
      console.error('Schema fix rolled back due to data count mismatch');
      return;
    }
    
    // Verify the new schema
    console.log('Verifying new schema...');
    const newColumnsResult = await db.execAsync('PRAGMA table_info(journal_entries)');
    const newColumns = newColumnsResult?.rows?._array || [];
    
    console.log('New journal_entries columns:');
    newColumns.forEach(col => {
      console.log(`- ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if title is now nullable
    const newTitleColumn = newColumns.find(col => col.name === 'title');
    if (newTitleColumn && newTitleColumn.notnull !== 1) {
      console.log('Title column is now nullable. Schema fix successful!');
    } else {
      console.error('Title column is still NOT NULL or missing. Schema fix failed!');
    }
    
  } catch (error) {
    console.error('Error fixing journal schema:', error);
  }
};

// Run the script
run(); 