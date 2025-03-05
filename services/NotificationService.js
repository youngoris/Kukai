import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 配置通知处理程序
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 全局导航引用，用于通知点击后导航
let navigationRef = null;

// 默认配置
const DEFAULT_CONFIG = {
  taskNotifications: true,
  notificationSound: 'default',
  quietHoursEnabled: false,
  quietHoursStart: new Date().setHours(22, 0, 0, 0),
  quietHoursEnd: new Date().setHours(7, 0, 0, 0)
};

class NotificationService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }
  
  // 设置导航引用
  setNavigationRef(ref) {
    navigationRef = ref;
  }
  
  // 更新配置
  async updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // 保存配置到存储
    await AsyncStorage.setItem('notificationConfig', JSON.stringify(this.config));
    
    console.log('Notification configuration updated:', this.config);
    return this.config;
  }
  
  // 加载配置
  async loadConfig() {
    try {
      const configJson = await AsyncStorage.getItem('notificationConfig');
      if (configJson) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...JSON.parse(configJson)
        };
      }
      console.log('Notification configuration loaded:', this.config);
    } catch (error) {
      console.error('Failed to load notification configuration:', error);
      this.config = { ...DEFAULT_CONFIG };
    }
    return this.config;
  }
  
  // 检查是否在静音时段
  isInQuietHours() {
    if (!this.config.quietHoursEnabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const startDate = new Date(this.config.quietHoursStart);
    const startTime = startDate.getHours() * 60 + startDate.getMinutes();
    
    const endDate = new Date(this.config.quietHoursEnd);
    const endTime = endDate.getHours() * 60 + endDate.getMinutes();
    
    // 处理跨天的情况
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }
  
  // 获取通知声音
  getNotificationSound() {
    // 如果在静音时段，返回null（无声）
    if (this.isInQuietHours()) {
      return null;
    }
    
    // 根据配置返回声音
    switch (this.config.notificationSound) {
      case 'none':
        return null;
      case 'gentle':
        return Platform.OS === 'ios' ? 'gentle.wav' : 'gentle';
      case 'alert':
        return Platform.OS === 'ios' ? 'alert.wav' : 'alert';
      case 'default':
      default:
        return true; // 使用默认声音
    }
  }
  
  // 请求通知权限
  async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // 如果没有权限，请求权限
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // 在iOS上，需要额外请求通知权限
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('default', [
        {
          identifier: 'complete',
          buttonTitle: 'Complete',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'snooze',
          buttonTitle: 'Snooze',
          options: {
            isDestructive: false,
            isAuthenticationRequired: false,
          },
        },
      ]);
    }
    
    return finalStatus === 'granted';
  }
  
  // 检查通知权限
  async checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
  
  // 调度任务提醒通知
  async scheduleTaskNotification(task) {
    // 如果任务通知被禁用，不调度通知
    if (!this.config.taskNotifications) {
      return null;
    }
    
    if (!task.hasReminder || !task.reminderTime) {
      return null;
    }
    
    try {
      // 计算通知时间
      const taskTime = new Date(task.taskTime);
      const reminderMinutes = task.reminderTime || 15;
      const notificationTime = new Date(taskTime.getTime() - reminderMinutes * 60 * 1000);
      
      // 如果通知时间已过，则不调度
      if (notificationTime <= new Date()) {
        return null;
      }
      
      // 获取通知声音
      const sound = this.getNotificationSound();
      
      // 创建通知
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Task Reminder',
          body: `${task.text} will start in ${reminderMinutes} minutes`,
          data: { 
            taskId: task.id,
            screen: 'Task',
            notificationType: 'taskReminder'
          },
          sound,
          // 在iOS上添加通知操作按钮
          categoryIdentifier: Platform.OS === 'ios' ? 'default' : undefined,
        },
        trigger: notificationTime,
      });
      
      // 添加到历史记录
      await this.addNotificationToHistory({
        request: {
          content: {
            title: 'Task Reminder',
            body: `${task.text} will start in ${reminderMinutes} minutes`,
            data: { 
              taskId: task.id,
              screen: 'Task',
              notificationType: 'taskReminder'
            }
          }
        }
      }, false);
      
      // 保存通知ID与任务ID的映射关系
      await this.saveNotificationMapping(task.id, notificationId);
      
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule task notification:', error);
      return null;
    }
  }
  
  // 取消任务通知
  async cancelTaskNotification(taskId) {
    try {
      const notificationId = await this.getNotificationIdForTask(taskId);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await this.removeNotificationMapping(taskId);
      }
    } catch (error) {
      console.error('Failed to cancel task notification:', error);
    }
  }
  
  // 调度日志提醒通知
  async scheduleJournalReminder(hours, minutes, enabled) {
    try {
      // 取消所有现有的日志提醒通知
      const existingNotifications = await AsyncStorage.getItem('journalReminderNotificationId');
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // 确保 notificationId 是字符串而不是数组
          if (typeof notificationId === 'string') {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
          } else if (Array.isArray(notificationId)) {
            // 如果是数组，尝试取第一个元素
            await Notifications.cancelScheduledNotificationAsync(notificationId[0]);
          } else {
            console.log('Invalid journal notification ID format:', notificationId);
          }
        } catch (cancelError) {
          console.error('Error canceling journal notification:', cancelError);
          // 继续执行，不要因为取消失败而阻止创建新通知
        }
      }
      
      if (!enabled) return;
      
      // 获取通知声音
      const sound = this.getNotificationSound();
      
      // 检查当前时间是否已经过了今天的设定时间
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isPastTriggerTimeToday = (currentHour > hours) || (currentHour === hours && currentMinute >= minutes);
      
      // 计算下一次触发时间
      let triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0); // 设置小时、分钟、秒、毫秒
      
      // 如果当前时间已经过了今天的触发时间，设置为明天
      if (isPastTriggerTimeToday) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }
      
      console.log('Journal reminder scheduled for:', triggerDate.toString());
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Journal Reminder',
          body: 'Time to record your thoughts and feelings for today.',
          data: {
            screen: 'Journal',
            notificationType: 'journalReminder'
          },
          sound,
        },
        trigger: triggerDate,
      });
      
      await AsyncStorage.setItem('journalReminderNotificationId', JSON.stringify(notificationId));
      
      // 不再添加到历史记录，避免触发即时通知
      // await this.addNotificationToHistory({
      //   request: {
      //     content: {
      //       title: 'Journal Reminder',
      //       body: 'Time to record your thoughts and feelings for today.',
      //       data: { 
      //         screen: 'Journal',
      //         notificationType: 'journalReminder'
      //       }
      //     }
      //   }
      // });
      
      console.log('Journal reminder scheduled for', hours, ':', minutes);
    } catch (error) {
      console.error('Failed to schedule journal reminder:', error);
    }
  }
  
  // 调度冥想提醒通知
  async scheduleMeditationReminder(hours, minutes, enabled) {
    try {
      // 取消所有现有的冥想提醒通知
      const existingNotifications = await AsyncStorage.getItem('meditationReminderNotificationId');
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // 确保 notificationId 是字符串而不是数组
          if (typeof notificationId === 'string') {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
          } else if (Array.isArray(notificationId)) {
            // 如果是数组，尝试取第一个元素
            await Notifications.cancelScheduledNotificationAsync(notificationId[0]);
          } else {
            console.log('Invalid meditation notification ID format:', notificationId);
          }
        } catch (cancelError) {
          console.error('Error canceling meditation notification:', cancelError);
          // 继续执行，不要因为取消失败而阻止创建新通知
        }
      }
      
      if (!enabled) return;
      
      // 获取通知声音
      const sound = this.getNotificationSound();
      
      // 检查当前时间是否已经过了今天的设定时间
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isPastTriggerTimeToday = (currentHour > hours) || (currentHour === hours && currentMinute >= minutes);
      
      // 计算下一次触发时间
      let triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0); // 设置小时、分钟、秒、毫秒
      
      // 如果当前时间已经过了今天的触发时间，设置为明天
      if (isPastTriggerTimeToday) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }
      
      console.log('Meditation reminder scheduled for:', triggerDate.toString());
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Meditation Reminder',
          body: 'Time for your daily meditation practice.',
          data: {
            screen: 'Meditation',
            notificationType: 'meditationReminder'
          },
          sound,
        },
        trigger: triggerDate,
      });
      
      await AsyncStorage.setItem('meditationReminderNotificationId', JSON.stringify(notificationId));
      
      // 不再添加到历史记录，避免触发即时通知
      // await this.addNotificationToHistory({
      //   request: {
      //     content: {
      //       title: 'Meditation Reminder',
      //       body: 'Time for your daily meditation practice.',
      //       data: { 
      //         screen: 'Meditation',
      //         notificationType: 'meditationReminder'
      //       }
      //     }
      //   }
      // });
      
      console.log('Meditation reminder scheduled for', hours, ':', minutes);
    } catch (error) {
      console.error('Failed to schedule meditation reminder:', error);
    }
  }
  
  // 发送即时通知（用于专注模式结束等场景）
  async sendImmediateNotification(title, body, data = {}) {
    // 获取通知声音
    const sound = this.getNotificationSound();
    
    const notification = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          ...data,
          notificationType: 'immediate'
        },
        sound,
      },
      trigger: null, // 立即发送
    });
    
    // 添加到历史记录，但不发送额外的即时通知
    await this.addNotificationToHistory({
      request: {
        content: {
          title,
          body,
          data: {
            ...data,
            notificationType: 'immediate'
          }
        }
      }
    }, false);
    
    return notification;
  }
  
  // 保存通知ID与任务ID的映射关系
  async saveNotificationMapping(taskId, notificationId) {
    try {
      const mappingsJson = await AsyncStorage.getItem('notificationMappings');
      const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};
      mappings[taskId] = notificationId;
      await AsyncStorage.setItem('notificationMappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Failed to save notification mapping:', error);
    }
  }
  
  // 获取任务对应的通知ID
  async getNotificationIdForTask(taskId) {
    try {
      const mappingsJson = await AsyncStorage.getItem('notificationMappings');
      const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};
      return mappings[taskId];
    } catch (error) {
      console.error('Failed to get notification ID:', error);
      return null;
    }
  }
  
  // 移除通知映射
  async removeNotificationMapping(taskId) {
    try {
      const mappingsJson = await AsyncStorage.getItem('notificationMappings');
      const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};
      delete mappings[taskId];
      await AsyncStorage.setItem('notificationMappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Failed to remove notification mapping:', error);
    }
  }
  
  // 初始化通知系统
  async initialize() {
    // 加载配置
    await this.loadConfig();
    
    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      const granted = await this.requestPermissions();
      if (!granted) {
        console.log('User denied notification permissions');
        return false;
      }
    }
    
    // 设置通知响应处理程序
    this.notificationResponseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse
    );
    
    return true;
  }
  
  // 清理通知监听器
  cleanup() {
    if (this.notificationResponseListener) {
      Notifications.removeNotificationSubscription(this.notificationResponseListener);
    }
  }
  
  // 处理通知响应
  handleNotificationResponse = async (response) => {
    const data = response.notification.request.content.data;
    
    // 添加到历史记录，但不发送额外的即时通知
    const historyItem = await this.addNotificationToHistory(response.notification, false);
    
    // 标记为已读
    if (historyItem) {
      await this.markNotificationAsRead(historyItem.id);
    }
    
    // 如果没有导航引用，无法导航
    if (!navigationRef) {
      console.log('Notification clicked processing: Navigation reference not set');
      return;
    }
    
    console.log('User clicked notification:', data);
    
    // 处理通知操作按钮
    if (response.actionIdentifier === 'complete' && data.taskId) {
      // 处理"完成"按钮点击
      console.log('User clicked complete button, task ID:', data.taskId);
      await this.completeTaskFromNotification(data.taskId);
    } else if (response.actionIdentifier === 'snooze' && data.taskId) {
      // 处理"稍后提醒"按钮点击
      console.log('User clicked snooze button, task ID:', data.taskId);
      await this.snoozeTaskFromNotification(data.taskId);
    } else if (data.screen) {
      // 导航到指定屏幕
      navigationRef.navigate(data.screen);
      
      // 如果是任务通知，可以进一步处理
      if (data.taskId) {
        console.log('Navigated to task screen, task ID:', data.taskId);
        // 这里可以添加更多处理逻辑，如高亮显示特定任务
      }
    }
  }
  
  // 从通知中完成任务
  async completeTaskFromNotification(taskId) {
    try {
      // 获取所有任务
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (!tasksJson) return;
      
      const tasks = JSON.parse(tasksJson);
      
      // 查找并更新任务
      const updatedTasks = tasks.map(task => 
        task.id === taskId ? { ...task, completed: true } : task
      );
      
      // 保存更新后的任务
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      
      // 取消任务通知
      await this.cancelTaskNotification(taskId);
      
      // 发送确认通知
      await this.sendImmediateNotification(
        'Task Completed',
        'Task has been marked as completed',
        { screen: 'Task' }
      );
      
      console.log('Task completed from notification:', taskId);
    } catch (error) {
      console.error('Failed to complete task from notification:', error);
    }
  }
  
  // 从通知中稍后提醒任务
  async snoozeTaskFromNotification(taskId) {
    try {
      // 获取所有任务
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (!tasksJson) return;
      
      const tasks = JSON.parse(tasksJson);
      
      // 查找任务
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // 取消原有通知
      await this.cancelTaskNotification(taskId);
      
      // 计算新的提醒时间（15分钟后）
      const snoozeMinutes = 15;
      const now = new Date();
      const newNotificationTime = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
      
      // 创建新通知
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Snoozed Task Reminder',
          body: `${task.text} has been snoozed for ${snoozeMinutes} minutes`,
          data: { 
            taskId: task.id,
            screen: 'Task',
            notificationType: 'taskReminder',
            snoozed: true
          },
          sound: this.getNotificationSound(),
          categoryIdentifier: Platform.OS === 'ios' ? 'default' : undefined,
        },
        trigger: newNotificationTime,
      });
      
      // 保存通知ID与任务ID的映射关系
      await this.saveNotificationMapping(task.id, notificationId);
      
      console.log('Task snoozed from notification:', taskId);
    } catch (error) {
      console.error('Failed to snooze task from notification:', error);
    }
  }
  
  // 添加通知到历史记录
  async addNotificationToHistory(notification, sendImmediateNotification = false) {
    try {
      // 检查是否是设置更新触发的通知，如果是则不添加到历史记录
      if (notification.request.content.data && 
          (notification.request.content.data.notificationType === 'journalReminder' || 
           notification.request.content.data.notificationType === 'meditationReminder') &&
          !sendImmediateNotification) {
        console.log('Skipping history for settings-related notification:', notification.request.content.title);
        return null;
      }
      
      // 获取现有历史记录
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      const history = historyJson ? JSON.parse(historyJson) : [];
      
      // 创建历史记录项
      const historyItem = {
        id: Date.now().toString(),
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      // 添加到历史记录
      const updatedHistory = [historyItem, ...history].slice(0, 50); // 只保留最近50条
      
      // 保存历史记录
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
      
      // 如果需要，发送即时通知
      if (sendImmediateNotification) {
        // 这里可以添加发送即时通知的逻辑，但我们现在不需要
        console.log('Immediate notification option is enabled but not sending one');
      }
      
      return historyItem;
    } catch (error) {
      console.error('Failed to add notification to history:', error);
      return null;
    }
  }
  
  // 获取通知历史记录
  async getNotificationHistory() {
    try {
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }
  
  // 标记通知为已读
  async markNotificationAsRead(notificationId) {
    try {
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      if (!historyJson) return;
      
      const history = JSON.parse(historyJson);
      
      // 更新通知状态
      const updatedHistory = history.map(item => 
        item.id === notificationId ? { ...item, read: true } : item
      );
      
      // 保存更新后的历史记录
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }
  
  // 清除通知历史记录
  async clearNotificationHistory() {
    try {
      await AsyncStorage.removeItem('notificationHistory');
    } catch (error) {
      console.error('Failed to clear notification history:', error);
    }
  }
}

export default new NotificationService(); 