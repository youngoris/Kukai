/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import * as Notifications from "expo-notifications";
import storageService from "./StorageService.js";
import { Platform } from "react-native";

// Add isWeb check
const isWeb = Platform.OS === 'web';

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
  notificationSound: "default",
  quietHoursEnabled: false,
  quietHoursStart: new Date().setHours(22, 0, 0, 0),
  quietHoursEnd: new Date().setHours(7, 0, 0, 0),
};

class NotificationService {
  constructor() {
    this.config = {
      ...DEFAULT_CONFIG,
    };
    this.responseListener = null;

    // Create notification channels (required for Android)
    if (Platform.OS === "android") {
      this.createNotificationChannels();
    }
  }

  // Set navigation reference
  setNavigationRef(ref) {
    navigationRef = ref;
  }

  // Update configuration
  async updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Save configuration to storage
    await storageService.setItem(
      "notificationConfig",
      JSON.stringify(this.config),
    );

    console.log("Notification configuration updated:", this.config);
    return this.config;
  }

  // Load configuration
  async loadConfig() {
    try {
      const configJson = await storageService.getItem("notificationConfig");
      if (configJson) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...JSON.parse(configJson),
        };
      }
      console.log("Notification configuration loaded:", this.config);
    } catch (error) {
      console.error("Failed to load notification configuration:", error);
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
      case "none":
        return null;
      case "gentle":
        return Platform.OS === "ios" ? "gentle.wav" : "gentle";
      case "alert":
        return Platform.OS === "ios" ? "alert.wav" : "alert";
      case "default":
      default:
        return true; // Use default sound
    }
  }

  // Request notification permissions
  async requestPermissions() {
    if (isWeb) {
      console.log("Notification permissions skipped on web platform");
      return true;
    }
    
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      // If no permission, request permission
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      // On iOS, additional notification permission is needed
      if (Platform.OS === "ios") {
        await Notifications.setNotificationCategoryAsync("default", [
          {
            identifier: "complete",
            buttonTitle: "Complete",
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
          {
            identifier: "snooze",
            buttonTitle: "Snooze",
            options: {
              isDestructive: false,
              isAuthenticationRequired: false,
            },
          },
        ]);
      }
      
      return finalStatus === "granted";
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Check notification permissions
  async checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  }

  // Schedule task reminder notification
  async scheduleTaskNotification(task) {
    // If task notification is disabled, do not schedule notification
    if (!this.config.taskNotifications) {
      console.log("Task notifications are disabled in settings");
      return null;
    }

    // Verify task has a task time
    if (!task.taskTime) {
      console.log(
        `Task ${task.id} does not have a task time, skipping notification`,
      );
      return null;
    }

    try {
      // Get current time and add 1 minute buffer to ensure notifications don't trigger immediately
      const now = new Date();
      const bufferMs = 60 * 1000; // 1 minute buffer
      const nowPlusBuffer = new Date(now.getTime() + bufferMs);

      console.log(`Current time: ${now.toISOString()}`);
      console.log(`Current time + buffer: ${nowPlusBuffer.toISOString()}`);

      const taskTime = new Date(task.taskTime);
      console.log(`Task time: ${taskTime.toISOString()}`);

      // Validate task time
      if (isNaN(taskTime.getTime())) {
        console.error("Invalid task time:", task.taskTime);
        return null;
      }

      // If task time is in the past, don't create notifications
      if (taskTime <= now) {
        console.log(
          `Task ${task.id} time already passed (${taskTime.toLocaleString()}), no notifications will be created`,
        );
        return null;
      }

      let notificationIds = [];

      // Only create reminder notification if the task explicitly has a reminder set
      if (task.hasReminder === true && task.reminderTime) {
        console.log(
          `Task ${task.id} has reminder set to ${task.reminderTime} minutes before task time`,
        );

        const reminderMinutes = task.reminderTime || 15;
        const reminderTime = new Date(
          taskTime.getTime() - reminderMinutes * 60 * 1000,
        );

        console.log(`Calculated reminder time: ${reminderTime.toISOString()}`);

        // Only create reminder notification if the reminder time is later than current time + buffer
        if (reminderTime > nowPlusBuffer) {
          const sound = this.getNotificationSound();
          const minutesTillReminder = Math.round(
            (reminderTime - now) / (60 * 1000),
          );
          const secondsTillReminder = Math.round((reminderTime - now) / 1000);

          console.log(
            `Scheduling reminder notification, will trigger in ${minutesTillReminder} minutes (${secondsTillReminder} seconds)`,
          );

          try {
            // Use TIME_INTERVAL trigger type instead of date type
            console.log(
              `Using TIME_INTERVAL trigger type with ${secondsTillReminder} seconds delay`,
            );

            const reminderNotificationId =
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "Task Reminder",
                  body: `${task.text} will start in ${reminderMinutes} minutes`,
                  data: {
                    taskId: task.id,
                    screen: "Task",
                    notificationType: "taskReminderAdvance",
                    scheduledTime: reminderTime.toISOString(),
                  },
                  sound,
                  categoryIdentifier:
                    Platform.OS === "ios" ? "default" : undefined,
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes
                    .TIME_INTERVAL,
                  seconds: secondsTillReminder,
                  repeats: false,
                  channelId: "task-notifications",
                },
              });

            // Verify notification is successfully scheduled
            const scheduledNotifications =
              await Notifications.getAllScheduledNotificationsAsync();
            const foundNotification = scheduledNotifications.find(
              (n) => n.identifier === reminderNotificationId,
            );

            if (foundNotification) {
              console.log(
                "Reminder notification successfully scheduled and verified in the system",
              );
            } else {
              console.log(
                "Warning: Reminder notification was scheduled but not found in scheduled notifications list",
              );
            }

            // Save reminder notification ID to task ID mapping
            await this.saveNotificationMapping(
              `${task.id}_reminder`,
              reminderNotificationId,
            );
            notificationIds.push(reminderNotificationId);
            console.log(
              `Task reminder notification scheduled for ${reminderTime.toLocaleString()}, ID:`,
              reminderNotificationId,
            );
          } catch (error) {
            console.error("Error scheduling reminder notification:", error);
          }
        } else {
          console.log(
            `Task ${task.id} reminder time too close (${reminderTime.toLocaleString()}), skipping reminder notification`,
          );
        }
      } else {
        console.log(
          `Task ${task.id} does not have reminder enabled, skipping advance reminder notification`,
        );
      }

      // Only create task time notification if the task time is later than current time + buffer
      if (taskTime > nowPlusBuffer) {
        const sound = this.getNotificationSound();
        const minutesTillTask = Math.round((taskTime - now) / (60 * 1000));
        const secondsTillTask = Math.round((taskTime - now) / 1000);

        console.log(
          `Scheduling task time notification, will trigger in ${minutesTillTask} minutes (${secondsTillTask} seconds)`,
        );

        try {
          // Use TIME_INTERVAL trigger type instead of date type
          console.log(
            `Using TIME_INTERVAL trigger type with ${secondsTillTask} seconds delay`,
          );

          const taskNotificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Task Time",
                body: `It's time for: ${task.text}`,
                data: {
                  taskId: task.id,
                  screen: "Task",
                  notificationType: "taskReminderTime",
                  scheduledTime: taskTime.toISOString(),
                },
                sound,
                categoryIdentifier:
                  Platform.OS === "ios" ? "default" : undefined,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: secondsTillTask,
                repeats: false,
                channelId: "task-notifications",
              },
            });

          // Verify notification is successfully scheduled
          const scheduledNotifications =
            await Notifications.getAllScheduledNotificationsAsync();
          const foundNotification = scheduledNotifications.find(
            (n) => n.identifier === taskNotificationId,
          );

          if (foundNotification) {
            console.log(
              "Notification successfully scheduled and verified in the system",
            );
          } else {
            console.log(
              "Warning: Notification was scheduled but not found in scheduled notifications list",
            );
          }

          // Save task time notification ID to task ID mapping
          await this.saveNotificationMapping(
            `${task.id}_time`,
            taskNotificationId,
          );
          notificationIds.push(taskNotificationId);
          console.log(
            `Task time notification scheduled for ${taskTime.toLocaleString()}, ID:`,
            taskNotificationId,
          );
        } catch (error) {
          console.error("Error scheduling task notification:", error);
        }
      } else {
        console.log(
          `Task ${task.id} time too close (${taskTime.toLocaleString()}), skipping time notification`,
        );
      }

      return notificationIds.length > 0 ? notificationIds : null;
    } catch (error) {
      console.error("Failed to schedule task notification:", error);
      return null;
    }
  }

  // Cancel task notification
  async cancelTaskNotification(taskId) {
    try {
      // Cancel reminder notification
      const reminderNotificationId = await this.getNotificationIdForTask(
        `${taskId}_reminder`,
      );
      if (reminderNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          reminderNotificationId,
        );
        await this.removeNotificationMapping(`${taskId}_reminder`);
        console.log(`Cancelled reminder notification for task ${taskId}`);
      }

      // Cancel task time notification
      const taskNotificationId = await this.getNotificationIdForTask(
        `${taskId}_time`,
      );
      if (taskNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          taskNotificationId,
        );
        await this.removeNotificationMapping(`${taskId}_time`);
        console.log(`Cancelled time notification for task ${taskId}`);
      }

      // Compatible with old single notification ID case
      const legacyNotificationId = await this.getNotificationIdForTask(taskId);
      if (legacyNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          legacyNotificationId,
        );
        await this.removeNotificationMapping(taskId);
        console.log(`Cancelled legacy notification for task ${taskId}`);
      }
    } catch (error) {
      console.error("Failed to cancel task notification:", error);
    }
  }

  // Schedule journal reminder notification
  async scheduleJournalReminder(hours, minutes, enabled) {
    try {
      // Cancel all existing journal reminder notifications
      const existingNotifications = await storageService.getItem(
        "journalReminderNotificationId",
      );
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // Ensure notificationId is string, not array
          if (typeof notificationId === "string") {
            await Notifications.cancelScheduledNotificationAsync(
              notificationId,
            );
          } else if (Array.isArray(notificationId)) {
            // If array, try to take first element
            await Notifications.cancelScheduledNotificationAsync(
              notificationId[0],
            );
          } else {
            console.log(
              "Invalid journal notification ID format:",
              notificationId,
            );
          }
        } catch (cancelError) {
          console.error("Error canceling journal notification:", cancelError);
          // Continue execution, do not prevent creating new notification due to cancel failure
        }
      }

      if (!enabled) return;

      // Get notification sound
      const sound = this.getNotificationSound();

      // Use daily repeat notification instead of single notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Journal Reminder",
          body: "Time to record your thoughts and feelings for today.",
          data: {
            screen: "Journal",
            notificationType: "journalReminder",
          },
          sound,
        },
        trigger: {
          type: "daily",
          hour: hours,
          minute: minutes,
        },
      });

      await storageService.setItem(
        "journalReminderNotificationId",
        JSON.stringify(notificationId),
      );

      console.log(
        "Journal reminder scheduled for daily at",
        hours,
        ":",
        minutes,
      );
    } catch (error) {
      console.error("Failed to schedule journal reminder:", error);
    }
  }

  // Schedule meditation reminder notification
  async scheduleMeditationReminder(hours, minutes, enabled) {
    try {
      // Cancel all existing meditation reminder notifications
      const existingNotifications = await storageService.getItem(
        "meditationReminderNotificationId",
      );
      if (existingNotifications) {
        try {
          const notificationId = JSON.parse(existingNotifications);
          // Ensure notificationId is string, not array
          if (typeof notificationId === "string") {
            await Notifications.cancelScheduledNotificationAsync(
              notificationId,
            );
          } else if (Array.isArray(notificationId)) {
            // If array, try to take first element
            await Notifications.cancelScheduledNotificationAsync(
              notificationId[0],
            );
          } else {
            console.log(
              "Invalid meditation notification ID format:",
              notificationId,
            );
          }
        } catch (cancelError) {
          console.error(
            "Error canceling meditation notification:",
            cancelError,
          );
          // Continue execution, do not prevent creating new notification due to cancel failure
        }
      }

      if (!enabled) return;

      // Get notification sound
      const sound = this.getNotificationSound();

      // Use daily repeat notification instead of single notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Meditation Reminder",
          body: "Time for your daily meditation practice.",
          data: {
            screen: "Meditation",
            notificationType: "meditationReminder",
          },
          sound,
        },
        trigger: {
          type: "daily",
          hour: hours,
          minute: minutes,
        },
      });

      await storageService.setItem(
        "meditationReminderNotificationId",
        JSON.stringify(notificationId),
      );

      console.log(
        "Meditation reminder scheduled for daily at",
        hours,
        ":",
        minutes,
      );
    } catch (error) {
      console.error("Failed to schedule meditation reminder:", error);
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

    return notificationId;
  }

  // Save notification ID to task ID mapping
  async saveNotificationMapping(taskId, notificationId) {
    try {
      // Get existing mapping
      const mappingJson = await storageService.getItem("notificationMapping");
      const mapping = mappingJson ? JSON.parse(mappingJson) : {};

      // Update mapping
      mapping[taskId] = notificationId;

      // Save mapping
      await storageService.setItem("notificationMapping", JSON.stringify(mapping));
    } catch (error) {
      console.error("Failed to save notification mapping:", error);
    }
  }

  // Get notification ID for task
  async getNotificationIdForTask(taskId) {
    try {
      const mappingJson = await storageService.getItem("notificationMapping");
      const mapping = mappingJson ? JSON.parse(mappingJson) : {};
      return mapping[taskId];
    } catch (error) {
      console.error("Failed to get notification ID for task:", error);
      return null;
    }
  }

  // Remove notification mapping
  async removeNotificationMapping(taskId) {
    try {
      const mappingJson = await storageService.getItem("notificationMapping");
      const mapping = mappingJson ? JSON.parse(mappingJson) : {};

      if (mapping[taskId]) {
        delete mapping[taskId];
        await storageService.setItem("notificationMapping", JSON.stringify(mapping));
      }
    } catch (error) {
      console.error("Failed to remove notification mapping:", error);
    }
  }

  // Initialize notification system
  async initialize() {
    // Skip on web platform
    if (isWeb) {
      console.log("Notification system initialization skipped on web platform");
      return true;
    }
    
    // Load configuration
    try {
      const savedConfig = await storageService.getItem("notificationConfig");
      if (savedConfig) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
      }

      // Ensure notifications don't trigger immediately
      await this.configureNotifications();

      // Set notification response handler
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener(
          this.handleNotificationResponse,
        );

      return await this.requestPermissions();
    } catch (error) {
      console.error("Error initializing notification service:", error);
      return false;
    }
  }

  // Configure notification system to avoid immediate trigger
  async configureNotifications() {
    // Skip on web platform
    if (isWeb) {
      console.log("Notification configuration skipped on web platform");
      return;
    }
    
    try {
      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Cancel all possible immediate notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      console.log("Notification system configured");
    } catch (error) {
      console.error("Error configuring notifications:", error);
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

    // If no navigation reference, cannot navigate
    if (!navigationRef) {
      console.log(
        "Notification clicked processing: Navigation reference not set",
      );
      return;
    }

    console.log(
      "User clicked notification:",
      notification.request.content.data,
    );

    // Handle notification action button
    if (
      response.actionIdentifier === "complete" &&
      notification.request.content.data.taskId
    ) {
      // Handle "Complete" button click
      console.log(
        "User clicked complete button, task ID:",
        notification.request.content.data.taskId,
      );
      await this.completeTaskFromNotification(
        notification.request.content.data.taskId,
      );
    } else if (
      response.actionIdentifier === "snooze" &&
      notification.request.content.data.taskId
    ) {
      // Handle "Snooze" button click
      console.log(
        "User clicked snooze button, task ID:",
        notification.request.content.data.taskId,
      );
      await this.snoozeTaskFromNotification(
        notification.request.content.data.taskId,
      );
    } else if (notification.request.content.data.screen) {
      // Navigate to specified screen
      navigationRef.navigate(notification.request.content.data.screen);

      // If it's a task notification, further processing can be done
      if (notification.request.content.data.taskId) {
        console.log(
          "Navigated to task screen, task ID:",
          notification.request.content.data.taskId,
        );
        // Additional processing logic can be added here, such as highlighting specific task
      }
    }
  };

  // Complete task from notification
  async completeTaskFromNotification(taskId) {
    try {
      // Get all tasks
      const tasksJson = await storageService.getItem("tasks");
      if (!tasksJson) return;

      const tasks = JSON.parse(tasksJson);

      // Find and update task, add completion timestamp
      const updatedTasks = tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: true,
              completedAt: new Date().toISOString(), // Add completion timestamp
            }
          : task,
      );

      // Save updated tasks
      await storageService.setItem("tasks", JSON.stringify(updatedTasks));

      // Cancel task notification
      await this.cancelTaskNotification(taskId);

      // Send confirmation notification (modify to not use history)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Task Completed",
          body: "Task has been marked as completed",
          data: { screen: "Task" },
          sound: this.getNotificationSound(),
        },
        trigger: null, // Send immediately
      });

      console.log("Task completed from notification:", taskId);
    } catch (error) {
      console.error("Failed to complete task from notification:", error);
    }
  }

  // Snooze task from notification
  async snoozeTaskFromNotification(taskId) {
    try {
      // Get all tasks
      const tasksJson = await storageService.getItem("tasks");
      if (!tasksJson) return;

      const tasks = JSON.parse(tasksJson);

      // Find task
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Cancel existing notifications
      await this.cancelTaskNotification(taskId);

      // Calculate new reminder time (15 minutes later)
      const snoozeMinutes = 15;
      const now = new Date();
      // Add 30 seconds buffer to ensure notifications don't trigger immediately
      const bufferSeconds = 30;
      const newNotificationTime = new Date(
        now.getTime() + snoozeMinutes * 60 * 1000 + bufferSeconds * 1000,
      );
      const totalSeconds = snoozeMinutes * 60 + bufferSeconds;

      console.log(`Task snooze - Current time: ${now.toISOString()}`);
      console.log(
        `Task snooze - New notification time: ${newNotificationTime.toISOString()}`,
      );
      console.log(`Task snooze - Total seconds delay: ${totalSeconds}`);

      // Use TIME_INTERVAL trigger type instead of date type
      console.log(
        `Using TIME_INTERVAL trigger type with ${totalSeconds} seconds delay`,
      );

      // Create new notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Snoozed Task Reminder",
          body: `${task.text} has been snoozed for ${snoozeMinutes} minutes`,
          data: {
            taskId: task.id,
            screen: "Task",
            notificationType: "taskReminder",
            snoozed: true,
            scheduledTime: newNotificationTime.toISOString(),
          },
          sound: this.getNotificationSound(),
          categoryIdentifier: Platform.OS === "ios" ? "default" : undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: totalSeconds,
          repeats: false,
          channelId: "task-notifications",
        },
      });

      // Verify notification is successfully scheduled
      const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();
      const foundNotification = scheduledNotifications.find(
        (n) => n.identifier === notificationId,
      );

      if (foundNotification) {
        console.log(
          "Snooze notification successfully scheduled and verified in the system",
        );
      } else {
        console.log(
          "Warning: Snooze notification was scheduled but not found in scheduled notifications list",
        );
      }

      // Save notification ID to task ID mapping - use the snoozed prefix
      await this.saveNotificationMapping(`${task.id}_snoozed`, notificationId);

      console.log(
        "Task snoozed from notification:",
        taskId,
        "New notification time:",
        newNotificationTime.toLocaleString(),
        "ID:",
        notificationId,
      );
      return notificationId;
    } catch (error) {
      console.error("Failed to snooze task from notification:", error);
      return null;
    }
  }

  // Create notification channel
  async createNotificationChannels() {
    try {
      await Notifications.setNotificationChannelAsync("task-notifications", {
        name: "Task Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });

      console.log(
        "Successfully created notification channel: task-notifications",
      );
    } catch (error) {
      console.error("Failed to create notification channel:", error);
    }
  }
}

export default new NotificationService();
