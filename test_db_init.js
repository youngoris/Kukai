/**
 * Test script to verify SQLite DAO initialization
 */
import * as SQLite from 'expo-sqlite';
import TaskDAO from './src/dao/TaskDAO';
import JournalDAO from './src/dao/JournalDAO';

async function runTest() {
  console.log('Starting database initialization test...');
  
  try {
    // Initialize DAOs
    console.log('Initializing TaskDAO...');
    await TaskDAO.initialize();
    console.log('TaskDAO initialized successfully');
    
    console.log('Initializing JournalDAO...');
    await JournalDAO.initialize();
    console.log('JournalDAO initialized successfully');
    
    // Test TaskDAO methods
    console.log('\nTesting TaskDAO methods...');
    const taskCount = await TaskDAO.count();
    console.log(`Total tasks: ${taskCount}`);
    
    // Create a test task
    const newTask = await TaskDAO.createTask({
      text: 'Test task',
      description: 'This is a test task',
      isFrog: true,
      isImportant: true
    });
    console.log('Created new task with ID:', newTask.id);
    
    // Get the task back
    const retrievedTask = await TaskDAO.getTaskById(newTask.id);
    console.log('Retrieved task:', retrievedTask);
    
    // Test JournalDAO methods
    console.log('\nTesting JournalDAO methods...');
    const journalCount = await JournalDAO.count();
    console.log(`Total journal entries: ${journalCount}`);
    
    // Get templates
    const templates = await JournalDAO.getAllTemplates();
    console.log(`Retrieved ${templates.length} templates`);
    
    // Create a test journal entry
    const today = new Date().toISOString().split('T')[0];
    const newEntry = await JournalDAO.createEntry({
      title: 'Test Journal',
      text: 'This is a test journal entry',
      date: today,
      mood: 'happy'
    });
    console.log('Created new journal entry with ID:', newEntry.id);
    
    // Get the entry back
    const retrievedEntry = await JournalDAO.getEntryById(newEntry.id);
    console.log('Retrieved entry:', retrievedEntry);
    
    // Clean up test data
    console.log('\nCleaning up test data...');
    await TaskDAO.deleteTask(newTask.id);
    await JournalDAO.deleteEntry(newEntry.id);
    console.log('Test data cleaned up successfully');
    
    // Close the database connections
    if (TaskDAO.db) {
      await TaskDAO.db.closeAsync();
    }
    if (JournalDAO.db) {
      await JournalDAO.db.closeAsync();
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runTest(); 