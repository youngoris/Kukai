import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Global navigation reference, used for navigation after notification click
let navigationRef = null;

// Default configuration
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
  
  // Set navigation reference
  setNavigationRef(ref) {
    navigationRef = ref;
  }
  
  // Update configuration
  async updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Save configuration to storage
    await AsyncStorage.setItem('notificationConfig', JSON.stringify(this.config));
    
    console.log('Notification configuration updated:', this.config);
    return this.config;
  }
  
  // Load configuration
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
  
  // Check if in quiet hours
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
    
    // Handle cross-day situation
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }
  
  // Get notification sound
  getNotificationSound() {
    // If in quiet hours, return null (silent)
    if (this.isInQuietHours()) {
      return null;
    }
    
    // Return sound based on configuration
    switch (this.config.notificationSound) {
      case 'none':
        return null;
      case 'gentle':
        return Platform.OS === 'ios' ? 'gentle.wav' : 'gentle';
      case 'alert':
        return Platform.OS === 'ios' ? 'alert.wav' : 'alert';
      case 'default':
      default:
        return true; // Use default sound
    }
  }
  
  // Request notification permissions
  async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // If no permission, request permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // On iOS, additional notification permission is needed
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
  
  // Check notification permissions
  async checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
  
  // Schedule task reminder notification
  async scheduleTaskNotification(task) {
    // If task notification is disabled, do not schedule notification
    if (!this.config.taskNotifications) {
      return null;
    }
    
    if (!task.hasReminder || !task.reminderTime) {
      return null;
    }
    
    try {
      // Calculate notification time
      const taskTime = new Date(task.taskTime);
      const reminderMinutes = task.reminderTime || 15;
      const notificationTime = new Date(taskTime.getTime() - reminderMinutes * 60 * 1000);
      
      // If notification time has passed, do not schedule
      if (notificationTime <= new Date()) {
        return null;
      }
      
      // Get notification sound
      const sound = this.getNotificationSound();
      
      // Create notification
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
          // Add notification action button on iOS
          categoryIdentifier: Platform.OS === 'ios' ? 'default' : undefined,
        },
        trigger: notificationTime,
      });
      
      // Add to history
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
      
      // Save notification ID to task ID mapping
      await this.saveNotificationMapping(task.id, notificationId);
      
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule task notification:', error);
      return null;
    }
  }
  
  // Cancel task notification
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
  
  // Schedule journal reminder notification
  async scheduleJournalReminder(hours, minutes, enabled) {
    try {
      // Cancel all existing journal reminder notifications
      const existingNotifications = await AsyncStorage.getItem('journalReminderNotificationId');
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // Ensure notificationId is string, not array
          if (typeof notificationId === 'string') {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
          } else if (Array.isArray(notificationId)) {
            // If array, try to take first element
            await Notifications.cancelScheduledNotificationAsync(notificationId[0]);
          } else {
            console.log('Invalid journal notification ID format:', notificationId);
          }
        } catch (cancelError) {
          console.error('Error canceling journal notification:', cancelError);
          // Continue execution, do not prevent creating new notification due to cancel failure
        }
      }
      
      if (!enabled) return;
      
      // Get notification sound
      const sound = this.getNotificationSound();
      
      // Check if current time has passed today's set time
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isPastTriggerTimeToday = (currentHour > hours) || (currentHour === hours && currentMinute >= minutes);
      
      // Calculate next trigger time
      let triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0); // Set hours, minutes, seconds, milliseconds
      
      // If current time has passed today's trigger time, set for tomorrow
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
      
      // Do not add to history, avoid triggering immediate notification
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
  
  // Schedule meditation reminder notification
  async scheduleMeditationReminder(hours, minutes, enabled) {
    try {
      // Cancel all existing meditation reminder notifications
      const existingNotifications = await AsyncStorage.getItem('meditationReminderNotificationId');
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // Ensure notificationId is string, not array
          if (typeof notificationId === 'string') {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
          } else if (Array.isArray(notificationId)) {
            // If array, try to take first element
            await Notifications.cancelScheduledNotificationAsync(notificationId[0]);
          } else {
            console.log('Invalid meditation notification ID format:', notificationId);
          }
        } catch (cancelError) {
          console.error('Error canceling meditation notification:', cancelError);
          // Continue execution, do not prevent creating new notification due to cancel failure
        }
      }
      
      if (!enabled) return;
      
      // Get notification sound
      const sound = this.getNotificationSound();
      
      // Check if current time has passed today's set time
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isPastTriggerTimeToday = (currentHour > hours) || (currentHour === hours && currentMinute >= minutes);
      
      // Calculate next trigger time
      let triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0); // Set hours, minutes, seconds, milliseconds
      
      // If current time has passed today's trigger time, set for tomorrow
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
      
      // Do not add to history, avoid triggering immediate notification
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
  
  // Send immediate notification (used for focus mode end scenarios)
  async sendImmediateNotification(title, body, data = {}) {
    // Get notification sound
    const sound = this.getNotificationSound();
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound,
      },
      trigger: null, // Send immediately
    });
    
    // Add to history, but do not send additional immediate notification
    await this.addNotificationToHistory({
      request: {
        identifier: notificationId,
        content: {
          title,
          body,
          data
        },
        trigger: null
      }
    }, true);
    
    return notificationId;
  }
  
  // Save notification ID to task ID mapping
  async saveNotificationMapping(taskId, notificationId) {
    try {
      const mappingData = await AsyncStorage.getItem('notificationTaskMapping') || '{}';
      const mapping = JSON.parse(mappingData);
      mapping[taskId] = notificationId;
      await AsyncStorage.setItem('notificationTaskMapping', JSON.stringify(mapping));
    } catch (error) {
      console.error('Error saving notification mapping:', error);
    }
  }
  
  // Get notification ID for task
  async getNotificationIdForTask(taskId) {
    try {
      const mappingData = await AsyncStorage.getItem('notificationTaskMapping') || '{}';
      const mapping = JSON.parse(mappingData);
      return mapping[taskId];
    } catch (error) {
      console.error('Error getting notification ID for task:', error);
      return null;
    }
  }
  
  // Remove notification mapping
  async removeNotificationMapping(taskId) {
    try {
      const mappingData = await AsyncStorage.getItem('notificationTaskMapping') || '{}';
      const mapping = JSON.parse(mappingData);
      delete mapping[taskId];
      await AsyncStorage.setItem('notificationTaskMapping', JSON.stringify(mapping));
    } catch (error) {
      console.error('Error removing notification mapping:', error);
    }
  }
  
  // Initialize notification system
  async initialize() {
    // Load configuration
    try {
      const savedConfig = await AsyncStorage.getItem('notificationConfig');
      if (savedConfig) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
      }
      
      // Set notification response handler
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationResponse
      );
      
      return await this.requestPermissions();
    } catch (error) {
      console.error('Error initializing notification service:', error);
      return false;
    }
  }
  
  // Clean up notification listener
  cleanup() {
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
  
  // Handle notification response
  handleNotificationResponse = async (response) => {
    const { notification } = response;
    
    // Add to history, but do not send additional immediate notification
    await this.addNotificationToHistory(notification, false);
    
    // Mark as read
    await this.markNotificationAsRead(notification.request.identifier);
    
    // If no navigation reference, cannot navigate
    if (!navigationRef) {
      console.log('Notification clicked processing: Navigation reference not set');
      return;
    }
    
    console.log('User clicked notification:', notification.request.content.data);
    
    // Handle notification action button
    if (response.actionIdentifier === 'complete' && notification.request.content.data.taskId) {
      // Handle "Complete" button click
      console.log('User clicked complete button, task ID:', notification.request.content.data.taskId);
      await this.completeTaskFromNotification(notification.request.content.data.taskId);
    } else if (response.actionIdentifier === 'snooze' && notification.request.content.data.taskId) {
      // Handle "Snooze" button click
      console.log('User clicked snooze button, task ID:', notification.request.content.data.taskId);
      await this.snoozeTaskFromNotification(notification.request.content.data.taskId);
    } else if (notification.request.content.data.screen) {
      // Navigate to specified screen
      navigationRef.navigate(notification.request.content.data.screen);
      
      // If it's a task notification, further processing can be done
      if (notification.request.content.data.taskId) {
        console.log('Navigated to task screen, task ID:', notification.request.content.data.taskId);
        // Additional processing logic can be added here, such as highlighting specific task
      }
    }
  }
  
  // Complete task from notification
  async completeTaskFromNotification(taskId) {
    try {
      // Get all tasks
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (!tasksJson) return;
      
      const tasks = JSON.parse(tasksJson);
      
      // Find and update task, add completion timestamp
      const updatedTasks = tasks.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              completed: true,
              completedAt: new Date().toISOString() // Add completion timestamp
            } 
          : task
      );
      
      // Save updated tasks
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      
      // Cancel task notification
      await this.cancelTaskNotification(taskId);
      
      // Send confirmation notification
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
  
  // Snooze task from notification
  async snoozeTaskFromNotification(taskId) {
    try {
      // Get all tasks
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (!tasksJson) return;
      
      const tasks = JSON.parse(tasksJson);
      
      // Find task
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Cancel existing notification
      await this.cancelTaskNotification(taskId);
      
      // Calculate new reminder time (15 minutes later)
      const snoozeMinutes = 15;
      const now = new Date();
      const newNotificationTime = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
      
      // Create new notification
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
      
      // Save notification ID to task ID mapping
      await this.saveNotificationMapping(task.id, notificationId);
      
      console.log('Task snoozed from notification:', taskId);
    } catch (error) {
      console.error('Failed to snooze task from notification:', error);
    }
  }
  
  // Add notification to history
  async addNotificationToHistory(notification, sendImmediateNotification = false) {
    try {
      // Check if it's a settings-related notification triggered update, if so, do not add to history
      if (notification.request.content.data && 
          (notification.request.content.data.notificationType === 'journalReminder' || 
           notification.request.content.data.notificationType === 'meditationReminder') &&
          !sendImmediateNotification) {
        console.log('Skipping history for settings-related notification:', notification.request.content.title);
        return null;
      }
      
      // Get existing history
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      const history = historyJson ? JSON.parse(historyJson) : [];
      
      // Create history item
      const historyItem = {
        id: Date.now().toString(),
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data,
        timestamp: new Date().toISOString(),
        read: false
      };
      
      // Add to history
      const updatedHistory = [historyItem, ...history].slice(0, 50); // Only keep recent 50 items
      
      // Save history
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
      
      // If needed, send immediate notification
      if (sendImmediateNotification) {
        // Additional logic can be added here for sending immediate notification
        console.log('Immediate notification option is enabled but not sending one');
      }
      
      return historyItem;
    } catch (error) {
      console.error('Failed to add notification to history:', error);
      return null;
    }
  }
  
  // Get notification history
  async getNotificationHistory() {
    try {
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }
  
  // Mark notification as read
  async markNotificationAsRead(notificationId) {
    try {
      const historyJson = await AsyncStorage.getItem('notificationHistory');
      if (!historyJson) return;
      
      const history = JSON.parse(historyJson);
      
      // Update notification status
      const updatedHistory = history.map(item => 
        item.id === notificationId ? { ...item, read: true } : item
      );
      
      // Save updated history
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }
  
  // Clear notification history
  async clearNotificationHistory() {
    try {
      await AsyncStorage.removeItem('notificationHistory');
    } catch (error) {
      console.error('Failed to clear notification history:', error);
    }
  }
}

export default new NotificationService(); 