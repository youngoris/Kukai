/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Share,
  TouchableWithoutFeedback,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialIcons } from "@expo/vector-icons";
import storageService from "../services/storage/StorageService";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomDateTimePicker from "../components/CustomDateTimePicker";
import CloudBackupSection from "../components/CloudBackupSection";
import JournalTemplateManager from "../components/JournalTemplateManager";
import notificationService from "../services/NotificationService";
import { AVAILABLE_TEMPLATES } from "../constants/JournalTemplates";
import CustomHeader from "../components/CustomHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import VoiceGuidanceModal from "../components/VoiceGuidanceModal";
import { resetDatabase, verifyDatabase, forceRecreateSchema } from '../utils/DatabaseResetUtil';

const SettingsScreen = ({ navigation }) => {
  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Meditation Settings
  const [meditationDuration, setMeditationDuration] = useState(10);
  const [selectedSoundTheme, setSelectedSoundTheme] = useState("rain");
  const [keepScreenAwake, setKeepScreenAwake] = useState(true);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(false);
  const [defaultGuidanceType, setDefaultGuidanceType] = useState("dailyFocus");
  const [voiceGuidanceVolume, setVoiceGuidanceVolume] = useState(0.7);
  const [selectedVoice, setSelectedVoice] = useState("en-US-JennyMultilingualNeural");
  const [voiceSpeed, setVoiceSpeed] = useState(0.85); // Default voice speed from SpeechService

  // Focus Settings
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [focusNotifications, setFocusNotifications] = useState(true);
  const [autoStartNextFocus, setAutoStartNextFocus] = useState(false);
  const [differentWeekendSettings, setDifferentWeekendSettings] =
    useState(false);

  // Journal Settings
  const [includeWeather, setIncludeWeather] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [markdownSupport, setMarkdownSupport] = useState(true);
  const [journalReminder, setJournalReminder] = useState(false);
  const [journalReminderTime, setJournalReminderTime] = useState(
    new Date(new Date().setHours(21, 0, 0, 0)),
  );
  const [selectedJournalTemplate, setSelectedJournalTemplate] =
    useState("default");

  // Meditation Settings
  const [meditationReminder, setMeditationReminder] = useState(false);
  const [meditationReminderTime, setMeditationReminderTime] = useState(
    new Date(new Date().setHours(8, 30, 0, 0)),
  );

  // General Settings
  const [darkMode, setDarkMode] = useState(true);
  const [appTheme, setAppTheme] = useState("dark");
  const [fontSizeScale, setFontSizeScale] = useState("medium");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // UI States
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [currentTimePickerMode, setCurrentTimePickerMode] =
    useState("journalReminder"); // 'journalReminder' or 'meditationReminder'
  const [tempSelectedTime, setTempSelectedTime] = useState(null); // Temporary storage for user selected time
  const [isExportModalVisible, setExportModalVisible] = useState(false);
  const [exportPassword, setExportPassword] = useState("");

  // Modal States for dropdowns
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [currentValue, setCurrentValue] = useState(null);
  const [currentSetter, setCurrentSetter] = useState(null);
  const [currentModalTitle, setCurrentModalTitle] = useState("");

  // Add a state to track if settings have changed
  const [settingsChanged, setSettingsChanged] = useState(false);

  // Add a debounce timer reference
  const saveTimeoutRef = useRef(null);

  // Add a loading state at the top of the component with the other states:
  const [loading, setLoading] = useState(false);

  // Sound theme options
  const soundThemes = [
    { value: "silence", label: "Silence" },
    { value: "whitenoise", label: "Bright" },
    { value: "brownnoise", label: "Dark" },
    { value: "rain", label: "Rain" },
    { value: "forest", label: "Forest" },
    { value: "ocean", label: "Ocean" },
    { value: "fire", label: "Fire" },
    { value: "plane", label: "Plane" },
  ];

  // Journal template options
  const journalTemplates = AVAILABLE_TEMPLATES;

  // App theme options
  const appThemes = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "auto", label: "Auto" },
  ];

  // Font size options
  const fontSizes = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];

  // Meditation duration options
  const meditationDurations = [
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
    { value: 20, label: "20 min" },
    { value: 30, label: "30 min" },
  ];

  // Focus duration options
  const focusDurations = [
    { value: 1, label: "1 min" },
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
    { value: 25, label: "25 min" },
    { value: 30, label: "30 min" },
    { value: 45, label: "45 min" },
    { value: 60, label: "60 min" },
  ];

  // Break duration options
  const breakDurations = [
    { value: 3, label: "3 min" },
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
  ];

  // Long break duration options
  const longBreakDurations = [
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" },
    { value: 20, label: "20 min" },
    { value: 30, label: "30 min" },
  ];

  // Long break interval options
  const longBreakIntervals = [
    { value: 2, label: "2 cycles" },
    { value: 3, label: "3 cycles" },
    { value: 4, label: "4 cycles" },
    { value: 5, label: "5 cycles" },
  ];

  // 添加语音引导类型选项
  const guidanceTypes = [
    { value: "dailyFocus", label: "Daily Focus" },
    { value: "quickFocus", label: "Quick Focus" },
    { value: "stressRelief", label: "Stress Relief" },
    { value: "bedtime", label: "Bedtime" },
  ];

  // Voice options for TTS guidance
  const voiceOptions = [
    { value: "en-US-JennyMultilingualNeural", label: "Jenny (Default)" },
    { value: "en-US-GuyNeural", label: "Guy" },
    { value: "en-US-AriaNeural", label: "Aria" },
    { value: "en-US-ChristopherNeural", label: "Christopher" },
  ];

  // New state for CloudBackupSection visibility
  const [showCloudBackup, setShowCloudBackup] = useState(false);

  // Add state for Voice Guidance modal visibility
  const [showVoiceGuidanceModal, setShowVoiceGuidanceModal] = useState(false);

  // Add new notification settings state
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [notificationSound, setNotificationSound] = useState("default");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(
    new Date().setHours(22, 0, 0, 0),
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    new Date().setHours(7, 0, 0, 0),
  );
  const [showQuietHoursStartPicker, setShowQuietHoursStartPicker] =
    useState(false);
  const [showQuietHoursEndPicker, setShowQuietHoursEndPicker] = useState(false);

  // Add state for template manager visibility
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // Add new guidance type options
  useEffect(() => {
    loadSettings();
    checkNotificationPermissions();
  }, []);

  // Add useEffect for auto-save functionality
  useEffect(() => {
    // Only auto-save when settings have changed
    if (settingsChanged) {
      // Clear previous timer
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timer, delay save by 1 second
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveSettings();
        setSettingsChanged(false);
      }, 1000);
    }

    // Clear timer on component unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    meditationDuration,
    selectedSoundTheme,
    focusDuration,
    breakDuration,
    longBreakDuration,
    longBreakInterval,
    focusNotifications,
    autoStartNextFocus,
    differentWeekendSettings,
    includeWeather,
    includeLocation,
    markdownSupport,
    journalReminder,
    journalReminderTime,
    selectedJournalTemplate,
    darkMode,
    appTheme,
    fontSizeScale,
    notificationsEnabled,
    syncEnabled,
    taskNotifications,
    notificationSound,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    meditationReminder,
    meditationReminderTime,
    keepScreenAwake,
    voiceGuidanceEnabled,
    defaultGuidanceType,
    voiceGuidanceVolume,
    selectedVoice,
    voiceSpeed,
  ]);

  // Add useEffect to sync darkMode with appTheme
  useEffect(() => {
    // Update darkMode based on appTheme
    if (appTheme === 'dark') {
      setDarkMode(true);
    } else if (appTheme === 'light') {
      setDarkMode(false);
    }
    // For 'auto' theme, we could check system preference, but for simplicity
    // we'll just default to dark mode in this example
    else if (appTheme === 'auto') {
      // Here you could add system theme detection logic
      // For now, we'll just use dark mode as default
      setDarkMode(true);
    }
  }, [appTheme]);

  // Auto-save settings function
  const autoSaveSettings = async () => {
    try {
      console.log("Auto saving settings...");
      // Create settings object
      const settings = {
        // Meditation settings
        meditationDuration,
        selectedSoundTheme,
        meditationReminder,
        meditationReminderTime: meditationReminderTime.toISOString(),
        keepScreenAwake,
        voiceGuidanceEnabled,
        defaultGuidanceType,
        voiceGuidanceVolume,
        selectedVoice,
        voiceSpeed,

        // Focus settings
        focusDuration,
        breakDuration,
        longBreakDuration,
        longBreakInterval,
        focusNotifications,
        autoStartNextFocus,
        differentWeekendSettings,

        // Journal settings
        includeWeather,
        includeLocation,
        markdownSupport,
        journalReminder,
        journalReminderTime: journalReminderTime.toISOString(),
        selectedJournalTemplate,

        // Meditation reminder settings
        meditationReminder,
        meditationReminderTime: meditationReminderTime.toISOString(),

        // General settings
        darkMode,
        appTheme,
        fontSizeScale,
        notificationsEnabled,
        syncEnabled,

        // Notification settings
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: quietHoursStart.toString(),
        quietHoursEnd: quietHoursEnd.toString(),
      };

      console.log("Auto-saving settings:", settings);
      await storageService.setItem("userSettings", JSON.stringify(settings));

      // Set journal reminder notification if enabled
      if (journalReminder && notificationsEnabled) {
        await scheduleJournalReminder();
      } else {
        await notificationService.scheduleJournalReminder(0, 0, false);
      }

      // Set meditation reminder notification (if enabled)
      if (meditationReminder && notificationsEnabled) {
        await scheduleMeditationReminder();
      } else {
        await notificationService.scheduleMeditationReminder(0, 0, false);
      }

      // Save notification settings
      await storageService.setItem(
        "taskNotifications",
        JSON.stringify(taskNotifications),
      );
      await storageService.setItem("notificationSound", notificationSound);
      await storageService.setItem(
        "quietHoursEnabled",
        JSON.stringify(quietHoursEnabled),
      );
      await storageService.setItem("quietHoursStart", quietHoursStart.toString());
      await storageService.setItem("quietHoursEnd", quietHoursEnd.toString());

      // Update notification service configuration
      await notificationService.updateConfig({
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: new Date(quietHoursStart),
        quietHoursEnd: new Date(quietHoursEnd),
      });
    } catch (error) {
      console.error("Error auto-saving settings:", error);
    }
  };

  const checkNotificationPermissions = async () => {
    if (notificationsEnabled) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") {
          setNotificationsEnabled(false);
          Alert.alert(
            "Notification Permission Denied",
            "You need to allow notifications in device settings to receive reminders.",
          );
        }
      }
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getSettingsWithDefaults();
      
      // Meditation settings
      setMeditationDuration(settings.meditationDuration || 10);
      setSelectedSoundTheme(settings.selectedSoundTheme || "rain");
      setMeditationReminder(settings.meditationReminder !== undefined ? settings.meditationReminder : false);
      setMeditationReminderTime(new Date(settings.meditationReminderTime || new Date().setHours(8, 30, 0, 0)));
      setKeepScreenAwake(settings.keepScreenAwake !== undefined ? settings.keepScreenAwake : true);
      setVoiceGuidanceEnabled(settings.voiceGuidanceEnabled !== undefined ? settings.voiceGuidanceEnabled : true);
      setDefaultGuidanceType(settings.defaultGuidanceType || "dailyFocus");
      setVoiceGuidanceVolume(settings.voiceGuidanceVolume !== undefined ? settings.voiceGuidanceVolume : 0.7);
      setSelectedVoice(settings.selectedVoice || "en-US-JennyMultilingualNeural");
      setVoiceSpeed(settings.voiceSpeed !== undefined ? settings.voiceSpeed : 0.85);

      // Focus Settings
      setFocusDuration(settings.focusDuration || 25);
      setBreakDuration(settings.breakDuration || 5);
      setLongBreakDuration(settings.longBreakDuration || 15);
      setLongBreakInterval(settings.longBreakInterval || 4);
      setFocusNotifications(settings.focusNotifications !== false);
      setAutoStartNextFocus(settings.autoStartNextFocus || false);
      setDifferentWeekendSettings(
        settings.differentWeekendSettings || false,
      );

      // Journal settings
      setIncludeWeather(settings.includeWeather !== false);
      setIncludeLocation(settings.includeLocation !== false);
      setMarkdownSupport(settings.markdownSupport !== false);
      setJournalReminder(settings.journalReminder || false);
      if (settings.journalReminderTime) {
        setJournalReminderTime(new Date(settings.journalReminderTime));
      }
      setSelectedJournalTemplate(
        settings.selectedJournalTemplate || "default",
      );

      // Load meditation reminder settings
      setMeditationReminder(settings.meditationReminder || false);
      if (settings.meditationReminderTime) {
        setMeditationReminderTime(
          new Date(settings.meditationReminderTime),
        );
      }

      // General settings
      setDarkMode(settings.darkMode !== false);
      setAppTheme(settings.appTheme || "dark");
      setFontSizeScale(settings.fontSizeScale || "medium");
      setNotificationsEnabled(settings.notificationsEnabled !== false);
      setSyncEnabled(settings.syncEnabled || false);

      // Load notification settings
      const taskNotificationsValue =
        await storageService.getItem("taskNotifications");
      if (taskNotificationsValue !== null) {
        setTaskNotifications(JSON.parse(taskNotificationsValue));
      }

      const notificationSoundValue =
        await storageService.getItem("notificationSound");
      if (notificationSoundValue !== null) {
        setNotificationSound(notificationSoundValue);
      }

      const quietHoursEnabledValue =
        await storageService.getItem("quietHoursEnabled");
      if (quietHoursEnabledValue !== null) {
        setQuietHoursEnabled(JSON.parse(quietHoursEnabledValue));
      }

      const quietHoursStartValue =
        await storageService.getItem("quietHoursStart");
      if (quietHoursStartValue !== null) {
        setQuietHoursStart(parseInt(quietHoursStartValue));
      }

      const quietHoursEndValue = await storageService.getItem("quietHoursEnd");
      if (quietHoursEndValue !== null) {
        setQuietHoursEnd(parseInt(quietHoursEndValue));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    try {
      console.log("Saving settings...");
      // Create settings object
      const settings = {
        // Meditation settings
        meditationDuration,
        selectedSoundTheme,
        meditationReminder,
        meditationReminderTime: meditationReminderTime.toISOString(),
        keepScreenAwake,
        voiceGuidanceEnabled,
        defaultGuidanceType,
        voiceGuidanceVolume,
        selectedVoice,
        voiceSpeed,

        // Focus settings
        focusDuration,
        breakDuration,
        longBreakDuration,
        longBreakInterval,
        focusNotifications,
        autoStartNextFocus,
        differentWeekendSettings,

        // Journal settings
        includeWeather,
        includeLocation,
        markdownSupport,
        journalReminder,
        journalReminderTime: journalReminderTime.toISOString(),
        selectedJournalTemplate,

        // Notifications
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
      };

      console.log("Saving settings:", settings);
      await storageService.setItem("userSettings", JSON.stringify(settings));

      // Set journal reminder notification if enabled
      if (journalReminder && notificationsEnabled) {
        await scheduleJournalReminder();
      } else {
        await notificationService.scheduleJournalReminder(0, 0, false);
      }

      // Set meditation reminder notification (if enabled)
      if (meditationReminder && notificationsEnabled) {
        await scheduleMeditationReminder();
      } else {
        await notificationService.scheduleMeditationReminder(0, 0, false);
      }

      // Save notification settings
      await storageService.setItem(
        "taskNotifications",
        JSON.stringify(taskNotifications),
      );
      await storageService.setItem("notificationSound", notificationSound);
      await storageService.setItem(
        "quietHoursEnabled",
        JSON.stringify(quietHoursEnabled),
      );
      await storageService.setItem("quietHoursStart", quietHoursStart.toString());
      await storageService.setItem("quietHoursEnd", quietHoursEnd.toString());

      // Update notification service configuration
      await notificationService.updateConfig({
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: new Date(quietHoursStart),
        quietHoursEnd: new Date(quietHoursEnd),
      });

      // Delay showing save success message to avoid conflicts with notifications
      setTimeout(() => {
        Alert.alert("Settings Saved", "Your preferences have been updated.");
      }, 1000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      Alert.alert("Error", "Unable to save settings. Please try again.");
    }
  };

  const scheduleJournalReminder = async () => {
    try {
      if (journalReminder && notificationsEnabled) {
        const hours = journalReminderTime.getHours();
        const minutes = journalReminderTime.getMinutes();

        // Schedule journal reminder using notification service
        await notificationService.scheduleJournalReminder(hours, minutes, true);
        console.log("Journal reminder scheduled for:", hours, ":", minutes);
      } else {
        // Cancel scheduling if reminder is disabled
        await notificationService.scheduleJournalReminder(0, 0, false);
        console.log("Journal reminder disabled");
      }
    } catch (error) {
      console.error("Error scheduling journal reminder:", error);
    }
  };

  // Schedule meditation reminder
  const scheduleMeditationReminder = async () => {
    try {
      if (meditationReminder && notificationsEnabled) {
        const hours = meditationReminderTime.getHours();
        const minutes = meditationReminderTime.getMinutes();

        // Schedule meditation reminder using notification service
        await notificationService.scheduleMeditationReminder(
          hours,
          minutes,
          true,
        );
        console.log("Meditation reminder scheduled for:", hours, ":", minutes);
      } else {
        // Cancel scheduling if reminder is disabled
        await notificationService.scheduleMeditationReminder(0, 0, false);
        console.log("Meditation reminder disabled");
      }
    } catch (error) {
      console.error("Error scheduling meditation reminder:", error);
    }
  };

  const exportData = async () => {
    try {
      const allData = {};
      const allKeys = await storageService.getAllKeys();
      const allResults = await storageService.multiGet(allKeys);

      allResults.forEach(([key, value]) => {
        allData[key] = value;
      });

      const dataStr = JSON.stringify(allData);
      const encrypted = exportPassword ? dataStr : dataStr; // Simplified, should encrypt if password provided

      const fileUri = FileSystem.documentDirectory + "kukai_backup.json";
      await FileSystem.writeAsStringAsync(fileUri, encrypted);

      await Share.share({
        url: fileUri,
        title: "Kukai Data Backup",
      });

      setExportModalVisible(false);
      setExportPassword("");
    } catch (error) {
      console.error("Error exporting data:", error);
      Alert.alert("Export Error", "Could not export data. Please try again.");
    }
  };

  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.type === "success") {
        const data = await FileSystem.readAsStringAsync(result.uri);
        const parsedData = JSON.parse(data);

        Alert.alert(
          "Confirm Import",
          "Importing will replace all existing data. Continue?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Import",
              onPress: async () => {
                try {
                  await storageService.clear();

                  const entries = Object.entries(parsedData);
                  const multiSetArray = entries.map(([key, value]) => [
                    key,
                    value,
                  ]);

                  await storageService.multiSet(multiSetArray);
                  await loadSettings();

                  Alert.alert(
                    "Import Successful",
                    "Your data has been successfully imported.",
                  );
                } catch (error) {
                  console.error("Error importing data:", error);
                  Alert.alert(
                    "Import Error",
                    "An error occurred during import.",
                  );
                }
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error importing data:", error);
      Alert.alert(
        "Import Error",
        "Could not import data. Please check the file format.",
      );
    }
  };

  // Function to open dropdown modal
  const openOptionModal = (options, currentVal, setterFunction, title) => {
    // Ensure options is an array
    if (!Array.isArray(options) || options.length === 0) {
      console.error("Error: options must be a non-empty array", options);
      Alert.alert("Error", "An error occurred. Please try again later.");
      return;
    }

    // Ensure setterFunction is a function
    if (typeof setterFunction !== "function") {
      console.error("Error: setterFunction is not a function", setterFunction);
      Alert.alert("Error", "An error occurred. Please try again later.");
      return;
    }

    // Ensure title is a string
    const modalTitle = typeof title === "string" ? title : "Select an option";

    setCurrentOptions(options);
    setCurrentValue(currentVal);
    setCurrentSetter(() => (newValue) => {
      setterFunction(newValue);
      setSettingsChanged(true); // Mark settings as changed
    });
    setCurrentModalTitle(modalTitle);
    setOptionModalVisible(true);
  };

  // Render dropdown option
  const renderDropdownOption = (value, options, label, description = null) => {
    const selectedOption = options.find((option) => option.value === value);

    const getSetter = () => {
      switch (label) {
        case "Duration":
          return setMeditationDuration;
        case "Focus Duration":
          return setFocusDuration;
        case "Break Duration":
          return setBreakDuration;
        case "Long Break Duration":
          return setLongBreakDuration;
        case "Long Break Interval":
          return setLongBreakInterval;
        case "Journal Template":
          return setSelectedJournalTemplate;
        case "Sound Theme":
          return setSelectedSoundTheme;
        case "App Theme":
          return setAppTheme;
        case "Font Size":
          return setFontSizeScale;
        case "Notification Sound":
          return setNotificationSound;
        default:
          console.warn(`No setter found for label: ${label}`);
          // Return an empty function instead of null to avoid type errors
          return (val) => {
            console.warn(
              `Attempted to set value for unknown setting: ${label}`,
              val,
            );
          };
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.settingRow,
          appTheme === "light" && styles.lightSettingRow,
        ]}
        onPress={() => openOptionModal(options, value, getSetter(), label)}
      >
        <View style={styles.settingLabelContainer}>
          <Text
            style={[
              styles.settingLabel,
              appTheme === "light" && styles.lightText,
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={[
                styles.settingDescription,
                appTheme === "light" && styles.lightSettingDescription,
              ]}
            >
              {description}
            </Text>
          )}
        </View>
        <View style={styles.settingValueContainer}>
          <Text
            style={[
              styles.settingValue,
              appTheme === "light" && styles.lightText,
            ]}
          >
            {selectedOption ? selectedOption.label : "Select"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Modify settings switch render function
  const renderSettingSwitch = (value, setter, label, description = null) => {
    const toggleSwitch = () => {
      setter(!value);
      setSettingsChanged(true); // Mark settings as changed
    };

    return (
      <View
        style={[
          styles.settingRow,
          appTheme === "light" && styles.lightSettingRow,
        ]}
      >
        <View style={styles.settingLabelContainer}>
          <Text
            style={[
              styles.settingLabel,
              appTheme === "light" && styles.lightText,
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={[
                styles.settingDescription,
                appTheme === "light" && styles.lightSettingDescription,
              ]}
            >
              {description}
            </Text>
          )}
        </View>
        <Switch
          trackColor={{
            false: appTheme === "light" ? "#DDDDDD" : "#222222",
            true: "#777777",
          }}
          thumbColor={value ? "#FFFFFF" : "#888888"}
          ios_backgroundColor={appTheme === "light" ? "#DDDDDD" : "#222222"}
          onValueChange={toggleSwitch}
          value={value}
        />
      </View>
    );
  };

  const renderTimeSetting = (value, onPress, label, description = null) => (
    <TouchableOpacity
      style={[
        styles.settingRow,
        appTheme === "light" && styles.lightSettingRow,
      ]}
      onPress={onPress}
    >
      <View style={styles.settingLabelContainer}>
        <Text
          style={[
            styles.settingLabel,
            appTheme === "light" && styles.lightText,
          ]}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={[
              styles.settingDescription,
              appTheme === "light" && styles.lightSettingDescription,
            ]}
          >
            {description}
          </Text>
        )}
      </View>
      <View style={styles.timeContainer}>
        <Text
          style={[styles.timeText, appTheme === "light" && styles.lightText]}
        >
          {value.getHours().toString().padStart(2, "0")}:
          {value.getMinutes().toString().padStart(2, "0")}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderActionButton = (
    onPress,
    label,
    icon,
    description = null,
    destructive = false,
  ) => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        appTheme === "light" && styles.lightActionButton,
        destructive &&
          (appTheme === "light"
            ? styles.lightDangerButton
            : styles.dangerButton),
      ]}
      onPress={onPress}
    >
      <View style={styles.actionButtonContent}>
        <View style={styles.actionButtonTextContainer}>
          <Text
            style={[
              styles.actionButtonLabel,
              appTheme === "light" && styles.lightText,
              destructive &&
                (appTheme === "light"
                  ? styles.lightDangerButtonText
                  : styles.dangerButtonText),
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={[
                styles.actionButtonDescription,
                appTheme === "light" && styles.lightSettingDescription,
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Modify time picker handler function
  const handleTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      // Only update temporary state, do not apply immediately
      setTempSelectedTime(selectedTime);
    }
  };

  // Add function to confirm time selection
  const confirmTimeSelection = () => {
    if (tempSelectedTime) {
      if (currentTimePickerMode === "journalReminder") {
        setJournalReminderTime(tempSelectedTime);
      } else if (currentTimePickerMode === "meditationReminder") {
        setMeditationReminderTime(tempSelectedTime);
      }
      setSettingsChanged(true);
    }
    setTimePickerVisible(false);
    setTempSelectedTime(null);
  };

  // Cancel time selection
  const cancelTimeSelection = () => {
    setTimePickerVisible(false);
    setTempSelectedTime(null);
  };

  // Handle operations after backup completion
  const handleBackupComplete = () => {
    // Reload settings
    loadSettings();
  };

  const clearAllData = async () => {
    // Show confirmation dialog before clearing data
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your data including tasks, journals, and settings. This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All Data",
          style: "destructive",
          onPress: async () => {
            try {
              // Get all keys
              const allKeys = await storageService.getAllKeys();

              // Filter out keys that shouldn't be deleted
              const keysToRemove = allKeys.filter(
                (key) =>
                  !key.startsWith("expo.") && !key.startsWith("google_drive_"),
              );

              // Remove all data
              await storageService.multiRemove(keysToRemove);

              // Reset state to defaults
              setDarkMode(true);
              setNotificationsEnabled(true);
              setJournalReminder(false);
              setJournalReminderTime(
                new Date(new Date().setHours(21, 0, 0, 0)),
              );
              setFocusDuration(25);
              setBreakDuration(5);
              setLongBreakDuration(15);
              setLongBreakInterval(4);
              setAutoStartNextFocus(false);
              setMeditationDuration(10);
              setSelectedSoundTheme("rain");
              setAppTheme("dark");
              setFontSizeScale("medium");
              setIncludeWeather(true);
              setIncludeLocation(true);
              setMarkdownSupport(true);
              setSelectedJournalTemplate("default");
              setMeditationReminder(false);
              setMeditationReminderTime(
                new Date(new Date().setHours(8, 30, 0, 0)),
              );
              setFocusNotifications(true);
              setDifferentWeekendSettings(false);
              setSyncEnabled(false);

              // Reset notification settings
              setTaskNotifications(true);
              setNotificationSound("default");
              setQuietHoursEnabled(false);
              setQuietHoursStart(new Date().setHours(22, 0, 0, 0));
              setQuietHoursEnd(new Date().setHours(7, 0, 0, 0));

              Alert.alert("Data Cleared", "All app data has been deleted.");
            } catch (error) {
              console.error("Error clearing data:", error);
              Alert.alert("Error", "An error occurred while clearing data.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const showAboutInfo = () => {
    Alert.alert(
      "About Kukai",
      "Version 1.0.0\n\nA personal growth app focused on meditation, focus, and journaling.",
    );
  };

  const sendFeedback = () => {
    // Implement feedback mechanism here
    // For now, just show a confirmation
    Alert.alert(
      "Send Feedback",
      "Thank you for your feedback, it helps us improve the app.",
    );
  };

  // Update the verifyDatabaseHealth function:
  const verifyDatabaseHealth = async () => {
    try {
      // Show loading indicator
      setLoading(true);
      
      const result = await verifyDatabase();
      
      // Hide loading indicator
      setLoading(false);
      
      if (result.success) {
        // Show success message
        Alert.alert(
          'Database Verification',
          'Database is healthy and working properly.',
          [{ text: 'OK' }]
        );
      } else {
        // Show failure message with option to reset
        Alert.alert(
          'Database Issues Found',
          `The database has issues: ${result.error}. Would you like to reset the database to fix these issues?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reset Database', 
              style: 'destructive',
              onPress: resetDatabase
            }
          ]
        );
      }
    } catch (error) {
      // Hide loading indicator
      setLoading(false);
      
      // Show error message
      Alert.alert(
        'Verification Error',
        `An error occurred during database verification: ${error.message}`,
        [{ text: 'OK' }]
      );
    }
  };

  // Handle quiet hours start time change
  const handleQuietHoursStartChange = (event, selectedTime) => {
    setShowQuietHoursStartPicker(false);
    if (selectedTime) {
      setQuietHoursStart(selectedTime.getTime());
      autoSaveSettings();
    }
  };

  // Handle quiet hours end time change
  const handleQuietHoursEndChange = (event, selectedTime) => {
    setShowQuietHoursEndPicker(false);
    if (selectedTime) {
      setQuietHoursEnd(selectedTime.getTime());
      autoSaveSettings();
    }
  };

  // Add function to handle template selection
  const handleTemplateSelect = (templateId, templateContent) => {
    setSelectedJournalTemplate(templateId);
    setSettingsChanged(true);

    // Save template selection
    autoSaveSettings();
  };

  // Add function to open template manager
  const openTemplateManager = () => {
    setShowTemplateManager(true);
  };

  // Modify the Journal Template dropdown option to show a "Manage" button
  const renderJournalTemplateOption = () => {
    const selectedTemplate = journalTemplates.find(
      (template) => template.value === selectedJournalTemplate,
    );
    const selectedLabel = selectedTemplate ? selectedTemplate.label : "Default";

    return (
      <TouchableOpacity
        style={[
          styles.settingRow,
          appTheme === "light" && styles.lightSettingRow,
        ]}
        onPress={openTemplateManager}
      >
        <View style={styles.settingLabelContainer}>
          <Text
            style={[
              styles.settingLabel,
              appTheme === "light" && styles.lightText,
            ]}
          >
            Journal Template
          </Text>
          <Text
            style={[
              styles.settingDescription,
              appTheme === "light" && styles.lightSettingDescription,
            ]}
          >
            Choose default template for new journal entries
          </Text>
        </View>
        <View style={styles.settingValueContainer}>
          <Text
            style={[
              styles.settingValue,
              appTheme === "light" && styles.lightText,
            ]}
          >
            {selectedLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Add this function to handle schema recreation
  const handleForceRecreateSchema = async () => {
    // Show confirmation dialog
    Alert.alert(
      'Force Recreate Database Schema',
      'This will drop and recreate all tables with the correct schema. This is useful if you have issues creating tasks or journal entries. All data will be lost. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Recreate Schema',
          style: 'destructive',
          onPress: async () => {
            try {
              // Show loading
              setLoading(true);
              
              // Force recreate schema
              const success = await forceRecreateSchema();
              
              // Hide loading
              setLoading(false);
              
              if (success) {
                Alert.alert(
                  'Schema Recreated',
                  'Database schema has been recreated successfully. The app will now restart.',
                  [{ text: 'OK', onPress: () => DeviceEventEmitter.emit('hardReload') }]
                );
              } else {
                Alert.alert(
                  'Schema Recreation Failed',
                  'Failed to recreate database schema. Please try again or contact support.'
                );
              }
            } catch (error) {
              // Hide loading
              setLoading(false);
              
              Alert.alert(
                'Error',
                `Failed to recreate schema: ${error.message}`
              );
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container, 
        appTheme === "light" && styles.lightContainer,
        { 
          paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20
        }
      ]}
    >
      <CustomHeader 
        title="SETTINGS"
        onBackPress={() => navigation.goBack()}
        showBottomBorder={false}
      />

      <ScrollView
        style={styles.settingsContainer}
        contentContainerStyle={[
          styles.settingsContentContainer,
          { paddingBottom: Platform.OS === 'ios' ? 50 : 20 }
        ]}
      >
        {/* Meditation Settings */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            MEDITATION SETTINGS
          </Text>

          {renderDropdownOption(
            meditationDuration,
            meditationDurations,
            "Duration",
            "Set how long your meditation session will last",
          )}

          {renderDropdownOption(
            selectedSoundTheme,
            soundThemes,
            "Sound Theme",
            "Choose your preferred background sound",
          )}

          {/* Voice Guidance - Single entry with modal */}
          <TouchableOpacity 
            style={[
              styles.settingItem, 
              appTheme === "light" ? {backgroundColor: "#FFFFFF"} : {backgroundColor: "#1A1A1A"},
              { borderRadius: 10, marginBottom: 10 }
            ]}
            onPress={() => setShowVoiceGuidanceModal(true)}
          >
            <View style={styles.settingContent}>
              <Text style={[
                styles.settingLabel, 
                appTheme === "light" ? styles.lightText : null
              ]}>
                Voice Guidance
              </Text>
              <Text style={[
                styles.settingDescription, 
                appTheme === "light" ? styles.lightSettingDescription : null
              ]}>
                Configure spoken meditation guidance
              </Text>
            </View>
            <MaterialIcons 
              name="chevron-right" 
              size={24} 
              color={appTheme === "light" ? "#555" : "#AAA"} 
            />
          </TouchableOpacity>

          {/* Voice Guidance Modal */}
          <VoiceGuidanceModal 
            visible={showVoiceGuidanceModal}
            onClose={() => setShowVoiceGuidanceModal(false)}
            settings={{
              voiceGuidanceEnabled,
              guidanceType: defaultGuidanceType,
              selectedVoice,
              voiceVolume: voiceGuidanceVolume,
              voiceSpeed
            }}
            setSettingsChanged={setSettingsChanged}
            onSettingChange={(key, value) => {
              switch (key) {
                case 'voiceGuidanceEnabled':
                  setVoiceGuidanceEnabled(value);
                  break;
                case 'guidanceType':
                  setDefaultGuidanceType(value);
                  break;
                case 'selectedVoice':
                  setSelectedVoice(value);
                  break;
                case 'voiceVolume':
                  setVoiceGuidanceVolume(value);
                  break;
                case 'voiceSpeed':
                  setVoiceSpeed(value);
                  break;
                case 'guidanceTypeSelector':
                  // 关闭当前模态窗口
                  setShowVoiceGuidanceModal(false);
                  // 打开选项选择器
                  setTimeout(() => {
                    openOptionModal(
                      guidanceTypes, 
                      defaultGuidanceType, 
                      (value) => {
                        setDefaultGuidanceType(value);
                        setSettingsChanged(true);
                      }, 
                      "Guidance Type"
                    );
                  }, 300);
                  break;
                case 'voiceSelector':
                  // 关闭当前模态窗口
                  setShowVoiceGuidanceModal(false);
                  // 打开选项选择器
                  setTimeout(() => {
                    openOptionModal(
                      voiceOptions, 
                      selectedVoice, 
                      (value) => {
                        setSelectedVoice(value);
                        setSettingsChanged(true);
                      }, 
                      "Voice"
                    );
                  }, 300);
                  break;
                default:
                  break;
              }
              setSettingsChanged(true);
            }}
          />

          {/* Meditation reminder - moved to the end */}
          {renderSettingSwitch(
            meditationReminder,
            setMeditationReminder,
            "Meditation Reminder",
            "Get a reminder to meditate"
          )}

          {meditationReminder &&
            renderTimeSetting(
              meditationReminderTime,
              () => {
                setCurrentTimePickerMode("meditationReminder");
                setTimePickerVisible(true);
              },
              "Reminder Time",
              "Time to remind you for your daily meditation practice",
            )}
        </View>

        {/* Focus Settings */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            FOCUS SETTINGS
          </Text>

          {renderDropdownOption(
            focusDuration,
            focusDurations,
            "Focus Duration",
            "Set how long each focus period lasts",
          )}

          {renderDropdownOption(
            breakDuration,
            breakDurations,
            "Break Duration",
            "Set how long regular breaks last",
          )}

          {renderDropdownOption(
            longBreakDuration,
            longBreakDurations,
            "Long Break Duration",
            "Set duration for long breaks after multiple focus cycles",
          )}

          {renderDropdownOption(
            longBreakInterval,
            longBreakIntervals,
            "Long Break Interval",
            "Set how many focus cycles before a long break",
          )}

          {renderSettingSwitch(
            focusNotifications,
            setFocusNotifications,
            "Focus Notifications",
            "Receive notifications when focus periods end",
          )}

          {renderSettingSwitch(
            autoStartNextFocus,
            setAutoStartNextFocus,
            "Auto-start Next Focus",
            "Automatically start next focus period after break",
          )}

          {renderSettingSwitch(
            differentWeekendSettings,
            setDifferentWeekendSettings,
            "Weekday/Weekend Settings",
            "Use different settings on weekends",
          )}
        </View>

        {/* Journal Settings */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            JOURNAL SETTINGS
          </Text>

          {renderSettingSwitch(
            includeWeather,
            setIncludeWeather,
            "Include Weather",
            "Automatically record weather in your journal",
          )}

          {renderSettingSwitch(
            includeLocation,
            setIncludeLocation,
            "Include Location",
            "Automatically record location in your journal",
          )}

          {renderSettingSwitch(
            markdownSupport,
            setMarkdownSupport,
            "Markdown Support",
            "Allow markdown formatting in journal entries",
          )}

          {renderSettingSwitch(
            journalReminder,
            setJournalReminder,
            "Journal Reminder",
            "Set a daily reminder to write in your journal",
          )}

          {journalReminder &&
            renderTimeSetting(
              journalReminderTime,
              () => {
                setCurrentTimePickerMode("journalReminder");
                setTimePickerVisible(true);
              },
              "Reminder Time",
              "Time to remind you to write in your journal daily",
            )}

          {/* Replace standard dropdown with custom journal template option */}
          {renderJournalTemplateOption()}
        </View>

        {/* General Settings */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            GENERAL SETTINGS
          </Text>

          {renderSettingSwitch(
            keepScreenAwake,
            setKeepScreenAwake,
            "Keep Screen Awake",
            "Prevents screen from turning off during meditation and focus sessions"
          )}

          {renderDropdownOption(
            appTheme,
            appThemes,
            "App Theme",
            "Set the appearance of the app",
          )}

          {renderDropdownOption(
            fontSizeScale,
            fontSizes,
            "Font Size",
            "Adjust text size throughout the app",
          )}

          {renderSettingSwitch(
            notificationsEnabled,
            (value) => {
              setNotificationsEnabled(value);
              if (value) {
                checkNotificationPermissions();
              }
            },
            "Enable Notifications",
            "Allow the app to send notifications and reminders",
          )}
        </View>

        {/* Notification Settings Section */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            NOTIFICATION SETTINGS
          </Text>

          {notificationsEnabled && (
            <>
              {renderSettingSwitch(
                taskNotifications,
                setTaskNotifications,
                "Task Reminders",
                "Remind you before tasks start",
              )}

              {renderSettingSwitch(
                focusNotifications,
                setFocusNotifications,
                "Focus Mode Notifications",
                "Notify you when focus sessions end",
              )}

              {renderDropdownOption(
                notificationSound,
                [
                  { label: "Default", value: "default" },
                  { label: "Gentle", value: "gentle" },
                  { label: "Alert", value: "alert" },
                  { label: "None", value: "none" },
                ],
                "Notification Sound",
                "Choose notification alert sound",
              )}

              {renderSettingSwitch(
                quietHoursEnabled,
                setQuietHoursEnabled,
                "Quiet Hours",
                "Disable notifications during specific hours",
              )}

              {quietHoursEnabled && (
                <>
                  {renderTimeSetting(
                    new Date(quietHoursStart),
                    () => setShowQuietHoursStartPicker(true),
                    "Quiet Hours Start",
                    "Set when quiet hours begin",
                  )}

                  {renderTimeSetting(
                    new Date(quietHoursEnd),
                    () => setShowQuietHoursEndPicker(true),
                    "Quiet Hours End",
                    "Set when quiet hours end",
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* Data Management Section */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            DATA MANAGEMENT
          </Text>

          {renderSettingSwitch(
            syncEnabled,
            setSyncEnabled,
            "Data Sync",
            "Sync your data across devices",
          )}

          {/* Cloud Backup */}
          {renderActionButton(
            () => {
              // Show the CloudBackupSection as a modal or navigate to a dedicated screen
              // For now, we'll just toggle the visibility of the CloudBackupSection
              setShowCloudBackup(!showCloudBackup);
            },
            "Cloud Backup",
            null,
            "Backup and sync your app data",
          )}

          {showCloudBackup && (
            <View
              style={[
                styles.cloudBackupContainer,
                appTheme === "light" && styles.lightCloudBackupContainer,
              ]}
            >
              <CloudBackupSection
                navigation={navigation}
                onBackupComplete={handleBackupComplete}
                theme={appTheme}
              />
            </View>
          )}

          {renderActionButton(
            exportData,
            "Local Backup",
            "save-alt",
            "Backup data to local file (Recommended for users without an Apple developer account)",
          )}

          {renderActionButton(
            importData,
            "Restore from Local",
            "restore",
            "Restore data from local backup file",
          )}

          {/* Clear Data */}
          {renderActionButton(
            clearAllData,
            "Clear All Data",
            "delete",
            "Permanently delete all app data",
            true,
          )}
        </View>

        {/* About Section */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            ABOUT
          </Text>

          {renderActionButton(showAboutInfo, "Version Info", "info")}

          {renderActionButton(sendFeedback, "Send Feedback", "feedback")}
        </View>

        {/* Database Management Section */}
        <View style={styles.settingSection}>
          <Text
            style={[
              styles.sectionTitle,
              appTheme === "light" && styles.lightSectionTitle,
            ]}
          >
            DATABASE MANAGEMENT
          </Text>
          
          <TouchableOpacity 
            style={[
              styles.settingRow,
              appTheme === "light" && styles.lightSettingRow,
            ]} 
            onPress={verifyDatabaseHealth}
          >
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, appTheme === "light" && styles.lightText]}>
                Verify Database
              </Text>
              <Text style={[styles.settingDescription, appTheme === "light" && styles.lightSettingDescription]}>
                Check database health and fix minor issues
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.settingRow,
              appTheme === "light" && styles.lightSettingRow,
              styles.warningRow
            ]} 
            onPress={handleForceRecreateSchema}
          >
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, styles.warningText]}>
                Force Recreate Schema
              </Text>
              <Text style={[styles.settingDescription, appTheme === "light" && styles.lightSettingDescription]}>
                Use this if you can't create tasks or journal entries. This will recreate all database tables.
                WARNING: All data will be lost!
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.settingRow,
              appTheme === "light" && styles.lightSettingRow,
              styles.dangerRow
            ]} 
            onPress={resetDatabase}
          >
            <View style={styles.settingLabelContainer}>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                Reset Database
              </Text>
              <Text style={[styles.settingDescription, appTheme === "light" && styles.lightSettingDescription]}>
                Completely reset the database. Use this if you encounter data corruption issues.
                WARNING: This will delete all your data!
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Options Modal */}
      <Modal
        transparent={true}
        visible={optionModalVisible}
        animationType="fade"
        onRequestClose={() => setOptionModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOptionModalVisible(false)}>
          <View
            style={[
              styles.modalOverlay,
              appTheme === "light" && styles.lightModalOverlay,
            ]}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.modalContent,
                  appTheme === "light" && styles.lightModalContent,
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    appTheme === "light" && styles.lightModalTitle,
                  ]}
                >
                  {currentModalTitle}
                </Text>
                <ScrollView style={{ maxHeight: 300 }}>
                  {currentOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modalOption,
                        appTheme === "light" && styles.lightModalOption,
                        currentValue === option.value && styles.modalOptionSelected,
                        currentValue === option.value &&
                          appTheme === "light" &&
                          styles.lightModalOptionSelected,
                      ]}
                      onPress={() => {
                        if (currentSetter) {
                          currentSetter(option.value);
                          setSettingsChanged(true);
                        }
                        setOptionModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          appTheme === "light" && styles.lightModalOptionText,
                          currentValue === option.value &&
                            styles.modalOptionTextSelected,
                          currentValue === option.value &&
                            appTheme === "light" &&
                            styles.lightModalOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {currentValue === option.value && (
                        <MaterialIcons
                          name="check"
                          size={24}
                          color={appTheme === "light" ? "#000" : "#FFF"}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Time Picker */}
      {isTimePickerVisible && (
        <Modal
          transparent={true}
          visible={isTimePickerVisible}
          animationType="fade"
          onRequestClose={cancelTimeSelection}
        >
          <View
            style={[
              styles.modalOverlay,
              appTheme === "light" && styles.lightModalOverlay,
            ]}
          >
            <View
              style={[
                styles.modalContent,
                appTheme === "light" && styles.lightModalContent,
              ]}
            >
              <Text
                style={[
                  styles.modalTitle,
                  appTheme === "light" && styles.lightModalTitle,
                ]}
              >
                Select Reminder Time
              </Text>
              <View
                style={[
                  styles.timePickerContainer,
                  appTheme === "light" && styles.lightTimePickerContainer,
                ]}
              >
                <CustomDateTimePicker
                  value={
                    tempSelectedTime ||
                    (currentTimePickerMode === "journalReminder"
                      ? journalReminderTime
                      : meditationReminderTime)
                  }
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.timePicker}
                  textColor={appTheme === "light" ? "#000000" : "#FFFFFF"}
                  themeVariant={appTheme === "light" ? "light" : "dark"}
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    appTheme === "light" && styles.lightCancelButton,
                  ]}
                  onPress={cancelTimeSelection}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      appTheme === "light" && styles.lightModalButtonText,
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.confirmButton,
                    appTheme === "light" && styles.lightConfirmButton,
                  ]}
                  onPress={confirmTimeSelection}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      appTheme === "light" && styles.lightConfirmButtonText,
                    ]}
                  >
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Export Data Modal */}
      <Modal
        transparent={true}
        visible={isExportModalVisible}
        animationType="slide"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            appTheme === "light" && styles.lightModalOverlay,
          ]}
        >
          <View
            style={[
              styles.modalContent,
              appTheme === "light" && styles.lightModalContent,
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                appTheme === "light" && styles.lightModalTitle,
              ]}
            >
              Export Data
            </Text>
            <Text
              style={[
                styles.modalDescription,
                appTheme === "light" && styles.lightModalDescription,
              ]}
            >
              Optional: Add a password to protect your data.
            </Text>
            <TextInput
              style={[
                styles.passwordInput,
                appTheme === "light" && styles.lightPasswordInput,
              ]}
              placeholder="Password (optional)"
              placeholderTextColor={appTheme === "light" ? "#777" : "#999"}
              secureTextEntry={true}
              value={exportPassword}
              onChangeText={setExportPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  appTheme === "light" && styles.lightCancelButton,
                ]}
                onPress={() => {
                  setExportModalVisible(false);
                  setExportPassword("");
                }}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    appTheme === "light" && styles.lightModalButtonText,
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  appTheme === "light" && styles.lightConfirmButton,
                ]}
                onPress={exportData}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    appTheme === "light" && styles.lightConfirmButtonText,
                  ]}
                >
                  Export
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quiet hours start time picker */}
      {showQuietHoursStartPicker && (
        <CustomDateTimePicker
          value={new Date(quietHoursStart)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleQuietHoursStartChange}
        />
      )}

      {/* Quiet hours end time picker */}
      {showQuietHoursEndPicker && (
        <CustomDateTimePicker
          value={new Date(quietHoursEnd)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleQuietHoursEndChange}
        />
      )}

      {/* Add Template Manager Modal */}
      <JournalTemplateManager
        isVisible={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onTemplateSelect={handleTemplateSelect}
      />

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Verifying database...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  lightContainer: {
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  lightHeader: {
    borderBottomColor: "#ddd",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  lightText: {
    color: "#000",
  },
  headerRight: {
    width: 24,
    height: 24,
  },
  saveButton: {
    padding: 5,
  },
  settingsContainer: {
    flex: 1,
  },
  settingsContentContainer: {
    padding: 20,
  },
  settingSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 15,
    letterSpacing: 1,
  },
  lightSectionTitle: {
    color: "#333",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  lightSettingRow: {
    backgroundColor: "#DDDDDD",
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    color: "#CCC",
    fontSize: 16,
  },
  settingDescription: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  lightSettingDescription: {
    color: "#333",
  },
  settingValueContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingValue: {
    color: "#CCC",
    fontSize: 16,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    color: "#CCC",
    fontSize: 16,
    marginRight: 8,
  },
  timeIcon: {
    marginTop: 1,
  },
  actionButton: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lightActionButton: {
    backgroundColor: "#DDDDDD",
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtonTextContainer: {
    marginLeft: 0,
  },
  actionButtonLabel: {
    color: "#CCC",
    fontSize: 16,
  },
  actionButtonDescription: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  dangerButton: {
    backgroundColor: "#1a0000",
  },
  lightDangerButton: {
    backgroundColor: "#F55",
  },
  dangerButtonText: {
    color: "#F55",
  },
  lightDangerButtonText: {
    color: "#000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightModalOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 20,
    maxHeight: "70%",
  },
  lightModalContent: {
    backgroundColor: "#f5f5f5",
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: "center",
  },
  lightModalTitle: {
    color: "#000",
  },
  modalDescription: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
  },
  lightModalDescription: {
    color: "#333",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  lightModalOption: {
    borderBottomColor: "#ddd",
  },
  modalOptionSelected: {
    backgroundColor: "#333",
  },
  lightModalOptionSelected: {
    backgroundColor: "#ddd",
  },
  modalOptionText: {
    color: "#CCC",
    fontSize: 16,
  },
  lightModalOptionText: {
    color: "#333",
  },
  modalOptionTextSelected: {
    color: "#FFF",
    fontWeight: "bold",
  },
  lightModalOptionTextSelected: {
    color: "#000",
    fontWeight: "bold",
  },
  passwordInput: {
    backgroundColor: "#222",
    color: "#FFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  lightPasswordInput: {
    backgroundColor: "#ddd",
    color: "#000",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#444",
  },
  lightCancelButton: {
    backgroundColor: "#ccc",
  },
  confirmButton: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    marginLeft: 10,
    borderRadius: 8,
  },
  lightConfirmButton: {
    backgroundColor: "#333",
  },
  modalButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
  lightModalButtonText: {
    color: "#000",
  },
  timePickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "#222",
    borderRadius: 8,
    marginBottom: 15,
    overflow: "hidden",
  },
  lightTimePickerContainer: {
    backgroundColor: "#ddd",
  },
  timePicker: {
    height: 200,
    width: "100%",
  },
  confirmButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  lightConfirmButtonText: {
    color: "#fff",
  },
  cloudBackupContainer: {
    marginBottom: 10,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingTop: 10,
  },
  lightCloudBackupContainer: {
    backgroundColor: "#ddd",
  },
  manageButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  lightManageButton: {
    backgroundColor: "#333",
  },
  manageButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "500",
  },
  lightManageButtonText: {
    color: "#fff",
  },
  // Add new styles for slider
  sliderContainer: {
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  speedValueLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    color: '#AAA',
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  lightSettingItem: {
    backgroundColor: "#DDDDDD",
  },
  settingContent: {
    flex: 1,
  },
  section: {
    marginBottom: 30,
  },
  setting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  settingText: {
    color: "#CCC",
    fontSize: 16,
  },
  settingDescription: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  dangerSetting: {
    borderColor: '#ff6347',
  },
  dangerText: {
    color: '#ff6347',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
  },
  warningSetting: {
    borderColor: '#FFA500',
  },
  warningText: {
    color: '#FFA500',
  },
  warningRow: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  dangerRow: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff6347',
  },
});

export default SettingsScreen;
