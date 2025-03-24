// Default application settings
// This file contains the default settings for the app when no user settings are found

/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import storageService from '../services/storage/StorageService';

const defaultSettings = {
  // Meditation settings
  meditationDuration: 10,
  selectedSoundTheme: "rain",
  meditationReminder: false,
  meditationReminderTime: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
  keepScreenAwake: true,

  // Focus settings
  focusDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  focusNotifications: true,
  autoStartNextFocus: false,
  differentWeekendSettings: false,

  // Journal settings
  includeWeather: true,
  includeLocation: true,
  markdownSupport: true,
  journalReminder: false,
  journalReminderTime: new Date(new Date().setHours(21, 0, 0, 0)).toISOString(),
  selectedJournalTemplate: "default",

  // General settings
  darkMode: true,
  appTheme: "dark",
  fontSizeScale: "medium",
  notificationsEnabled: true,
  syncEnabled: false,

  // Notification settings
  taskNotifications: true,
  notificationSound: "default",
  quietHoursEnabled: false,
  quietHoursStart: "22",
  quietHoursEnd: "7",
};

// Helper function to get settings with defaults
export const getSettingsWithDefaults = async () => {
  try {
    const storedSettings = await storageService.getItem("userSettings");
    
    if (storedSettings) {
      // If settings exist, parse and return them
      return JSON.parse(storedSettings);
    } else {
      // If no settings exist, save and return defaults
      console.log("No settings found, using defaults");
      await storageService.setItem("userSettings", JSON.stringify(defaultSettings));
      return defaultSettings;
    }
  } catch (error) {
    console.error("Error getting settings:", error);
    // In case of error, return defaults without saving
    return defaultSettings;
  }
};

export default defaultSettings; 