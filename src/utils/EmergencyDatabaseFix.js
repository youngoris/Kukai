/**
 * 紧急数据库修复工具
 * 
 * 这个文件包含用于检测和修复数据库问题的函数
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

/**
 * 检查数据库文件是否存在并可访问
 * @param {string} dbName 数据库名称
 * @returns {Promise<boolean>} 数据库是否存在且可访问
 */
export const checkDatabaseExists = async (dbName = 'kukai.db') => {
  try {
    // 获取SQLite目录路径
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }).catch(e => {
      // 目录可能已经存在，这是正常的
      if (!e.message.includes('exists')) throw e;
    });
    
    // 检查数据库文件是否存在
    const dbPath = `${sqliteDir}/${dbName}`;
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    
    // 如果文件存在，还要检查它的大小
    if (fileInfo.exists) {
      // 如果文件大小为0，视为数据库无效
      if (fileInfo.size === 0) {
        console.log('数据库文件存在但大小为0，视为无效');
        return false;
      }
      
      // 尝试打开数据库以验证其有效性
      try {
        const db = await SQLite.openDatabaseAsync(dbPath);
        // 执行简单查询以确认数据库可用
        await db.execAsync('SELECT 1');
        // 关闭数据库
        await db.closeAsync();
        return true;
      } catch (openError) {
        console.error('数据库存在但无法打开:', openError);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('检查数据库存在时出错:', error);
    return false;
  }
};

/**
 * 完全删除数据库文件及相关文件
 * @param {string} dbName 数据库名称
 * @returns {Promise<boolean>} 删除是否成功
 */
export const deleteDatabase = async (dbName = 'kukai.db') => {
  try {
    // 获取SQLite目录路径
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    const dbPath = `${sqliteDir}/${dbName}`;
    
    // 删除数据库文件
    const fileInfo = await FileSystem.getInfoAsync(dbPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      console.log('数据库文件已删除');
    }
    
    // 删除相关的日志文件
    const journalPath = `${dbPath}-journal`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    const journalInfo = await FileSystem.getInfoAsync(journalPath);
    if (journalInfo.exists) {
      await FileSystem.deleteAsync(journalPath, { idempotent: true });
      console.log('Journal文件已删除');
    }
    
    const walInfo = await FileSystem.getInfoAsync(walPath);
    if (walInfo.exists) {
      await FileSystem.deleteAsync(walPath, { idempotent: true });
      console.log('WAL文件已删除');
    }
    
    const shmInfo = await FileSystem.getInfoAsync(shmPath);
    if (shmInfo.exists) {
      await FileSystem.deleteAsync(shmPath, { idempotent: true });
      console.log('SHM文件已删除');
    }
    
    return true;
  } catch (error) {
    console.error('删除数据库文件时出错:', error);
    return false;
  }
};

/**
 * 创建新的空数据库
 * @param {string} dbName 数据库名称
 * @returns {Promise<SQLite.WebSQLDatabase|null>} 新创建的数据库或null（如果失败）
 */
export const createEmptyDatabase = async (dbName = 'kukai.db') => {
  try {
    // 获取SQLite目录路径
    const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true }).catch(e => {
      // 目录可能已经存在，这是正常的
      if (!e.message.includes('exists')) throw e;
    });
    
    // 数据库路径
    const dbPath = `${sqliteDir}/${dbName}`;
    
    // 打开数据库（会自动创建一个空的数据库文件）
    const db = await SQLite.openDatabaseAsync(dbPath);
    console.log('已创建新的空数据库');
    
    return db;
  } catch (error) {
    console.error('创建空数据库时出错:', error);
    return null;
  }
};

/**
 * 创建基本的日志表结构，让标题字段可为空
 * @param {SQLite.WebSQLDatabase} db 数据库对象
 * @returns {Promise<boolean>} 创建是否成功
 */
export const createJournalTable = async (db) => {
  if (!db) return false;
  
  try {
    // 创建日志条目表 - 注意title不使用NOT NULL约束
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        title TEXT,
        text TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT,
        weather TEXT,
        temperature REAL,
        mood TEXT,
        template_id TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建日期索引
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date)');
    
    console.log('日志表创建成功，title字段可为空');
    return true;
  } catch (error) {
    console.error('创建日志表时出错:', error);
    return false;
  }
};

/**
 * 紧急修复数据库 - 如果需要，删除并重新创建数据库
 * @param {string} dbName 数据库名称
 * @returns {Promise<boolean>} 修复是否成功
 */
export const emergencyDatabaseFix = async (dbName = 'kukai.db') => {
  console.log('开始紧急数据库修复...');
  
  try {
    // 首先检查数据库是否存在并可用
    const exists = await checkDatabaseExists(dbName);
    
    if (exists) {
      console.log('数据库已存在且可用，无需紧急修复');
      return true;
    }
    
    // 数据库不存在或不可用，进行修复
    console.log('数据库不存在或损坏，开始修复');
    
    // 删除任何现有的数据库文件
    await deleteDatabase(dbName);
    
    // 创建新的空数据库
    const db = await createEmptyDatabase(dbName);
    if (!db) {
      console.error('无法创建新数据库');
      return false;
    }
    
    // 创建基本表结构
    const tableCreated = await createJournalTable(db);
    if (!tableCreated) {
      console.error('无法创建日志表');
      return false;
    }
    
    // 关闭数据库
    await db.closeAsync();
    console.log('紧急数据库修复完成');
    
    return true;
  } catch (error) {
    console.error('紧急数据库修复失败:', error);
    return false;
  }
};

export default {
  checkDatabaseExists,
  deleteDatabase,
  createEmptyDatabase,
  createJournalTable,
  emergencyDatabaseFix
}; 