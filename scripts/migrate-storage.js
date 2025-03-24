/**
 * Migration script to replace AsyncStorage with StorageService
 * 
 * Run with: node scripts/migrate-storage.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

const projectDir = path.resolve(__dirname, '..');
const srcDir = path.join(projectDir, 'src');

// Files that we've already manually migrated
const excludedFiles = [
  'src/hooks/useAsyncStorage.js',
  'src/context/AppContext.js',
  'src/App.js',
  'src/services/storage/StorageService.js', 
  'src/services/DatabaseService.js',
  'src/services/DatabaseMigrationService.js',
  'src/utils/storageUtils.js'
];

const importRegex = /import\s+(?:(\*\s+as\s+)?(\w+)|{\s*([^}]+)\s*})\s+from\s+['"]@react-native-async-storage\/async-storage['"]/g;
const asyncStorageRegex = /AsyncStorage\.(getItem|setItem|removeItem|multiGet|multiSet|multiRemove|mergeItem|multiMerge|clear|getAllKeys)\(/g;

/**
 * Determine if a file should be processed
 */
function shouldProcessFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx') && !filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
    return false;
  }
  
  const relativePath = path.relative(projectDir, filePath).replace(/\\/g, '/');
  return !excludedFiles.includes(relativePath);
}

/**
 * Process a file to replace AsyncStorage with StorageService
 */
async function processFile(filePath) {
  // Get file content
  const content = await readFile(filePath, 'utf8');
  
  // Skip files that don't use AsyncStorage
  if (!content.includes('AsyncStorage') && !content.includes('async-storage')) {
    return { filePath, processed: false };
  }
  
  // Replace import statement
  let newContent = content.replace(importRegex, 'import storageService from "../services/storage/StorageService"');
  
  // Fix relative path based on file's directory depth
  const relativePath = path.relative(path.dirname(filePath), path.join(srcDir, 'services/storage/StorageService')).replace(/\\/g, '/');
  newContent = newContent.replace('from "../services/storage/StorageService"', `from "${relativePath}"`);
  
  // Replace AsyncStorage method calls
  newContent = newContent.replace(asyncStorageRegex, 'storageService.$1(');
  
  // Add migration comment at the top of the file
  const comment = `/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
`;
  
  // Only add comment if we made changes
  if (newContent !== content) {
    // Add comment if not already present
    if (!newContent.includes('STORAGE MIGRATION')) {
      const lineEndingMatch = newContent.match(/\r?\n/);
      const lineEnding = lineEndingMatch ? lineEndingMatch[0] : '\n';
      
      // Find the first non-comment line to place our comment before it
      const lines = newContent.split(lineEnding);
      let insertIndex = 0;
      
      // Skip any existing comment blocks at the top
      while (insertIndex < lines.length && 
             (lines[insertIndex].trim() === '' || 
              lines[insertIndex].trim().startsWith('/*') || 
              lines[insertIndex].trim().startsWith('*') || 
              lines[insertIndex].trim().startsWith('*/') || 
              lines[insertIndex].trim().startsWith('//'))) {
        insertIndex++;
      }
      
      // If we found the first non-comment line, insert our comment before it
      if (insertIndex > 0 && insertIndex < lines.length) {
        lines.splice(insertIndex, 0, comment);
        newContent = lines.join(lineEnding);
      } else {
        // Otherwise, just prepend the comment
        newContent = comment + newContent;
      }
    }
    
    // Write changes to file
    await writeFile(filePath, newContent, 'utf8');
    return { filePath, processed: true };
  }
  
  return { filePath, processed: false };
}

/**
 * Process all files in a directory recursively
 */
async function processDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  
  const results = [];
  
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      const subResults = await processDirectory(entryPath);
      results.push(...subResults);
    } else if (shouldProcessFile(entryPath)) {
      const result = await processFile(entryPath);
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting AsyncStorage to StorageService migration...');
    
    const results = await processDirectory(srcDir);
    
    const processed = results.filter(r => r.processed);
    console.log(`Processed ${processed.length} files out of ${results.length} total files.`);
    
    if (processed.length > 0) {
      console.log('The following files were updated:');
      processed.forEach(p => console.log(`- ${path.relative(projectDir, p.filePath)}`));
    } else {
      console.log('No files were updated.');
    }
    
    console.log('\nMigration complete!');
    console.log('Note: You should manually check the modified files to ensure they work as expected.');
    console.log('After confirming everything works, you can remove the AsyncStorage fallback from StorageService.js');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main(); 