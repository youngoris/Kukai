# 数据库管理系统文档

## 概述

Kukai应用程序的数据库管理系统提供了强大的数据存储、备份和迁移能力。本文档描述了系统架构、关键组件和使用方法。

## 数据库版本控制与迁移

### 功能概述

数据库迁移系统允许应用程序在不同版本间无缝升级数据库结构，确保数据完整性和向后兼容性。

### 关键组件

1. **DatabaseMigrationService**：
   - 管理数据库版本
   - 执行结构迁移
   - 提供回滚能力
   - 在迁移前自动创建备份

2. **迁移表 (db_migrations)**：
   - 跟踪已应用的迁移
   - 存储迁移元数据（版本、时间戳、描述）

### 使用方法

#### 创建新的迁移

```javascript
// 在 src/services/migrations 目录中创建新的迁移文件
// 例如: 001_create_tasks_table.js

export default {
  version: 1,
  name: "创建任务表",
  up: (tx) => {
    tx.executeSql(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT,
        updated_at TEXT
      );
    `);
  },
  down: (tx) => {
    tx.executeSql(`DROP TABLE IF EXISTS tasks;`);
  }
};
```

#### 在应用启动时应用迁移

```javascript
import databaseService from '../services/DatabaseService';
import DatabaseMigrationService from '../services/DatabaseMigrationService';

// 在应用启动时初始化数据库并应用迁移
const initializeDatabase = async () => {
  try {
    // 初始化数据库
    await databaseService.initialize();
    
    // 创建迁移服务
    const migrationService = new DatabaseMigrationService();
    
    // 应用所有待处理的迁移
    const db = databaseService.getDBInstance();
    const result = await migrationService.processMigrations(db);
    
    if (result.success) {
      console.log(`数据库已成功迁移到版本 ${result.dbVersion}`);
    } else {
      console.error('迁移失败:', result.error);
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
};
```

#### 回滚迁移

```javascript
const rollbackLastMigration = async () => {
  try {
    const db = databaseService.getDBInstance();
    const migrationService = new DatabaseMigrationService();
    
    // 创建备份
    await migrationService.backupBeforeMigration();
    
    // 回滚最后一次迁移
    const result = await migrationService.rollbackMigration(db);
    
    if (result.success) {
      console.log(`成功回滚到版本 ${result.version}`);
    } else {
      console.error('回滚失败:', result.error);
    }
  } catch (error) {
    console.error('回滚过程中出错:', error);
  }
};
```

## 数据备份与恢复

### 功能概述

数据库备份系统提供了全面的数据备份、恢复和管理功能，确保用户数据安全和可恢复性。

### 关键组件

1. **DatabaseBackupService**：
   - 创建和管理数据库备份
   - 支持自动备份（每日、每周、每月）
   - 提供备份文件分类和管理
   - 执行备份恢复操作

2. **备份格式**：
   - 使用JSON格式存储数据和元数据
   - 包含创建时间、应用版本和设备信息
   - 支持所有表的数据导出和导入

### 使用方法

#### 创建手动备份

```javascript
import databaseBackupService from '../services/DatabaseBackupService';

const createManualBackup = async () => {
  try {
    // 初始化备份服务
    await databaseBackupService.initialize();
    
    // 创建手动备份
    const result = await databaseBackupService.createBackup('manual');
    
    if (result.success) {
      console.log(`备份创建成功: ${result.backupName}`);
      return result;
    } else {
      console.error('备份创建失败:', result.error);
      return null;
    }
  } catch (error) {
    console.error('备份过程中出错:', error);
    return null;
  }
};
```

#### 恢复备份

```javascript
const restoreFromBackup = async (backupPath) => {
  try {
    // 初始化备份服务
    await databaseBackupService.initialize();
    
    // 从备份恢复
    const result = await databaseBackupService.restoreBackup(backupPath);
    
    if (result.success) {
      console.log('备份恢复成功');
      return true;
    } else {
      console.error('备份恢复失败:', result.error);
      return false;
    }
  } catch (error) {
    console.error('恢复过程中出错:', error);
    return false;
  }
};
```

#### 配置自动备份

```javascript
const configureAutoBackup = async () => {
  try {
    // 初始化备份服务
    await databaseBackupService.initialize();
    
    // 配置自动备份
    const config = {
      auto_backup: true,
      backup_frequency: 'daily', // 'daily', 'weekly', 'monthly'
      keep_count: 7, // 保留数量
      backup_include_media: false, // 是否包含媒体文件
    };
    
    const result = await databaseBackupService.updateBackupConfig(config);
    
    if (result.success) {
      console.log('自动备份已配置');
      return true;
    } else {
      console.error('配置自动备份失败:', result.error);
      return false;
    }
  } catch (error) {
    console.error('配置过程中出错:', error);
    return false;
  }
};
```

#### 管理备份文件

```javascript
const manageBackups = async () => {
  try {
    // 获取备份列表
    const backupsList = await databaseBackupService.getBackupsList();
    
    if (backupsList.success) {
      console.log(`共有 ${backupsList.backups.length} 个备份文件`);
      
      // 获取备份分类
      const categorized = await databaseBackupService.categorizeBackups();
      console.log('自动备份:', categorized.categories.auto.length);
      console.log('手动备份:', categorized.categories.manual.length);
      
      // 获取备份存储使用情况
      const usage = await databaseBackupService.getBackupDiskUsage();
      console.log(`备份总大小: ${usage.formattedTotalSize}`);
      
      // 应用保留策略（清理旧备份）
      const cleanupResult = await databaseBackupService.applyBackupRetentionPolicy();
      console.log(`已删除 ${cleanupResult.deleted.length} 个旧备份`);
    }
  } catch (error) {
    console.error('管理备份过程中出错:', error);
  }
};
```

## 最佳实践

1. **定期备份**：
   - 启用自动备份功能
   - 在重要数据变更前手动创建备份
   - 导出重要备份到设备外部存储

2. **迁移管理**：
   - 为每个数据库结构变更创建迁移脚本
   - 总是提供向下迁移（down）功能
   - 在生产环境测试迁移前在开发环境充分测试

3. **错误恢复**：
   - 监控迁移和备份操作的日志
   - 建立自动恢复策略
   - 定期测试恢复功能

## 故障排除

### 常见问题

1. **迁移失败**：
   - 检查迁移脚本语法
   - 确认数据库没有锁定
   - 尝试从自动备份恢复

2. **备份恢复失败**：
   - 验证备份文件完整性
   - 检查存储权限
   - 确认备份与当前应用版本兼容

3. **性能问题**：
   - 大型数据库备份可能需要较长时间
   - 考虑在后台运行备份操作
   - 优化大表的迁移策略 