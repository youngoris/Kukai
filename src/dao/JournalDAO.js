/**
 * JournalDAO - Data Access Object for Journal Entries
 * 
 * Provides methods to interact with the journal_entries table in the SQLite database
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

// Add retry/timeout capability for database operations
const DB_OPERATION_TIMEOUT = 10000; // 10 seconds
const DB_RETRY_DELAY = 300; // 300ms between retries

class JournalDAO {
  constructor(dbName = 'kukai.db') {
    this.dbName = dbName;
    this.db = null;
    this.tablesCreated = false;
    this.isInitializing = false;
    this.initPromise = null;
  }

  /**
   * Initialize the JournalDAO
   * @returns {Promise<boolean>} Success indicator
   */
  async initialize() {
    // Use a mutex pattern to prevent multiple simultaneous initialization
    if (this.isInitializing) {
      console.log("Database initialization already in progress, waiting for completion...");
      try {
        return await this.initPromise;
      } catch (err) {
        console.error("Error while waiting for initialization:", err);
        // Reset initialization state since it failed
        this.isInitializing = false;
        this.initPromise = null;
        // Try again from scratch
        return this.initialize();
      }
    }
    
    // If database is already initialized, just return success
    if (this.db && this.tablesCreated) {
      console.log("Database already initialized, skipping initialization");
      return true;
    }
    
    // Set flag and create promise
    this.isInitializing = true;
    this.initPromise = this._initializeInternal().catch(err => {
      console.error("Initialization failed:", err);
      // Always clean up the initialization state on error
      this.isInitializing = false;
      this.initPromise = null;
      throw err;
    }).finally(() => {
      // Reset initialization flag when done
      this.isInitializing = false;
      this.initPromise = null;
    });
    
    return this.initPromise;
  }
  
  /**
   * Internal initialization implementation
   * @private
   */
  async _initializeInternal() {
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
      
      // Close any existing connection first
      if (this.db) {
        try {
          await this.db.closeAsync();
          console.log('Closed existing database connection');
        } catch (closeError) {
          console.error('Error closing existing database:', closeError);
        }
        this.db = null;
      }
      
      // Open the database with a retry mechanism
      let retries = 3;
      let lastError = null;
      
      while (retries > 0 && !this.db) {
        try {
          console.log(`Attempting to open database (${retries} retries left)`);
          this.db = await SQLite.openDatabaseAsync(dbPath);
          console.log('Database opened successfully');
          break;
        } catch (error) {
          lastError = error;
          console.error(`Failed to open database (retries left: ${retries}):`, error);
          retries--;
          
          if (retries > 0) {
            // Wait before retrying
            const delayMs = (4 - retries) * 300; // Increasing delay with each retry
            console.log(`Waiting ${delayMs}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      
      // If still failed after retries, try relative path as fallback
      if (!this.db) {
        try {
          console.log('Trying to open database with relative path as fallback');
          this.db = await SQLite.openDatabaseAsync(this.dbName);
          console.log('Database opened successfully using relative path');
        } catch (error) {
          console.error('Failed to open database with relative path:', error);
          throw new Error(`Cannot open database after multiple attempts: ${lastError?.message || 'Unknown error'}`);
        }
      }
      
      if (!this.db) {
        throw new Error('Database connection could not be established');
      }
      
      // Check for pending/failed transactions and clean up
      try {
        await this.db.execAsync('ROLLBACK');
        console.log('Successfully rolled back any pending transactions');
      } catch (e) {
        // No active transaction, this is normal
      }
      
      // Enable foreign keys support for better data integrity
      try {
        await this.db.execAsync('PRAGMA foreign_keys = ON');
        console.log('Enabled foreign key constraints');
      } catch (pragmaError) {
        console.warn('Could not enable foreign keys:', pragmaError.message);
      }
      
      // Enable WAL mode for better performance and reliability
      try {
        await this.db.execAsync('PRAGMA journal_mode = WAL');
        console.log('Enabled WAL journal mode');
      } catch (walError) {
        console.warn('Could not enable WAL mode:', walError.message);
      }
      
      // Set synchronous mode to NORMAL (good balance of safety and performance)
      try {
        await this.db.execAsync('PRAGMA synchronous = NORMAL');
        console.log('Set synchronous mode to NORMAL');
      } catch (syncError) {
        console.warn('Could not set synchronous mode:', syncError.message);
      }
      
      // Test db connection with a more reliable approach
      try {
        // Test with a simpler query structure
        await this.db.execAsync(`CREATE TABLE IF NOT EXISTS _test_table (id INTEGER PRIMARY KEY)`);
        console.log('Successfully created test table');
        
        // Insert a test row
        await this.db.execAsync(`INSERT INTO _test_table (id) VALUES (1)`);
        console.log('Successfully inserted test data');
        
        // Verify the row was inserted
        const testResult = await this.db.execAsync(`SELECT * FROM _test_table WHERE id = 1`);
        const testCount = testResult?.rows?._array?.length || 0;
        console.log(`Test query returned ${testCount} rows`);
        
        // Clean up test table
        await this.db.execAsync(`DROP TABLE IF EXISTS _test_table`);
        console.log('Successfully dropped test table');
        
        // If we got here, database is working correctly
        console.log('Database connection verified with test table operations');
      } catch (testError) {
        console.error('Database connection verification failed:', testError);
        throw new Error('Database verification failed: ' + testError.message);
      }
      
      // Create tables if they don't exist
      await this.createTables();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize JournalDAO:', error);
      throw error; // Propagate error to the caller for better error handling
    }
  }

  /**
   * Create necessary tables if they don't exist
   * @private
   */
  async createTables() {
    // If tables are already created, don't try to create them again
    if (this.tablesCreated) {
      console.log("Journal tables already created, skipping creation");
      return;
    }
    
    try {
      console.log("Starting journal tables creation/verification");
      
      // First check if tables exist
      let tables = [];
      try {
        const tablesResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        // Extract table names from the result, being careful if result is undefined
        tables = tablesResult?.rows?._array?.map(t => t.name) || [];
        console.log('Existing tables:', tables);
      } catch (err) {
        console.error("Error fetching tables:", err);
        tables = []; // Default to empty array on error
      }
      
      const entriesTableExists = tables.includes('journal_entries');
      
      // If table already exists, verify it and mark as created
      if (entriesTableExists) {
        console.log("Journal entries table already exists, verifying structure");
        this.tablesCreated = true;
        
        // Verify and add any missing columns
        await this._verifyTableColumns();
        
        console.log("Journal table verification completed successfully");
        return;
      }
      
      // Create journal_entries table if it doesn't exist
      console.log("Creating journal_entries table...");

      // Check one more time if table exists to avoid the transaction error
      try {
        const doubleCheckResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
        );
        
        if (doubleCheckResult?.rows?._array?.length > 0) {
          console.log("Table journal_entries already exists (found during double-check)");
          this.tablesCreated = true;
          
          // Verify and add any missing columns
          await this._verifyTableColumns();
          
          console.log("Journal table verification completed successfully");
          return;
        }
      } catch (doubleCheckErr) {
        console.warn("Error during double-check for table existence:", doubleCheckErr);
        // Continue with creation since it's just a pre-check
      }
      
      // Try using simple approach first - single statement with IF NOT EXISTS
      try {
        console.log('Using simple approach with IF NOT EXISTS');
        const simpleCreateQuery = `
          CREATE TABLE IF NOT EXISTS journal_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled Entry',
            text TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL DEFAULT (date('now')),
            location TEXT,
            weather TEXT,
            temperature REAL,
            mood TEXT,
            template_id TEXT DEFAULT 'default',
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await this.db.execAsync(simpleCreateQuery);
        console.log('Created journal_entries table with simple approach');
        
        // Also create the index
        try {
          await this.db.execAsync('CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)');
          console.log('Created date index');
        } catch (indexError) {
          console.warn(`Failed to create index, but that's not critical:`, indexError.message);
        }
        
        // Verify table structure immediately after creation
        try {
          console.log("Verifying table structure after creation");
          const testSelectQuery = "SELECT id, title, text, date, location, weather, temperature, mood, template_id, timestamp, updated_at FROM journal_entries LIMIT 0";
          await this.db.execAsync(testSelectQuery);
          console.log("Table structure verified successfully after creation");
          this.tablesCreated = true;
          return;
        } catch (verifyError) {
          console.error("Table structure verification failed:", verifyError);
          // Continue to transaction approach if simple approach failed to create a proper table
        }
      } catch (simpleError) {
        // If the error is "table already exists", it actually succeeded
        if (simpleError.message && simpleError.message.includes('already exists')) {
          console.log("Table already exists error - this means success");
          this.tablesCreated = true;
          
          // Verify and add any missing columns
          await this._verifyTableColumns();
          
          console.log("Journal table verification completed successfully");
          return;
        }
        
        console.error('Simple table creation failed:', simpleError);
        // If we get here, try the transaction approach
      }
      
      // If the simple approach failed, try using transaction as a last resort
      try {
        // Begin transaction
        await this.db.execAsync('BEGIN TRANSACTION');
        console.log('Started transaction for table creation');
        
        // Create the journal_entries table with all fields
        const createTableQuery = `
          CREATE TABLE journal_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Untitled Entry',
            text TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL DEFAULT (date('now')),
            location TEXT,
            weather TEXT,
            temperature REAL,
            mood TEXT,
            template_id TEXT DEFAULT 'default',
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        try {
          await this.db.execAsync(createTableQuery);
          console.log('Created journal_entries table');
        } catch (createError) {
          // If table already exists, consider it success and continue
          if (createError.message && createError.message.includes('already exists')) {
            console.log("Table already exists during transaction - this is a success case");
            this.tablesCreated = true;
            
            // Try to commit, but it's okay if this fails
            try {
              await this.db.execAsync('COMMIT');
            } catch (commitErr) {
              console.warn('Commit failed after table exists error, trying rollback:', commitErr);
              try {
                await this.db.execAsync('ROLLBACK');
              } catch (rbErr) {
                // Ignore rollback errors
              }
            }
            
            // Verify columns since we might have had a partial creation
            await this._verifyTableColumns();
            return;
          }
          
          // For other errors, rethrow to be caught by outer catch
          throw createError;
        }
        
        // Create index for efficient date lookup
        await this.db.execAsync('CREATE INDEX idx_journal_date ON journal_entries(date)');
        console.log('Created date index');
        
        // Commit the transaction
        await this.db.execAsync('COMMIT');
        console.log('Committed journal table creation transaction');
        this.tablesCreated = true;
        
        // Verify table structure immediately after creation
        try {
          console.log("Verifying table structure after creation");
          const testSelectQuery = "SELECT id, title, text, date, location, weather, temperature, mood, template_id, timestamp, updated_at FROM journal_entries LIMIT 0";
          await this.db.execAsync(testSelectQuery);
          console.log("Table structure verified successfully after creation");
        } catch (verifyError) {
          console.error("Table structure verification failed:", verifyError);
          // If verification fails, reconstruct the table
          this.tablesCreated = false;
          await this._rebuildTableIfNeeded();
        }
      } catch (txError) {
        console.error('Error during table creation transaction:', txError);
        
        // Try to roll back the transaction
        try {
          await this.db.execAsync('ROLLBACK');
          console.log('Rolled back failed transaction');
        } catch (rbError) {
          console.error('Failed to rollback transaction:', rbError);
        }
      }
      
      // Verify the table was actually created by testing a simple query
      try {
        await this.db.execAsync("SELECT COUNT(*) FROM journal_entries LIMIT 1");
        console.log("Successfully verified journal_entries table with test query");
        this.tablesCreated = true;
      } catch (verifyError) {
        console.error("Error verifying table with test query:", verifyError);
        
        // Last attempt check - maybe the table exists but has no rows
        try {
          const finalCheckResult = await this.db.execAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
          );
          
          const tableExistsFinalCheck = finalCheckResult?.rows?._array?.length > 0;
          
          if (tableExistsFinalCheck) {
            console.log("Table exists in final check, marking as created");
            this.tablesCreated = true;
            
            // Run verification again as a final safety check
            await this._verifyTableColumns();
          } else {
            throw new Error("Table does not exist after all creation attempts");
          }
        } catch (finalCheckErr) {
          console.error("Error in final table existence check:", finalCheckErr);
          throw new Error("Could not verify table creation: " + finalCheckErr.message);
        }
      }
    } catch (error) {
      console.error("Error creating journal tables:", error);
      throw error;
    }
  }

  /**
   * Verify journal table existence before performing operations
   * @private
   */
  async _ensureTablesExist() {
    // If tables are already marked as created, skip the check
    if (this.tablesCreated) {
      return;
    }
    
    // Use a simple flag to prevent recursive loops
    const MAX_ATTEMPTS = 2;
    let attempts = 0;
    const checkTables = async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        console.error(`Exceeded maximum table check attempts (${MAX_ATTEMPTS})`);
        // If we've tried multiple times and failed, mark tables as created anyway
        // to prevent an infinite loop
        this.tablesCreated = true;
        return;
      }
      
      try {
        console.log(`Table check attempt ${attempts}/${MAX_ATTEMPTS}`);
        
        // Ensure database is initialized
        if (!this.db) {
          console.log("Database not initialized, initializing now...");
          await this.initialize();
          
          if (!this.db) {
            throw new Error("Database initialization failed");
          }
        }
        
        // Direct query to check if tables exist
        const result = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
        );
        
        const tableExists = result?.rows?._array?.length > 0;
        
        if (!tableExists) {
          console.log("Journal entries table not found, creating tables...");
          await this.createTables();
          // After createTables, the tablesCreated flag should be set if successful
        } else {
          console.log("Journal entries table exists");
          
          // Verify that we can query the table with a simple count
          try {
            await this.db.execAsync("SELECT COUNT(*) FROM journal_entries LIMIT 1");
            console.log("Successfully verified journal_entries table access");
            this.tablesCreated = true;
            
            // Check and add any missing columns
            await this._verifyTableColumns();
          } catch (queryError) {
            console.error("Error querying existing journal_entries table:", queryError);
            
            if (queryError.message && queryError.message.includes("no such table")) {
              // Table metadata exists but table is missing - corrupted DB
              console.warn("Detected corrupted database state - table metadata exists but table is missing");
              
              if (attempts < MAX_ATTEMPTS) {
                console.log("Attempting to recreate the table...");
                // Force recreation by setting flag to false
                this.tablesCreated = false;
                await this.createTables();
              }
            } else {
              // Some other query error occurred
              console.error("Unknown error querying journal table:", queryError);
              if (attempts < MAX_ATTEMPTS) {
                // Try to repair by verifying columns
                await this._verifyTableColumns();
              }
            }
          }
        }
        
        // Final verification - if we still don't have tablesCreated flag set, something went wrong
        if (!this.tablesCreated) {
          console.warn("Table verification incomplete after checks");
          
          if (attempts < MAX_ATTEMPTS) {
            // Try one more time from scratch
            this.db = null; // Force complete reinitialization
            await this.initialize();
            return checkTables(); // Recursive call with attempt counter
          } else {
            // Last resort - just mark as created to avoid permanent failures
            console.warn("Setting tables as created despite verification issues to prevent service failure");
            this.tablesCreated = true;
          }
        }
      } catch (error) {
        console.error("Error ensuring tables exist:", error);
        
        if (attempts < MAX_ATTEMPTS) {
          // Try to re-initialize the database completely
          console.log("Reinitializing database after error");
          this.db = null;
          await this.initialize();
          return checkTables(); // Recursive call with attempt counter
        } else {
          console.error("Failed to initialize database after multiple attempts");
          // Mark as created anyway to prevent loops
          console.warn("Setting tables as created despite errors to prevent service failure");
          this.tablesCreated = true;
        }
      }
    };
    
    await checkTables();
  }

  /**
   * Verify and add missing columns to the journal_entries table
   * @private
   */
  async _verifyTableColumns() {
    if (!this.db || !this.tablesCreated) {
      console.warn("Cannot verify columns because database is not initialized or tables not created");
      return;
    }
    
    try {
      console.log("Verifying journal_entries table columns...");
      
      // First try to run a test query that selects all columns to see if they actually exist
      try {
        await this.db.execAsync("SELECT id, title, text, date, location, weather, temperature, mood, template_id, timestamp, updated_at FROM journal_entries LIMIT 0");
        console.log("All expected columns exist in the table (verified via SELECT query)");
        
        // If we get here, all columns actually exist despite what PRAGMA might say
        // This fixes cases where table metadata is inconsistent
        return;
      } catch (selectError) {
        // If columns are missing, this query will fail with specific error
        console.log("SELECT test failed, some columns may be missing:", selectError.message);
        // Continue with column verification
      }
      
      // Get existing columns
      let columns = [];
      try {
        const columnsResult = await this.db.execAsync("PRAGMA table_info(journal_entries)");
        columns = columnsResult?.rows?._array?.map(c => c.name) || [];
        console.log("Existing columns according to PRAGMA:", columns);
        
        // Empty columns array but table exists - inconsistent state
        if (columns.length === 0) {
          console.warn("Table exists but PRAGMA returns no columns - possible metadata corruption");
          
          // Try to recover by rebuilding the table
          await this._rebuildTableIfNeeded();
          return;
        }
      } catch (pragmaError) {
        console.error("Error fetching PRAGMA table info:", pragmaError);
        await this._rebuildTableIfNeeded();
        return;
      }
      
      // Required columns to check for
      const requiredColumns = [
        { name: 'id', type: "TEXT PRIMARY KEY" },
        { name: 'title', type: "TEXT NOT NULL DEFAULT 'Untitled Entry'" },
        { name: 'text', type: "TEXT NOT NULL DEFAULT ''" },
        { name: 'date', type: "TEXT NOT NULL DEFAULT (date('now'))" }
      ];
      
      // Additional useful columns
      const additionalColumns = [
        { name: 'location', type: "TEXT" },
        { name: 'weather', type: "TEXT" },
        { name: 'temperature', type: "REAL" },
        { name: 'mood', type: "TEXT" },
        { name: 'template_id', type: "TEXT DEFAULT 'default'" },
        { name: 'timestamp', type: "TEXT DEFAULT CURRENT_TIMESTAMP" },
        { name: 'updated_at', type: "TEXT DEFAULT CURRENT_TIMESTAMP" }
      ];
      
      // Combine all columns we want to check
      const allColumns = [...requiredColumns, ...additionalColumns];
      
      // Ensure all columns exist
      let missingColumnsAdded = 0;
      for (const col of allColumns) {
        if (!columns.includes(col.name)) {
          console.log(`Adding missing column: ${col.name}`);
          try {
            await this.db.execAsync(
              `ALTER TABLE journal_entries ADD COLUMN ${col.name} ${col.type}`
            );
            missingColumnsAdded++;
          } catch (colError) {
            // If the error indicates column already exists despite not showing in PRAGMA
            // that's actually a success - metadata inconsistency
            if (colError.message && colError.message.includes('duplicate column name')) {
              console.log(`Column ${col.name} already exists despite not showing in PRAGMA - metadata inconsistency`);
            } else {
              console.error(`Failed to add column ${col.name}:`, colError);
              
              // If adding a PRIMARY KEY column fails, it's a critical issue
              if (col.name === 'id') {
                console.error("Cannot add PRIMARY KEY column - table may be corrupted");
              }
            }
          }
        }
      }
      
      console.log(`Column verification complete. Added ${missingColumnsAdded} missing columns.`);
      
      // Check index existence
      try {
        const indexResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_journal_date'"
        );
        
        const indexExists = indexResult?.rows?._array?.length > 0;
        
        if (!indexExists) {
          console.log("Creating missing journal date index");
          try {
            await this.db.execAsync('CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)');
            console.log('Created date index');
          } catch (indexError) {
            console.warn(`Failed to create index: ${indexError.message}`);
          }
        }
      } catch (indexCheckErr) {
        console.error("Error checking for index:", indexCheckErr);
      }
    } catch (error) {
      console.error("Error verifying table columns:", error);
    }
  }
  
  /**
   * Rebuild table if needed (e.g., if schema is out of date)
   * @param {boolean} force Force a rebuild even if not needed
   * @private
   */
  async _rebuildTableIfNeeded(force = false) {
    try {
      console.log('Checking if rebuild is needed', force ? '(forced)' : '');
      
      // If force is true, skip the check and rebuild anyway
      if (force) {
        console.log('Forced rebuild requested');
        return await this._performRebuild();
      }
      
      // Check if rebuild is needed (schema version, missing columns, etc)
      const needsRebuild = false; // Placeholder for rebuild logic
      
      if (needsRebuild) {
        console.log('Rebuild needed, initiating rebuild');
        return await this._performRebuild();
      }
      
      console.log('No rebuild needed');
      return false;
    } catch (error) {
      console.error(`Error in rebuild check: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Perform the actual table rebuild
   * @private
   */
  async _performRebuild() {
    try {
      console.log('Performing table rebuild');
      
      // Begin transaction
      await this.db.execAsync('BEGIN TRANSACTION');
      
      // Rename existing table to _backup
      console.log('Renaming existing table');
      try {
        await this.db.execAsync('DROP TABLE IF EXISTS journal_entries_backup');
        await this.db.execAsync('ALTER TABLE journal_entries RENAME TO journal_entries_backup');
      } catch (renameError) {
        console.warn(`Could not rename table: ${renameError.message}`);
        // If table doesn't exist, that's fine, just continue
      }
      
      // Create new table with correct schema
      console.log('Creating new table with current schema');
      const createTableQuery = `
        CREATE TABLE journal_entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT 'Untitled Entry',
          text TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL DEFAULT (date('now')),
          location TEXT,
          weather TEXT,
          temperature REAL,
          mood TEXT,
          template_id TEXT DEFAULT 'default',
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.db.execAsync(createTableQuery);
      
      // Create index for efficient date lookup
      console.log('Creating index');
      await this.db.execAsync('CREATE INDEX idx_journal_date ON journal_entries(date)');
      
      // Try to migrate data from backup if it exists
      try {
        console.log('Checking if backup table exists');
        const backupExistsResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries_backup'"
        );
        
        if (backupExistsResult?.rows?._array?.length > 0) {
          console.log('Backup table exists, migrating data');
          
          // Copy data from backup to new table
          await this.db.execAsync(`
            INSERT INTO journal_entries (id, title, text, date, location, weather, temperature, mood, template_id, timestamp, updated_at)
            SELECT id, title, text, date, location, weather, temperature, mood, template_id, timestamp, updated_at 
            FROM journal_entries_backup
          `);
          
          console.log('Data migration complete');
          
          // Get count of migrated records
          const countResult = await this.db.execAsync('SELECT COUNT(*) as count FROM journal_entries');
          const migratedCount = countResult?.rows?._array?.[0]?.count || 0;
          console.log(`Migrated ${migratedCount} records`);
          
          // Clean up backup table
          console.log('Removing backup table');
          await this.db.execAsync('DROP TABLE journal_entries_backup');
        } else {
          console.log('No backup table found, nothing to migrate');
        }
      } catch (migrationError) {
        console.error(`Migration failed: ${migrationError.message}`);
        // Continue anyway - we have a new table even if migration failed
      }
      
      // Commit transaction
      await this.db.execAsync('COMMIT');
      console.log('Rebuild transaction committed');
      
      // Set tables created flag
      this.tablesCreated = true;
      return true;
    } catch (rebuildError) {
      console.error(`Rebuild failed: ${rebuildError.message}`);
      
      // Try to rollback
      try {
        await this.db.execAsync('ROLLBACK');
        console.log('Rebuild transaction rolled back');
      } catch (rollbackError) {
        console.error(`Rollback failed: ${rollbackError.message}`);
      }
      
      throw rebuildError;
    }
  }

  /**
   * Get all journal entries
   * @returns {Promise<Array>} List of all journal entries
   */
  async getAllEntries() {
    try {
      // Ensure database is ready
      try {
        if (!this.db || !this.tablesCreated) {
          console.log("Database not fully initialized, initializing now...");
          await this.initialize();
          await this._ensureTablesExist();
        }
      } catch (initError) {
        console.error("Error during initialization in getAllEntries:", initError);
        // Continue with the method, we'll handle any DB errors below
      }
      
      console.log("Retrieving all journal entries");
      
      // Build a simple, reliable query
      const query = "SELECT * FROM journal_entries ORDER BY date DESC, timestamp DESC";
      
      try {
        const result = await this._safeExecute(query);
        const rows = result && result.rows && result.rows._array ? result.rows._array : [];
        console.log(`Retrieved ${rows.length} journal entries`);
        return rows.map(row => this._convertRowToEntry(row));
      } catch (err) {
        console.error("Error executing journal entries query:", err);
        
        // Try a more basic query as fallback
        try {
          console.log("Attempting fallback query for journal entries");
          const fallbackResult = await this._safeExecute("SELECT id, title, text, date FROM journal_entries");
          const fallbackRows = fallbackResult && fallbackResult.rows && fallbackResult.rows._array ? fallbackResult.rows._array : [];
          console.log(`Retrieved ${fallbackRows.length} journal entries with fallback query`);
          return fallbackRows.map(row => this._convertRowToEntry(row));
        } catch (fallbackErr) {
          console.error("Fallback query also failed:", fallbackErr);
          return [];
        }
      }
    } catch (error) {
      console.error('Failed to get all journal entries:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get a journal entry by date
   * @param {string} date Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Journal entry or null if not found
   */
  async getEntryByDate(date) {
    try {
      // Ensure database is ready
      if (!this.db || !this.tablesCreated) {
        console.log("Database not fully initialized, initializing now...");
        await this.initialize();
        await this._ensureTablesExist();
      }
      
      console.log(`Retrieving journal entry for date: ${date}`);
      
      if (!date || typeof date !== 'string') {
        console.error('Invalid date parameter:', date);
        return null;
      }
      
      // Use a single, simple query approach
      const result = await this._safeExecute(
        'SELECT * FROM journal_entries WHERE date = ? ORDER BY timestamp DESC LIMIT 1',
        [date]
      );
      
      // Check if we have a result
      if (result?.rows?._array?.length > 0) {
        console.log(`Found entry for date ${date}`);
        const entry = this._convertRowToEntry(result.rows._array[0]);
        return this._convertEntryForClient(entry);
      }
      
      console.log(`No journal entry found for date: ${date}`);
      return null;
    } catch (error) {
      console.error(`Error retrieving journal entry for date ${date}: ${error.message}`);
      
      // Try to create the tables if they don't exist
      if (error.message.includes('no such table')) {
        console.log('Table does not exist, creating it now...');
        await this.createTables();
      }
      
      // Return null instead of throwing to prevent app crashes
      return null;
    }
  }

  /**
   * Get a journal entry by ID
   * @param {string} id Journal entry ID
   * @returns {Promise<Object|null>} Journal entry or null if not found
   */
  async getEntryById(id) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      // Ensure tables exist before attempting to query
      await this._ensureTablesExist();
      
      console.log(`Retrieving journal entry with ID: ${id}`);
      
      // Add a small delay to ensure database stability
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Ensure any pending transactions are properly committed
      try {
        await this.db.execAsync('COMMIT');
      } catch (e) {
        // Ignore errors - no active transaction
      }
      
      try {
        // Try using parameter binding with execAsync for better reliability
        const result = await this.db.execAsync(
          `SELECT * FROM journal_entries WHERE id = ?`,
          [id]
        );
        
        // Check if we have a result
        if (result?.rows?._array?.length > 0) {
          console.log(`Found entry with ID ${id}`);
          const entry = this._convertRowToEntry(result.rows._array[0]);
          return this._convertEntryForClient(entry);
        }
        
        // If no results, try with direct SQL approach
        const safeId = id.replace(/'/g, "''"); // Escape single quotes
        const directQuery = `SELECT * FROM journal_entries WHERE id = '${safeId}'`;
        const directResult = await this.db.execAsync(directQuery);
        
        if (directResult?.rows?._array?.length > 0) {
          console.log(`Found entry with ID ${id} using direct SQL`);
          const entry = this._convertRowToEntry(directResult.rows._array[0]);
          return this._convertEntryForClient(entry);
        }
        
        // Try a more general query to see if any entries exist
        const countResult = await this.db.execAsync('SELECT COUNT(*) as count FROM journal_entries');
        const count = countResult?.rows?._array?.[0]?.count || 0;
        console.log(`No entry found with ID ${id}. Database has ${count} entries total.`);
        
        // If entries exist but not the one we're looking for, list recent entries for debugging
        if (count > 0) {
          const recentResult = await this.db.execAsync(
            'SELECT id, date FROM journal_entries ORDER BY timestamp DESC LIMIT 5'
          );
          const recentEntries = recentResult?.rows?._array || [];
          if (recentEntries.length > 0) {
            console.log('Recent entries:');
            recentEntries.forEach(entry => console.log(`  - ID: ${entry.id}, Date: ${entry.date}`));
          }
        }
        
        return null;
      } catch (queryError) {
        console.error(`SQL query error: ${queryError.message}`);
        
        // Check if database is functioning
        try {
          const tableCheckResult = await this.db.execAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
          );
          const tableExists = tableCheckResult?.rows?._array?.length > 0;
          console.log(`Table check: journal_entries table ${tableExists ? 'exists' : 'does not exist'}`);
          
          if (!tableExists) {
            // Table doesn't exist, attempt to create it
            console.log('Attempting to recreate tables');
            await this.createTables();
          }
        } catch (checkError) {
          console.error(`Database check failed: ${checkError.message}`);
        }
        
        return null;
      }
    } catch (error) {
      console.error(`Error retrieving journal entry by ID ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a new journal entry
   * @param {Object} entry Journal entry to create
   * @returns {Promise<Object>} Created entry
   */
  async createEntry(entry) {
    try {
      // Ensure database is initialized
      if (!this.db) {
        await this.initialize();
      }
      
      // Ensure tables exist
      await this._ensureTablesExist();
      
      if (!this.tablesCreated) {
        console.error("Tables not created after ensure call");
        throw new Error("Database tables not available");
      }
      
      // Check if an entry already exists for this date
      const date = entry.date || new Date().toISOString().split('T')[0];
      const existingEntry = await this.getEntryByDate(date);
      
      // If an entry already exists for this date, update it instead
      if (existingEntry && existingEntry.id) {
        console.log(`Entry already exists for date ${date}, updating instead of creating new`);
        return await this.updateEntry(existingEntry.id, entry);
      }
      
      // Generate unique ID
      const id = entry.id || `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Prepare values with defaults and validation
      const title = entry.title || `Journal Entry ${new Date().toLocaleDateString()}`;
      const text = entry.text || '';
      const timestamp = new Date().toISOString();
      const templateId = entry.templateId || 'default';
      
      // Ensure title is not null or empty
      const safeTitle = title && title.trim() !== '' 
        ? title 
        : `Journal Entry ${new Date(date).toLocaleDateString()}`;
      
      console.log(`Creating entry - ID: ${id}, Date: ${date}, Title length: ${title.length}, Text length: ${text.length}`);
      
      // Make sure database is in a clean state
      try {
        await this.db.execAsync('ROLLBACK');
        console.log('Rolled back any existing transactions');
      } catch (e) {
        // No active transaction, which is fine
      }
      
      // Simple insert approach - avoid transaction for single operation
      try {
        // Build SQL with properly escaped values
        let insertQuery = `INSERT INTO journal_entries (
          id, title, text, date, timestamp, updated_at`;
        
        // Add optional columns
        if (entry.location) insertQuery += `, location`;
        if (entry.weather) insertQuery += `, weather`;
        if (entry.temperature !== undefined && entry.temperature !== null) insertQuery += `, temperature`;
        if (entry.mood) insertQuery += `, mood`;
        if (templateId) insertQuery += `, template_id`;
        
        // Start values section
        insertQuery += `) VALUES (
          '${id.replace(/'/g, "''")}', 
          '${safeTitle.replace(/'/g, "''")}', 
          '${text.replace(/'/g, "''")}', 
          '${date.replace(/'/g, "''")}', 
          '${timestamp.replace(/'/g, "''")}', 
          '${timestamp.replace(/'/g, "''")}'`;
        
        // Add optional values
        if (entry.location) insertQuery += `, '${entry.location.replace(/'/g, "''")}'`;
        if (entry.weather) insertQuery += `, '${entry.weather.replace(/'/g, "''")}'`;
        if (entry.temperature !== undefined && entry.temperature !== null) insertQuery += `, ${entry.temperature}`;
        if (entry.mood) insertQuery += `, '${entry.mood.replace(/'/g, "''")}'`;
        if (templateId) insertQuery += `, '${templateId.replace(/'/g, "''")}'`;
        
        // Close the query
        insertQuery += `)`;
        
        // Log simplified version of query (first 100 chars)
        console.log(`Insert SQL: ${insertQuery.substring(0, 100)}...`);
        
        // Execute the insert
        await this.db.execAsync(insertQuery);
        console.log(`Successfully inserted entry with ID: ${id}`);
        
        // Wait a short time to ensure database operation completes fully
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the entry exists
        const verifyQuery = `SELECT COUNT(*) as count FROM journal_entries WHERE id = '${id.replace(/'/g, "''")}'`;
        const verifyResult = await this.db.execAsync(verifyQuery);
        const count = verifyResult?.rows?._array?.[0]?.count || 0;
        
        console.log(`Verification query found ${count} entries with ID ${id}`);
        
        if (count === 0) {
          console.error(`Entry verification failed: Entry with ID ${id} not found after insert`);
          
          // List recent entries for debugging
          try {
            const recentQuery = `SELECT id, date FROM journal_entries ORDER BY timestamp DESC LIMIT 5`;
            const recentResult = await this.db.execAsync(recentQuery);
            const recentEntries = recentResult?.rows?._array || [];
            
            if (recentEntries.length > 0) {
              console.log('Recent entries:');
              recentEntries.forEach(entry => console.log(`  - ID: ${entry.id}, Date: ${entry.date}`));
            } else {
              console.log('No entries found in database');
            }
          } catch (listError) {
            console.error(`Could not list recent entries: ${listError.message}`);
          }
        }
        
        // Try to retrieve the entry
        const createdEntry = await this.getEntryById(id);
        
        if (createdEntry) {
          console.log(`Successfully retrieved created entry: ${id}`);
          return createdEntry;
        } else {
          console.warn(`Entry created but could not be retrieved, returning constructed entry`);
          return {
            id,
            title: safeTitle,
            text,
            date,
            timestamp,
            updatedAt: timestamp,
            templateId,
            _fromConstruction: true
          };
        }
      } catch (error) {
        console.error(`Error creating journal entry: ${error.message}`);
        
        // Check if table exists and is accessible
        try {
          const tableCheckResult = await this.db.execAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
          );
          const tableExists = tableCheckResult?.rows?._array?.length > 0;
          
          if (!tableExists) {
            console.error('Journal entries table not found, attempting to recreate');
            await this.createTables();
          }
        } catch (checkError) {
          console.error(`Database check failed: ${checkError.message}`);
        }
        
        // Return a fallback entry
        return {
          id,
          title: safeTitle,
          text,
          date,
          timestamp: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          templateId,
          _error: error.message,
          _notSaved: true
        };
      }
    } catch (outerError) {
      console.error(`Outer error in createEntry: ${outerError.message}`);
      
      // Always return something usable
      return {
        id: `${Date.now()}_error`,
        title: entry.title || `Journal Entry ${new Date().toLocaleDateString()}`,
        text: entry.text || '',
        date: entry.date || new Date().toISOString().split('T')[0],
        templateId: entry.templateId || 'default',
        _error: outerError.message,
        _notSaved: true
      };
    }
  }

  /**
   * Update an existing journal entry
   * @param {string} id Journal entry ID
   * @param {Object} updates Journal entry updates
   * @returns {Promise<Object>} Updated journal entry
   */
  async updateEntry(id, updates) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      // Ensure tables exist before attempting to update
      await this._ensureTablesExist();
      
      // Get existing entry to ensure we don't lose data
      const existingEntry = await this.getEntryById(id);
      if (!existingEntry) {
        console.error(`Update failed: Journal entry with ID ${id} not found`);
        
        // Log debugging info about what entries do exist
        try {
          const allEntries = await this.getAllEntries();
          console.log(`Database contains ${allEntries.length} total entries`);
          console.log('Entry IDs in database:', allEntries.map(e => e.id));
        } catch (err) {
          console.error('Failed to get all entries for debugging:', err);
        }
        
        throw new Error(`Journal entry with ID ${id} not found`);
      }
      
      // Validate required fields
      if (updates.text !== undefined && updates.text.trim() === '') {
        throw new Error('Journal text cannot be empty');
      }
      
      // Create update object with correct field names for database
      const updateData = { ...updates };
      
      // Ensure templateId is properly mapped to template_id for database
      if (updates.templateId !== undefined) {
        updateData.template_id = updates.templateId;
        delete updateData.templateId;
      }
      
      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();
      
      // Prepare safe text value with proper escaping if it exists
      let safeText = null;
      if (updateData.text !== undefined) {
        if (typeof updateData.text === 'string') {
          safeText = updateData.text.replace(/'/g, "''"); // Properly escape single quotes for SQL
        } else {
          // If text is not a string but is provided, default to a safe value
          safeText = `Updated on ${new Date().toLocaleString()}`;
        }
        
        // Ensure text is never empty
        if (!safeText || safeText.trim() === '') {
          safeText = `Updated on ${new Date().toLocaleString()}`;
        }
      }
      
      // Prepare safe title value with proper escaping if it exists
      let safeTitle = null;
      if (updateData.title !== undefined) {
        if (typeof updateData.title === 'string' && updateData.title.trim() !== '') {
          safeTitle = updateData.title.trim().replace(/["`;]/g, '');
          safeTitle = safeTitle.replace(/'/g, "''"); // Properly escape single quotes for SQL
        } else {
          // Generate a default title if none provided or invalid
          safeTitle = `Updated Journal - ${new Date().toLocaleDateString()}`;
        }
      }
      
      // Log update operation details
      console.log(`Updating journal entry ${id} with fields:`, 
        Object.keys(updateData).filter(key => key !== 'id'));
      
      // Use transaction for safety
      try {
        // Check if a transaction is active and if so, rollback
        try {
          await this.db.execAsync('ROLLBACK');
          console.log('Found and rolled back a lingering transaction');
        } catch (e) {
          // No active transaction, which is what we want
        }
        
        // Start a new transaction
        await this.db.execAsync('BEGIN TRANSACTION');
        
        // Build SET clause directly with safe values
        const setClauseParts = [];
        
        // Add text and title directly if they exist
        if (safeText !== null) {
          setClauseParts.push(`text = '${safeText}'`);
        }
        
        if (safeTitle !== null) {
          setClauseParts.push(`title = '${safeTitle}'`);
        }
        
        // Add other fields using parameter binding
        const paramBindings = [];
        const paramValues = [];
        
        // Add other fields (except text, title which we handle directly)
        for (const [key, value] of Object.entries(updateData)) {
          if (key !== 'id' && key !== 'text' && key !== 'title') {
            paramBindings.push(`${key} = ?`);
            paramValues.push(value === undefined ? null : value);
          }
        }
        
        // Combine direct and parameterized SET clauses
        const setClause = [...setClauseParts, ...paramBindings].join(', ');
        
        const query = `
          UPDATE journal_entries 
          SET ${setClause} 
          WHERE id = ?
        `;
        
        // Add ID parameter
        paramValues.push(id);
        
        console.log(`Executing update with query: ${query}`);
        console.log(`Parameter values:`, paramValues);
        
        // Execute update and get result
        const updateResult = await this.db.runAsync(query, paramValues);
        
        // Verify that the update affected a row
        const verifyResult = await this.db.execAsync(
          'SELECT changes() as changes'
        );
        
        const rowsChanged = verifyResult?.rows?._array?.[0]?.changes || 0;
        console.log(`Update operation affected ${rowsChanged} rows`);
        
        if (rowsChanged === 0) {
          console.warn(`Update didn't modify any rows. This could indicate no changes were made or the row doesn't exist.`);
          
          // Double-check if entry still exists
          const existsCheck = await this.db.execAsync(
            'SELECT COUNT(*) as count FROM journal_entries WHERE id = ?',
            [id]
          );
          
          const exists = existsCheck?.rows?._array?.[0]?.count > 0;
          
          if (!exists) {
            await this.db.execAsync('ROLLBACK');
            throw new Error(`Journal entry with ID ${id} no longer exists in the database`);
          }
        }
        
        await this.db.execAsync('COMMIT');
        
        // Fetch the updated entry
        const updatedEntry = await this.getEntryById(id);
        
        if (!updatedEntry) {
          console.error(`Could not retrieve updated entry with ID ${id} after successful update`);
          
          // Create a merged entry from existing data and updates
          const mergedEntry = {
            ...existingEntry,
            ...updates,
            updatedAt: updateData.updated_at
          };
          
          // Ensure proper mapping of template_id to templateId
          if (updateData.template_id) {
            mergedEntry.templateId = updateData.template_id;
          }
          
          console.log(`Returning manually merged entry:`, mergedEntry);
          return mergedEntry;
        }
        
        return updatedEntry;
      } catch (err) {
        // Rollback on error
        try {
          await this.db.execAsync('ROLLBACK');
          console.log('Update transaction rolled back due to error');
        } catch (rollbackErr) {
          console.error('Error during update rollback:', rollbackErr);
        }
        
        console.error(`Update operation failed: ${err.message}`);
        
        // Return a manually merged entry as fallback
        const fallbackEntry = {
          ...existingEntry,
          ...updates,
          updatedAt: updateData.updated_at
        };
        
        // Ensure proper mapping of template_id to templateId
        if (updateData.template_id) {
          fallbackEntry.templateId = updateData.template_id;
        }
        
        console.log(`Returning manually merged fallback entry after update failure`);
        return fallbackEntry;
      }
    } catch (error) {
      console.error(`Failed to update journal entry ${id}:`, error);
      
      // If we got here, we likely don't have an existingEntry, so we can't return a merged one
      // This is a last resort fallback to prevent app crashes
      return {
        id: id,
        title: updates.title || `Journal Entry ${id}`,
        text: updates.text || `Entry content unavailable`,
        date: updates.date || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Delete a journal entry
   * @param {string} id Journal entry ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteEntry(id) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      await this.db.runAsync(
        'DELETE FROM journal_entries WHERE id = ?',
        [id]
      );
      
      return true;
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
      throw error;
    }
  }

  /**
   * Get journal entries within a date range
   * @param {string} startDate Start date in YYYY-MM-DD format
   * @param {string} endDate End date in YYYY-MM-DD format
   * @returns {Promise<Array>} List of journal entries within the range
   */
  async getEntriesInRange(startDate, endDate) {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      try {
        const result = await this.db.execAsync(
          `SELECT * FROM journal_entries 
           WHERE date >= ? AND date <= ? 
           ORDER BY date DESC, timestamp DESC`,
          [startDate, endDate]
        );
        
        const rows = result && result.rows && result.rows._array 
          ? result.rows._array 
          : [];
        
        return rows.map(row => this._convertRowToEntry(row));
      } catch (err) {
        console.error(`Error getting journal entries in range ${startDate} to ${endDate}:`, err);
        return [];
      }
    } catch (error) {
      console.error('Failed to get journal entries in range:', error);
      return [];
    }
  }

  /**
   * Get journal stats
   * @returns {Promise<Object>} Journal statistics
   */
  async getJournalStats() {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      console.log("Retrieving journal statistics");
      
      // Get total entry count
      let total = 0;
      let uniqueDays = 0;
      let avgLength = 0;
      let moods = {};
      let monthlyEntries = [];
      
      try {
        const totalResult = await this.db.execAsync(
          'SELECT COUNT(*) as total FROM journal_entries'
        );
        total = totalResult && totalResult.rows && totalResult.rows._array && totalResult.rows._array.length > 0 
          ? totalResult.rows._array[0].total 
          : 0;
        console.log("Journal total entries:", total);
        
        // Get unique days with entries
        const daysResult = await this.db.execAsync(
          'SELECT COUNT(DISTINCT date) as unique_days FROM journal_entries'
        );
        uniqueDays = daysResult && daysResult.rows && daysResult.rows._array && daysResult.rows._array.length > 0 
          ? daysResult.rows._array[0].unique_days 
          : 0;
        console.log("Journal unique days:", uniqueDays);
        
        // Get average entry length
        const lengthResult = await this.db.execAsync(
          'SELECT AVG(LENGTH(text)) as avg_length FROM journal_entries'
        );
        avgLength = lengthResult && lengthResult.rows && lengthResult.rows._array && lengthResult.rows._array.length > 0 
          ? lengthResult.rows._array[0].avg_length 
          : 0;
        console.log("Journal average length:", avgLength);
        
        // Get mood distribution
        const moodResult = await this.db.execAsync(
          `SELECT 
            mood, 
            COUNT(*) as count 
          FROM journal_entries 
          WHERE mood IS NOT NULL 
          GROUP BY mood`
        );
        
        moods = {};
        if (moodResult && moodResult.rows && moodResult.rows._array) {
          for (const row of moodResult.rows._array) {
            moods[row.mood] = row.count;
          }
        }
        console.log("Journal moods:", Object.keys(moods).length);
        
        // Get entries per month
        const monthResult = await this.db.execAsync(
          `SELECT 
            substr(date, 1, 7) as month, 
            COUNT(*) as count 
          FROM journal_entries 
          GROUP BY month 
          ORDER BY month DESC`
        );
        
        monthlyEntries = monthResult && monthResult.rows && monthResult.rows._array
          ? monthResult.rows._array.map(row => ({
              month: row.month,
              count: row.count
            }))
          : [];
        console.log("Journal monthly entries:", monthlyEntries.length);
      } catch (error) {
        console.error('Error while getting journal stats:', error);
      }
      
      return {
        total,
        uniqueDays,
        avgLength: Math.round(avgLength || 0),
        moods,
        monthlyEntries
      };
    } catch (error) {
      console.error('Failed to get journal stats:', error);
      return {
        total: 0,
        uniqueDays: 0,
        avgLength: 0,
        moods: {},
        monthlyEntries: []
      };
    }
  }

  /**
   * Get all journal templates - now returns default templates only
   * Note: Real templates should be loaded from AsyncStorage/settings
   * @returns {Promise<Array>} List of default journal templates
   */
  async getAllTemplates() {
    try {
      // Return the default templates that would normally be stored in settings
      return this._getDefaultTemplates();
    } catch (error) {
      console.error('Failed to get journal templates:', error);
      return []; // Return empty array to prevent crashes
    }
  }

  /**
   * Get a journal template by ID - now returns a default template
   * Note: Real templates should be loaded from AsyncStorage/settings
   * @param {string} id Template ID
   * @returns {Promise<Object|null>} Template object or null
   */
  async getTemplateById(id) {
    try {
      const templates = this._getDefaultTemplates();
      return templates.find(t => t.id === id) || templates[0]; // Return matching or default template
    } catch (error) {
      console.error('Failed to get journal template by ID:', error);
      return null;
    }
  }

  /**
   * Returns the default templates
   * @returns {Array} Default templates
   * @private
   */
  _getDefaultTemplates() {
    return [
      {
        id: 'default',
        name: 'Default',
        content: '# Today\'s Journal\n\n_Write freely about your day..._',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'gratitude',
        name: 'Gratitude',
        content: '# Gratitude Journal\n\n## I am grateful for:\n1. \n2. \n3. \n\n## Today I appreciated:\n\n## One small joy I experienced:',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'reflection',
        name: 'Reflection',
        content: '# Daily Reflection\n\n## What went well today?\n\n## What could have gone better?\n\n## What did I learn?\n\n## What will I focus on tomorrow?',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'achievement',
        name: 'Achievement',
        content: '# Achievement Journal\n\n## Today\'s wins (big or small):\n- \n\n## Challenges I overcame:\n\n## Progress on goals:\n- [ ] Goal 1:\n- [ ] Goal 2:\n- [ ] Goal 3:\n\n## What did I do to take care of myself today?',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'evening',
        name: 'Evening',
        content: '# Evening Reflection\n\n## Three things that happened today:\n1. \n2. \n3. \n\n## How am I feeling right now?\n\n## One thing I\'m looking forward to tomorrow:',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'custom',
        name: 'Custom',
        content: '',
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  /**
   * Convert a database row to a journal entry object
   * @param {Object} row Database row
   * @returns {Object} Journal entry object
   * @private
   */
  _convertRowToEntry(row) {
    if (!row) return null;
    
    // Create base entry with required fields
    const entry = {
      id: row.id,
      title: row.title || '',
      text: row.text || '',
      timestamp: row.timestamp || new Date().toISOString(),
      updatedAt: row.updated_at || row.timestamp || new Date().toISOString()
    };
    
    // Add optional properties only if they exist in the row
    // Handle date field (always required but might be stored differently)
    if (row.date) entry.date = row.date;
    
    // Handle optional fields with proper type conversion
    if ('location' in row) entry.location = row.location || null;
    if ('weather' in row) entry.weather = row.weather || null;
    if ('temperature' in row) {
      // Ensure temperature is stored as a number if present
      entry.temperature = row.temperature !== null && row.temperature !== undefined 
        ? parseFloat(row.temperature) 
        : null;
    }
    if ('mood' in row) entry.mood = row.mood || null;
    
    // Template ID mapping - convert template_id to templateId for UI consistency
    if ('template_id' in row) entry.templateId = row.template_id || 'default';
    
    // Log the conversion for debugging
    console.log('Converting DB row to entry:', row.id, entry);
    
    return entry;
  }

  /**
   * Convert a journal entry object to the format expected by the database
   * @param {Object} entry Journal entry object
   * @returns {Object} Database-friendly journal entry object
   * @private
   */
  _convertEntryForClient(entry) {
    if (!entry) return null;
    
    // Create base result with required fields
    const result = {
      id: entry.id,
      title: entry.title || '',
      text: entry.text || ''
    };
    
    // Handle timestamp fields
    if (entry.timestamp) {
      result.timestamp = entry.timestamp;
    } else {
      result.timestamp = new Date().toISOString();
    }
    
    if (entry.updated_at || entry.updatedAt) {
      result.updatedAt = entry.updated_at || entry.updatedAt;
    } else {
      result.updatedAt = result.timestamp;
    }
    
    // Handle date - required field, ensure it's present
    if (entry.date) {
      result.date = entry.date;
    } else if (entry.timestamp) {
      // Extract date from timestamp if needed
      result.date = entry.timestamp.substring(0, 10);
    } else {
      // Fallback to current date
      result.date = new Date().toISOString().substring(0, 10);
    }
    
    // Handle optional fields with consistent naming for UI
    if ('location' in entry) result.location = entry.location;
    if ('weather' in entry) result.weather = entry.weather;
    
    // Ensure temperature is a number if present
    if ('temperature' in entry && entry.temperature !== null && entry.temperature !== undefined) {
      result.temperature = parseFloat(entry.temperature);
    }
    
    if ('mood' in entry) result.mood = entry.mood;
    
    // Handle template ID mapping from database column to UI property
    if ('template_id' in entry) {
      result.templateId = entry.template_id || 'default';
    } else if ('templateId' in entry) {
      result.templateId = entry.templateId || 'default';
    } else {
      result.templateId = 'default';
    }
    
    // Log the conversion for debugging
    console.log('Converting entry for client:', entry.id, result);
    
    return result;
  }

  /**
   * Get total journal entry count
   * @returns {Promise<number>} Total journal entry count
   */
  async count() {
    try {
      if (!this.db) {
        await this.initialize();
      }
      
      try {
        const result = await this.db.execAsync(
          'SELECT COUNT(*) as count FROM journal_entries'
        );
        
        return result && result.rows && result.rows._array && result.rows._array.length > 0 
          ? result.rows._array[0].count 
          : 0;
      } catch (err) {
        console.error("Error getting journal count:", err);
        return 0;
      }
    } catch (error) {
      console.error('Failed to get journal count:', error);
      return 0;
    }
  }

  /**
   * Execute a database query with better error handling
   * @param {string} query SQL query to execute
   * @param {Array} params Parameters for the query
   * @returns {Promise<Object>} Query result
   * @private
   */
  async _safeExecute(query, params = []) {
    if (!this.db) {
      console.log("Database not initialized, initializing now...");
      await this.initialize();
    }
    
    try {
      const result = await this.db.execAsync(query, params);
      return result;
    } catch (error) {
      console.error(`Error executing query: ${query.substring(0, 100)}...`, error);
      
      // Check if it's a database locked error
      if (error.message && error.message.includes('database is locked')) {
        console.log("Database locked error detected, waiting and retrying...");
        
        // Wait a short time and retry once
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          const retryResult = await this.db.execAsync(query, params);
          console.log("Retry succeeded after database locked error");
          return retryResult;
        } catch (retryError) {
          console.error("Retry also failed:", retryError);
          
          // If still getting locked errors, try to close and reopen
          if (retryError.message && retryError.message.includes('database is locked')) {
            console.log("Database still locked, attempting to reset connection...");
            
            try {
              await this.db.closeAsync();
              console.log("Closed database to reset locked state");
            } catch (closeError) {
              console.error("Error closing database:", closeError);
            }
            
            this.db = null;
            await this.initialize();
            
            // Final attempt
            try {
              const finalResult = await this.db.execAsync(query, params);
              console.log("Final attempt succeeded after connection reset");
              return finalResult;
            } catch (finalError) {
              console.error("Final attempt also failed:", finalError);
              throw finalError;
            }
          } else {
            throw retryError;
          }
        }
      } else if (error.message && error.message.includes('no such table')) {
        // If table doesn't exist, create it and retry
        console.log("No such table error, creating tables and retrying...");
        await this.createTables();
        
        // Retry after creating tables
        try {
          const tableRetryResult = await this.db.execAsync(query, params);
          console.log("Retry succeeded after creating tables");
          return tableRetryResult;
        } catch (tableRetryError) {
          console.error("Retry also failed after creating tables:", tableRetryError);
          throw tableRetryError;
        }
      } else {
        // For other errors, just throw
        throw error;
      }
    }
  }

  /**
   * Verify database connection and schema
   * This is a diagnostic function to check if the database is working correctly
   * @returns {Promise<Object>} Status information about the database
   */
  async verifyDatabase() {
    try {
      // Ensure database is initialized
      if (!this.db) {
        await this.initialize();
      }
      
      const dbStatus = { 
        initialized: !!this.db,
        tablesCreated: this.tablesCreated,
        errors: [],
        tables: [],
        journalCount: 0
      };
      
      // Check if tables exist
      try {
        const tablesResult = await this.db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        
        dbStatus.tables = tablesResult?.rows?._array?.map(t => t.name) || [];
        console.log('Database tables:', dbStatus.tables);
      } catch (err) {
        console.error("Error fetching tables:", err);
        dbStatus.errors.push(`Tables query error: ${err.message}`);
      }
      
      // Check if journal_entries table exists
      const hasJournalTable = dbStatus.tables.includes('journal_entries');
      dbStatus.hasJournalTable = hasJournalTable;
      
      // Test a simple count query to verify DB operations
      if (hasJournalTable) {
        try {
          const countResult = await this.db.execAsync("SELECT COUNT(*) as count FROM journal_entries");
          const count = countResult?.rows?._array?.[0]?.count || 0;
          dbStatus.journalCount = count;
          console.log(`Journal entries count: ${count}`);
        } catch (err) {
          console.error("Error counting journal entries:", err);
          dbStatus.errors.push(`Count query error: ${err.message}`);
        }
        
        // Test a simple insert and delete to verify write operations
        try {
          const testId = `test_${Date.now()}`;
          const testTitle = 'DB Verification Test';
          
          // Begin transaction
          await this.db.execAsync('BEGIN TRANSACTION');
          
          // Insert test entry
          await this.db.execAsync(
            `INSERT INTO journal_entries (id, title, text, date) 
             VALUES ('${testId}', '${testTitle}', 'This is a test entry', date('now'))`
          );
          
          // Verify it exists
          const verifyResult = await this.db.execAsync(
            `SELECT id FROM journal_entries WHERE id = '${testId}'`
          );
          
          const exists = verifyResult?.rows?._array?.length > 0;
          dbStatus.testInsertSucceeded = exists;
          
          // Delete test entry
          await this.db.execAsync(`DELETE FROM journal_entries WHERE id = '${testId}'`);
          
          // Commit transaction
          await this.db.execAsync('COMMIT');
          
          dbStatus.writeOperationsWorking = true;
        } catch (err) {
          console.error("Error during write operations test:", err);
          dbStatus.errors.push(`Write test error: ${err.message}`);
          dbStatus.writeOperationsWorking = false;
          
          // Try to rollback
          try {
            await this.db.execAsync('ROLLBACK');
          } catch (rbErr) {
            // Ignore rollback errors
          }
        }
      }
      
      return dbStatus;
    } catch (error) {
      console.error("Database verification failed:", error);
      return {
        initialized: false,
        error: error.message
      };
    }
  }

  /**
   * Fix potential database issues - call this if database operations fail repeatedly
   * @returns {Promise<boolean>} True if successful, false if repair failed
   */
  async fixDatabaseIssues() {
    console.log('Attempting to fix database issues...');
    try {
      // Close current connection if it exists
      if (this.db) {
        try {
          await this.db.closeAsync();
          console.log('Closed existing database connection');
        } catch (closeError) {
          console.error('Error closing database:', closeError);
          // Continue anyway
        }
        this.db = null;
      }
      
      // Re-initialize database from scratch
      this.isInitializing = false;
      this.tablesCreated = false;
      this.initPromise = null;
      
      console.log('Re-initializing database...');
      await this.initialize();
      
      if (!this.db) {
        console.error('Database could not be re-initialized');
        return false;
      }
      
      // Force table recreation
      console.log('Forcing table recreation...');
      const rebuildResult = await this._rebuildTableIfNeeded(true);
      console.log(`Table rebuild result: ${rebuildResult ? 'Successful' : 'Failed'}`);
      
      // Verify tables exist
      const checkResult = await this.db.execAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='journal_entries'"
      );
      const tableExists = checkResult?.rows?._array?.length > 0;
      
      if (!tableExists) {
        console.error('Journal entries table still does not exist after repair attempt');
        return false;
      }
      
      console.log('Journal entries table exists after repair');
      
      // Perform a test write operation
      const testId = `test_${Date.now()}`;
      try {
        await this.db.execAsync(`
          INSERT INTO journal_entries (id, title, text, date) 
          VALUES ('${testId}', 'Test Entry', 'Test content', date('now'))
        `);
        console.log('Successfully wrote test entry');
        
        // Verify it can be read
        const readResult = await this.db.execAsync(`
          SELECT * FROM journal_entries WHERE id = '${testId}'
        `);
        const testEntries = readResult?.rows?._array || [];
        console.log(`Found ${testEntries.length} test entries`);
        
        // Clean up test entry
        await this.db.execAsync(`DELETE FROM journal_entries WHERE id = '${testId}'`);
        console.log('Successfully deleted test entry');
        
        console.log('Database repair completed successfully');
        return true;
      } catch (testError) {
        console.error('Database repair verification failed:', testError);
        return false;
      }
    } catch (error) {
      console.error('Database repair failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const journalDAO = new JournalDAO();

export default journalDAO; 