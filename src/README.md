# Kukai App - 项目结构

## 目录结构

```
/src
  /components      - 可复用组件
  /screens         - 屏幕组件
  /services        - 服务层（如通知、云备份等）
  /hooks           - 自定义钩子
  /utils           - 工具函数
  /constants       - 常量定义
  /navigation      - 导航相关
  /store           - 状态管理
  /assets          - 静态资源
```

## 组件说明

### 核心组件

- `App.js` - 应用程序入口点
- `AppNavigator.js` - 导航配置

### 屏幕组件

- `HomeScreen.js` - 主屏幕
- `MeditationScreen.js` - 冥想功能
- `TaskScreen.js` - 任务管理
- `FocusScreen.js` - 专注模式
- `SummaryScreen.js` - 日常总结
- `JournalScreen.js` - 日志列表
- `JournalEditScreen.js` - 日志编辑
- `SettingsScreen.js` - 设置页面

### 可复用组件

- `MarkdownRenderer.js` - Markdown渲染组件
- `SettingItem.js` - 设置项组件
- `SettingSection.js` - 设置分组组件
- `CustomDateTimePicker.js` - 自定义日期时间选择器
- `CloudBackupSection.js` - 云备份组件
- `JournalTemplateManager.js` - 日志模板管理器

### 服务

- `GoogleDriveService.js` - Google Drive集成
- `NotificationService.js` - 通知服务

### 自定义钩子

- `useAsyncStorage.js` - AsyncStorage操作钩子
- `useWeather.js` - 天气数据获取钩子

### 常量

- `Config.js` - 配置常量
- `DesignSystem.js` - 设计系统常量
- `JournalTemplates.js` - 日志模板定义

## 开发指南

### 添加新屏幕

1. 在`/src/screens`目录下创建新的屏幕组件
2. 在`/src/navigation/AppNavigator.js`中注册新屏幕

### 添加新组件

1. 在`/src/components`目录下创建新组件
2. 确保组件是可复用的，并有适当的文档

### 添加新服务

1. 在`/src/services`目录下创建新服务
2. 在`App.js`中初始化服务（如果需要）

### 添加新钩子

1. 在`/src/hooks`目录下创建新钩子
2. 确保钩子遵循React Hooks规则

## 代码规范

- 使用ES6+语法
- 组件使用函数式组件和React Hooks
- 使用JSDoc注释记录函数和组件
- 使用适当的错误处理
- 避免直接修改状态，使用不可变更新模式
