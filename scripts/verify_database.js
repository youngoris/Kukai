/**
 * Database verification script
 * 
 * This script tests the database connection and schema
 * Run with: npx expo run:ios --no-build
 */
import TaskDAO from '../src/dao/TaskDAO';
import JournalDAO from '../src/dao/JournalDAO';

// Wait for app to initialize
setTimeout(async () => {
  console.log('======== DATABASE VERIFICATION SCRIPT ========');
  
  try {
    // Initialize DAOs
    console.log('Initializing TaskDAO...');
    await TaskDAO.initialize();
    console.log('TaskDAO initialized successfully');
    
    console.log('Initializing JournalDAO...');
    await JournalDAO.initialize();
    console.log('JournalDAO initialized successfully');
    
    // Verify task table structure
    console.log('\nVerifying tasks table structure...');
    const taskDB = TaskDAO.db;
    const tasksTableInfo = await taskDB.getAllAsync('PRAGMA table_info(tasks)');
    console.log('Task table columns:');
    tasksTableInfo.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    // Verify journal table structure
    console.log('\nVerifying journal_entries table structure...');
    const journalDB = JournalDAO.db;
    const journalTableInfo = await journalDB.getAllAsync('PRAGMA table_info(journal_entries)');
    console.log('Journal table columns:');
    journalTableInfo.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
    
    // Test task creation
    console.log('\nTesting task creation...');
    const testTask = await TaskDAO.createTask({
      text: 'Test task',
      description: 'This is a test task created by the verification script',
      isFrog: true,
      isImportant: true
    });
    console.log('Created test task:', testTask.id);
    
    // Test journal entry creation
    console.log('\nTesting journal entry creation...');
    const today = new Date().toISOString().split('T')[0];
    const testEntry = await JournalDAO.createEntry({
      title: 'Test Journal',
      text: 'This is a test journal entry created by the verification script',
      date: today,
      mood: 'happy'
    });
    console.log('Created test journal entry:', testEntry.id);
    
    // Test retrieving the created data
    console.log('\nVerifying data retrieval...');
    const retrievedTask = await TaskDAO.getTaskById(testTask.id);
    console.log('Retrieved task:', retrievedTask ? 'Success' : 'Failed');
    
    const retrievedEntry = await JournalDAO.getEntryById(testEntry.id);
    console.log('Retrieved journal entry:', retrievedEntry ? 'Success' : 'Failed');
    
    // Clean up test data
    console.log('\nCleaning up test data...');
    await TaskDAO.deleteTask(testTask.id);
    await JournalDAO.deleteEntry(testEntry.id);
    
    console.log('\n======== VERIFICATION COMPLETE ========');
    console.log('Database is working properly!');
  } catch (error) {
    console.error('\n======== VERIFICATION FAILED ========');
    console.error('Database error:', error);
  }
}, 2000); // Wait 2 seconds for app initialization 