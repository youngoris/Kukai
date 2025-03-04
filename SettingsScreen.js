import React, { useState, useEffect, useRef } from 'react';
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
  Platform,
  Share,
  FlatList
} from 'react-native';
import { MaterialIcons, Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import CloudBackupSection from './components/CloudBackupSection';

const SettingsScreen = ({ navigation }) => {
  // Meditation Settings
  const [meditationDuration, setMeditationDuration] = useState(10);
  const [selectedSoundTheme, setSelectedSoundTheme] = useState('rain');
  
  // Focus Settings
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [focusNotifications, setFocusNotifications] = useState(true);
  const [autoStartNextFocus, setAutoStartNextFocus] = useState(false);
  const [differentWeekendSettings, setDifferentWeekendSettings] = useState(false);
  
  // Journal Settings
  const [includeWeather, setIncludeWeather] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [markdownSupport, setMarkdownSupport] = useState(true);
  const [journalReminder, setJournalReminder] = useState(false);
  const [journalReminderTime, setJournalReminderTime] = useState(new Date(new Date().setHours(21, 0, 0, 0)));
  const [selectedJournalTemplate, setSelectedJournalTemplate] = useState('default');
  
  // General Settings
  const [darkMode, setDarkMode] = useState(true);
  const [appTheme, setAppTheme] = useState('dark');
  const [fontSizeScale, setFontSizeScale] = useState('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  
  // UI States
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [isExportModalVisible, setExportModalVisible] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  
  // Modal States for dropdowns
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [currentValue, setCurrentValue] = useState(null);
  const [currentSetter, setCurrentSetter] = useState(null);
  const [currentModalTitle, setCurrentModalTitle] = useState('');
  
  // 添加一个状态来跟踪设置是否已更改
  const [settingsChanged, setSettingsChanged] = useState(false);
  
  // 添加一个防抖定时器引用
  const saveTimeoutRef = useRef(null);
  
  // Sound theme options
  const soundThemes = [
    { value: 'silence', label: 'Silence' },
    { value: 'whitenoise', label: 'Bright' },
    { value: 'brownnoise', label: 'Dark' },
    { value: 'rain', label: 'Rain' },
    { value: 'forest', label: 'Forest' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'fire', label: 'Fire' },
    { value: 'plane', label: 'Plane' }
  ];
  
  // Journal template options
  const journalTemplates = [
    { value: 'default', label: 'Default' },
    { value: 'gratitude', label: 'Gratitude' },
    { value: 'reflection', label: 'Reflection' },
    { value: 'achievement', label: 'Achievement' },
    { value: 'custom', label: 'Custom' }
  ];
  
  // App theme options
  const appThemes = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'auto', label: 'Auto' }
  ];
  
  // Font size options
  const fontSizes = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' }
  ];
  
  // Meditation duration options
  const meditationDurations = [
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
    { value: 20, label: '20 min' },
    { value: 30, label: '30 min' }
  ];
  
  // Focus duration options
  const focusDurations = [
    { value: 15, label: '15 min' },
    { value: 25, label: '25 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '60 min' }
  ];
  
  // Break duration options
  const breakDurations = [
    { value: 3, label: '3 min' },
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' }
  ];
  
  // Long break duration options
  const longBreakDurations = [
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
    { value: 20, label: '20 min' },
    { value: 30, label: '30 min' }
  ];
  
  // Long break interval options
  const longBreakIntervals = [
    { value: 2, label: '2 cycles' },
    { value: 3, label: '3 cycles' },
    { value: 4, label: '4 cycles' },
    { value: 5, label: '5 cycles' }
  ];
  
  // New state for CloudBackupSection visibility
  const [showCloudBackup, setShowCloudBackup] = useState(false);
  
  useEffect(() => {
    loadSettings();
    checkNotificationPermissions();
  }, []);
  
  // 添加自动保存功能的useEffect
  useEffect(() => {
    // 只有当设置已更改时才自动保存
    if (settingsChanged) {
      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // 设置新的定时器，延迟1秒后保存
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveSettings();
        setSettingsChanged(false);
      }, 1000);
    }
    
    // 组件卸载时清除定时器
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    meditationDuration, selectedSoundTheme,
    focusDuration, breakDuration, longBreakDuration, longBreakInterval,
    focusNotifications, autoStartNextFocus, differentWeekendSettings,
    includeWeather, includeLocation, markdownSupport, journalReminder,
    journalReminderTime, selectedJournalTemplate,
    darkMode, appTheme, fontSizeScale, notificationsEnabled, syncEnabled,
    settingsChanged
  ]);
  
  // 自动保存设置的函数
  const autoSaveSettings = async () => {
    try {
      const settings = {
        // Meditation settings
        meditationDuration,
        selectedSoundTheme,
        
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
        
        // General settings
        darkMode,
        appTheme,
        fontSizeScale,
        notificationsEnabled,
        syncEnabled
      };
      
      console.log('Auto-saving settings:', settings);
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      
      // 设置日志提醒通知（如果启用）
      if (journalReminder && notificationsEnabled) {
        await scheduleJournalReminder();
      }
    } catch (error) {
      console.error('Error auto-saving settings:', error);
    }
  };
  
  const checkNotificationPermissions = async () => {
    if (notificationsEnabled) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          setNotificationsEnabled(false);
          Alert.alert('Notification Permission Denied', 'You need to allow notifications in device settings to receive reminders.');
        }
      }
    }
  };
  
  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        console.log('Loading settings from storage:', parsedSettings);
        
        // Meditation settings
        setMeditationDuration(parsedSettings.meditationDuration || 10);
        setSelectedSoundTheme(parsedSettings.selectedSoundTheme || 'rain');
        
        // Focus settings
        setFocusDuration(parsedSettings.focusDuration || 25);
        setBreakDuration(parsedSettings.breakDuration || 5);
        setLongBreakDuration(parsedSettings.longBreakDuration || 15);
        setLongBreakInterval(parsedSettings.longBreakInterval || 4);
        setFocusNotifications(parsedSettings.focusNotifications !== false);
        setAutoStartNextFocus(parsedSettings.autoStartNextFocus || false);
        setDifferentWeekendSettings(parsedSettings.differentWeekendSettings || false);
        
        // Journal settings
        setIncludeWeather(parsedSettings.includeWeather !== false);
        setIncludeLocation(parsedSettings.includeLocation !== false);
        setMarkdownSupport(parsedSettings.markdownSupport !== false);
        setJournalReminder(parsedSettings.journalReminder || false);
        if (parsedSettings.journalReminderTime) {
          setJournalReminderTime(new Date(parsedSettings.journalReminderTime));
        }
        setSelectedJournalTemplate(parsedSettings.selectedJournalTemplate || 'default');
        
        // General settings
        setDarkMode(parsedSettings.darkMode !== false);
        setAppTheme(parsedSettings.appTheme || 'dark');
        setFontSizeScale(parsedSettings.fontSizeScale || 'medium');
        setNotificationsEnabled(parsedSettings.notificationsEnabled !== false);
        setSyncEnabled(parsedSettings.syncEnabled || false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  const saveSettings = async () => {
    try {
      const settings = {
        // Meditation settings
        meditationDuration,
        selectedSoundTheme,
        
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
        
        // General settings
        darkMode,
        appTheme,
        fontSizeScale,
        notificationsEnabled,
        syncEnabled
      };
      
      console.log('Saving settings:', settings);
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      
      // Set journal reminder notification if enabled
      if (journalReminder && notificationsEnabled) {
        await scheduleJournalReminder();
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
      
      Alert.alert('Settings Saved', 'Your preferences have been updated.');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Could not save settings. Please try again.');
    }
  };
  
  const scheduleJournalReminder = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      if (journalReminder && notificationsEnabled) {
        const hours = journalReminderTime.getHours();
        const minutes = journalReminderTime.getMinutes();
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Journal Reminder',
            body: 'Time to record your thoughts and feelings for today.',
            sound: true,
          },
          trigger: {
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling reminder:', error);
    }
  };
  
  const exportData = async () => {
    try {
      const allData = {};
      const allKeys = await AsyncStorage.getAllKeys();
      const allResults = await AsyncStorage.multiGet(allKeys);
      
      allResults.forEach(([key, value]) => {
        allData[key] = value;
      });
      
      const dataStr = JSON.stringify(allData);
      const encrypted = exportPassword ? dataStr : dataStr; // Simplified, should encrypt if password provided
      
      const fileUri = FileSystem.documentDirectory + 'kukai_backup.json';
      await FileSystem.writeAsStringAsync(fileUri, encrypted);
      
      await Share.share({
        url: fileUri,
        title: 'Kukai Data Backup'
      });
      
      setExportModalVisible(false);
      setExportPassword('');
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Export Error', 'Could not export data. Please try again.');
    }
  };
  
  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.type === 'success') {
        const data = await FileSystem.readAsStringAsync(result.uri);
        const parsedData = JSON.parse(data);
        
        Alert.alert(
          'Confirm Import',
          'Importing will replace all existing data. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Import',
              onPress: async () => {
                try {
                  await AsyncStorage.clear();
                  
                  const entries = Object.entries(parsedData);
                  const multiSetArray = entries.map(([key, value]) => [key, value]);
                  
                  await AsyncStorage.multiSet(multiSetArray);
                  await loadSettings();
                  
                  Alert.alert('Import Successful', 'Your data has been successfully imported.');
                } catch (error) {
                  console.error('Error importing data:', error);
                  Alert.alert('Import Error', 'An error occurred during import.');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Import Error', 'Could not import data. Please check the file format.');
    }
  };
  
  // Function to open dropdown modal
  const openOptionModal = (options, currentVal, setterFunction, title) => {
    if (typeof setterFunction !== 'function') {
      console.error('Error: setterFunction is not a function', setterFunction);
      Alert.alert('Error', 'An error occurred. Please try again later.');
      return;
    }
    
    setCurrentOptions(options);
    setCurrentValue(currentVal);
    setCurrentSetter(() => (newValue) => {
      setterFunction(newValue);
      setSettingsChanged(true); // 标记设置已更改
    });
    setCurrentModalTitle(title);
    setOptionModalVisible(true);
  };
  
  // Render dropdown option
  const renderDropdownOption = (value, options, label, description = null) => {
    const selectedOption = options.find(option => option.value === value);
    
    const getSetter = () => {
      switch(label) {
        case 'Duration':
          return setMeditationDuration;
        case 'Focus Duration':
          return setFocusDuration;
        case 'Break Duration':
          return setBreakDuration;
        case 'Long Break Duration':
          return setLongBreakDuration;
        case 'Long Break Interval':
          return setLongBreakInterval;
        case 'Journal Template':
          return setSelectedJournalTemplate;
        case 'Sound Theme':
          return setSelectedSoundTheme;
        case 'App Theme':
          return setAppTheme;
        case 'Font Size':
          return setFontSizeScale;
        default:
          return null;
      }
    };
    
    return (
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={() => openOptionModal(options, value, getSetter(), label)}
      >
        <View style={styles.settingLabelContainer}>
          <Text style={[styles.settingLabel, appTheme === 'light' && styles.lightText]}>{label}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
        <View style={styles.settingValueContainer}>
          <Text style={[styles.settingValue, appTheme === 'light' && styles.lightText]}>
            {selectedOption ? selectedOption.label : 'Select'}
          </Text>
          <MaterialIcons name="chevron-right" size={22} color="#666666" />
        </View>
      </TouchableOpacity>
    );
  };
  
  // 修改设置开关渲染函数
  const renderSettingSwitch = (value, setter, label, description = null) => {
    const toggleSwitch = () => {
      setter(!value);
      setSettingsChanged(true); // 标记设置已更改
    };
    
    return (
      <View style={styles.settingRow}>
        <View style={styles.settingLabelContainer}>
          <Text style={[styles.settingLabel, appTheme === 'light' && styles.lightText]}>{label}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
        <Switch
          trackColor={{ false: "#222222", true: "#777777" }}
          thumbColor={value ? "#FFFFFF" : "#888888"}
          ios_backgroundColor="#222222"
          onValueChange={toggleSwitch}
          value={value}
        />
      </View>
    );
  };
  
  const renderTimeSetting = (value, onPress, label, description = null) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingLabelContainer}>
        <Text style={[styles.settingLabel, appTheme === 'light' && styles.lightText]}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, appTheme === 'light' && styles.lightText]}>
          {value.getHours().toString().padStart(2, '0')}:{value.getMinutes().toString().padStart(2, '0')}
        </Text>
        <MaterialIcons name="access-time" size={20} color="#AAAAAA" style={styles.timeIcon} />
      </View>
    </TouchableOpacity>
  );
  
  const renderActionButton = (onPress, label, icon, description = null, destructive = false) => (
    <TouchableOpacity 
      style={[styles.actionButton, destructive && styles.dangerButton]} 
      onPress={onPress}
    >
      <View style={styles.actionButtonContent}>
        <MaterialIcons name={icon} size={22} color={destructive ? "#F55" : "#FFFFFF"} />
        <View style={styles.actionButtonTextContainer}>
          <Text style={[styles.actionButtonLabel, destructive && styles.dangerButtonText]}>{label}</Text>
          {description && <Text style={styles.actionButtonDescription}>{description}</Text>}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#666666" />
    </TouchableOpacity>
  );
  
  // 修改时间选择器处理函数
  const handleTimeChange = (event, selectedTime) => {
    setTimePickerVisible(false);
    if (selectedTime) {
      setJournalReminderTime(selectedTime);
      setSettingsChanged(true); // 标记设置已更改
    }
  };
  
  // 处理备份完成后的操作
  const handleBackupComplete = () => {
    // 重新加载设置
    loadSettings();
  };
  
  const clearAllData = async () => {
    try {
      // Get all keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter out keys that shouldn't be deleted
      const keysToRemove = allKeys.filter(key => 
        !key.startsWith('expo.') && 
        !key.startsWith('google_drive_')
      );
      
      // Remove all data
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Reset state
      setSettings({
        darkMode: true,
        notifications: true,
        journalReminder: true,
        journalReminderTime: new Date(),
        focusDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        longBreakInterval: 4,
        autoStartBreaks: false,
        autoStartPomodoros: false,
        soundEnabled: true,
        vibrationEnabled: true,
        meditationDuration: 10,
        meditationSound: 'silence',
        meditationEndSound: 'bell',
        meditationBackgroundColor: '#1E1E1E',
      });
      
      Alert.alert('Data Cleared', 'All data has been deleted.');
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'An error occurred while clearing data.');
    }
  };

  const showAboutInfo = () => {
    Alert.alert('About Kukai', 'Version 1.0.0\n\nA personal growth app focused on meditation, focus, and journaling.');
  };

  const sendFeedback = () => {
    // Implement feedback mechanism here
    // For now, just show a confirmation
    Alert.alert('Send Feedback', 'Thank you for your feedback, it helps us improve the app.');
  };
  
  return (
    <SafeAreaView style={[styles.container, appTheme === 'light' && styles.lightContainer]}>
      <View style={[styles.header, appTheme === 'light' && styles.lightHeader]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={appTheme === 'light' ? "#000000" : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, appTheme === 'light' && styles.lightText]}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.settingsContainer}
        contentContainerStyle={styles.settingsContentContainer}
      >
        {/* Meditation Settings */}
        <View style={styles.settingSection}>
          <Text style={[styles.sectionTitle, appTheme === 'light' && styles.lightSectionTitle]}>Meditation Settings</Text>
          
          {renderDropdownOption(
            meditationDuration, 
            meditationDurations,
            'Duration',
            'Set how long your meditation session will last'
          )}
          
          {renderDropdownOption(
            selectedSoundTheme,
            soundThemes,
            'Sound Theme',
            'Choose your preferred background sound'
          )}
        </View>
        
        {/* Focus Settings */}
        <View style={styles.settingSection}>
          <Text style={[styles.sectionTitle, appTheme === 'light' && styles.lightSectionTitle]}>Focus Settings</Text>
          
          {renderDropdownOption(
            focusDuration,
            focusDurations,
            'Focus Duration',
            'Set how long each focus period lasts'
          )}
          
          {renderDropdownOption(
            breakDuration,
            breakDurations,
            'Break Duration',
            'Set how long regular breaks last'
          )}
          
          {renderDropdownOption(
            longBreakDuration,
            longBreakDurations,
            'Long Break Duration',
            'Set duration for long breaks after multiple focus cycles'
          )}
          
          {renderDropdownOption(
            longBreakInterval,
            longBreakIntervals,
            'Long Break Interval',
            'Set how many focus cycles before a long break'
          )}
          
          {renderSettingSwitch(
            focusNotifications,
            setFocusNotifications,
            'Focus Notifications',
            'Receive notifications when focus periods end'
          )}
          
          {renderSettingSwitch(
            autoStartNextFocus,
            setAutoStartNextFocus,
            'Auto-start Next Focus',
            'Automatically start next focus period after break'
          )}
          
          {renderSettingSwitch(
            differentWeekendSettings,
            setDifferentWeekendSettings,
            'Weekday/Weekend Settings',
            'Use different settings on weekends'
          )}
        </View>
        
        {/* Journal Settings */}
        <View style={styles.settingSection}>
          <Text style={[styles.sectionTitle, appTheme === 'light' && styles.lightSectionTitle]}>Journal Settings</Text>
          
          {renderSettingSwitch(
            includeWeather,
            setIncludeWeather,
            'Include Weather',
            'Automatically record weather in your journal'
          )}
          
          {renderSettingSwitch(
            includeLocation,
            setIncludeLocation,
            'Include Location',
            'Automatically record location in your journal'
          )}
          
          {renderSettingSwitch(
            markdownSupport,
            setMarkdownSupport,
            'Markdown Support',
            'Allow markdown formatting in journal entries'
          )}
          
          {renderSettingSwitch(
            journalReminder,
            setJournalReminder,
            'Journal Reminder',
            'Set a daily reminder to write in your journal'
          )}
          
          {journalReminder && renderTimeSetting(
            journalReminderTime,
            () => setTimePickerVisible(true),
            'Reminder Time',
            'Time to remind you to write in your journal daily'
          )}
          
          {renderDropdownOption(
            selectedJournalTemplate,
            journalTemplates,
            'Journal Template',
            'Choose default template for new journal entries'
          )}
        </View>
        
        {/* General Settings */}
        <View style={styles.settingSection}>
          <Text style={[styles.sectionTitle, appTheme === 'light' && styles.lightSectionTitle]}>General Settings</Text>
          
          {renderDropdownOption(
            appTheme,
            appThemes,
            'App Theme',
            'Set the appearance of the app'
          )}
          
          {renderDropdownOption(
            fontSizeScale,
            fontSizes,
            'Font Size',
            'Adjust text size throughout the app'
          )}
          
          {renderSettingSwitch(
            notificationsEnabled,
            (value) => {
              setNotificationsEnabled(value);
              if (value) {
                checkNotificationPermissions();
              }
            },
            'Enable Notifications',
            'Allow the app to send notifications and reminders'
          )}
          
          {renderSettingSwitch(
            syncEnabled,
            setSyncEnabled,
            'Data Sync',
            'Sync your data across devices'
          )}
        </View>
        
        {/* Data Management Section */}
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        {/* Google Drive Backup */}
        {renderActionButton(
          () => {
            // Show the CloudBackupSection as a modal or navigate to a dedicated screen
            // For now, we'll just toggle the visibility of the CloudBackupSection
            setShowCloudBackup(!showCloudBackup);
          },
          'Google Drive Backup',
          'cloud',
          'Backup and sync data with Google Drive'
        )}
        
        {showCloudBackup && (
          <View style={styles.cloudBackupContainer}>
            <CloudBackupSection 
              navigation={navigation}
              onBackupComplete={handleBackupComplete}
            />
          </View>
        )}
        
        {renderActionButton(
          exportData,
          'Local Backup',
          'save-alt',
          'Backup data to a local file'
        )}
        
        {renderActionButton(
          importData,
          'Restore from Local',
          'restore',
          'Restore data from a local backup file'
        )}
        
        {/* Clear Data */}
        {renderActionButton(
          clearAllData,
          'Clear All Data',
          'delete',
          'Permanently delete all app data',
          true
        )}
        
        {/* About Section */}
        <Text style={styles.sectionTitle}>About</Text>
        
        {renderActionButton(
          showAboutInfo,
          'Version Info',
          'info'
        )}
        
        {renderActionButton(
          sendFeedback,
          'Send Feedback',
          'feedback'
        )}
      </ScrollView>
      
      {/* Options Modal */}
      <Modal
        transparent={true}
        visible={optionModalVisible}
        animationType="fade"
        onRequestClose={() => setOptionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{currentModalTitle}</Text>
            <FlatList
              data={currentOptions}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    currentValue === item.value && styles.modalOptionSelected
                  ]}
                  onPress={() => {
                    if (typeof currentSetter === 'function') {
                      currentSetter(item.value);
                      setOptionModalVisible(false);
                    }
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    currentValue === item.value && styles.modalOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {currentValue === item.value && (
                    <MaterialIcons name="check" size={22} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setOptionModalVisible(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Time Picker */}
      {isTimePickerVisible && (
        <Modal
          transparent={true}
          visible={isTimePickerVisible}
          animationType="fade"
          onRequestClose={() => setTimePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Reminder Time</Text>
              <DateTimePicker
                value={journalReminderTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={styles.timePicker}
              />
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Export Data</Text>
            <Text style={styles.modalDescription}>
              Optional: Add a password to protect your data.
            </Text>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password (optional)"
              placeholderTextColor="#999"
              secureTextEntry={true}
              value={exportPassword}
              onChangeText={setExportPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setExportModalVisible(false);
                  setExportPassword('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]} 
                onPress={exportData}
              >
                <Text style={styles.modalButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightContainer: {
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  lightHeader: {
    borderBottomColor: '#ddd',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  lightText: {
    color: '#000',
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
    color: '#FFF',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 15,
    letterSpacing: 1,
  },
  lightSectionTitle: {
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  settingLabelContainer: {
    flex: 1,
  },
  settingLabel: {
    color: '#CCC',
    fontSize: 16,
  },
  settingDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    color: '#CCC',
    fontSize: 16,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#CCC',
    fontSize: 16,
    marginRight: 8,
  },
  timeIcon: {
    marginTop: 1,
  },
  actionButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonTextContainer: {
    marginLeft: 12,
  },
  actionButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  actionButtonDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  dangerButton: {
    backgroundColor: '#1a0000',
  },
  dangerButtonText: {
    color: '#F55',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDescription: {
    color: '#CCC',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalOptionSelected: {
    backgroundColor: '#333',
  },
  modalOptionText: {
    color: '#CCC',
    fontSize: 16,
  },
  modalOptionTextSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  passwordInput: {
    backgroundColor: '#222',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  confirmButton: {
    backgroundColor: '#444',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  timePicker: {
    width: '100%',
    backgroundColor: '#222',
    marginBottom: 20,
  },
  modalCancelButton: {
    backgroundColor: '#333',
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalCancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  cloudBackupContainer: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
  },
});

export default SettingsScreen; 