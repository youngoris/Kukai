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
import { MaterialIcons, Ionicons, Feather, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import CustomDateTimePicker from './components/CustomDateTimePicker';
import CloudBackupSection from './components/CloudBackupSection';
import JournalTemplateManager from './components/JournalTemplateManager';
import notificationService from './services/NotificationService';
import { AVAILABLE_TEMPLATES } from './constants/JournalTemplates';

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
  
  // 冥想设置
  const [meditationReminder, setMeditationReminder] = useState(false);
  const [meditationReminderTime, setMeditationReminderTime] = useState(new Date(new Date().setHours(8, 30, 0, 0)));
  
  // General Settings
  const [darkMode, setDarkMode] = useState(true);
  const [appTheme, setAppTheme] = useState('dark');
  const [fontSizeScale, setFontSizeScale] = useState('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  
  // UI States
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [currentTimePickerMode, setCurrentTimePickerMode] = useState('journalReminder'); // 'journalReminder' 或 'meditationReminder'
  const [tempSelectedTime, setTempSelectedTime] = useState(null); // 临时存储用户选择的时间
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
  const journalTemplates = AVAILABLE_TEMPLATES;
  
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
  
  // 添加新的通知设置状态
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [notificationSound, setNotificationSound] = useState('default');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(new Date().setHours(22, 0, 0, 0));
  const [quietHoursEnd, setQuietHoursEnd] = useState(new Date().setHours(7, 0, 0, 0));
  const [showQuietHoursStartPicker, setShowQuietHoursStartPicker] = useState(false);
  const [showQuietHoursEndPicker, setShowQuietHoursEndPicker] = useState(false);
  
  // Add state for template manager visibility
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  
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
    taskNotifications, notificationSound, quietHoursEnabled, quietHoursStart, quietHoursEnd,
    meditationReminder, meditationReminderTime
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
        
        // 冥想提醒设置
        meditationReminder,
        meditationReminderTime: meditationReminderTime.toISOString(),
        
        // General settings
        darkMode,
        appTheme,
        fontSizeScale,
        notificationsEnabled,
        syncEnabled,
        
        // 加载通知设置
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: quietHoursStart.toString(),
        quietHoursEnd: quietHoursEnd.toString(),
      };
      
      console.log('Auto-saving settings:', settings);
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      
      // 设置日志提醒通知（如果启用）
      if (journalReminder && notificationsEnabled) {
        await scheduleJournalReminder();
      } else {
        await notificationService.scheduleJournalReminder(0, 0, false);
      }
      
      // 设置冥想提醒通知（如果启用）
      if (meditationReminder && notificationsEnabled) {
        await scheduleMeditationReminder();
      } else {
        await notificationService.scheduleMeditationReminder(0, 0, false);
      }
      
      // 保存通知设置
      await AsyncStorage.setItem('taskNotifications', JSON.stringify(taskNotifications));
      await AsyncStorage.setItem('notificationSound', notificationSound);
      await AsyncStorage.setItem('quietHoursEnabled', JSON.stringify(quietHoursEnabled));
      await AsyncStorage.setItem('quietHoursStart', quietHoursStart.toString());
      await AsyncStorage.setItem('quietHoursEnd', quietHoursEnd.toString());
      
      // 更新通知服务配置
      await notificationService.updateConfig({
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: new Date(quietHoursStart),
        quietHoursEnd: new Date(quietHoursEnd)
      });
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
        
        // 加载冥想提醒设置
        setMeditationReminder(parsedSettings.meditationReminder || false);
        if (parsedSettings.meditationReminderTime) {
          setMeditationReminderTime(new Date(parsedSettings.meditationReminderTime));
        }
        
        // General settings
        setDarkMode(parsedSettings.darkMode !== false);
        setAppTheme(parsedSettings.appTheme || 'dark');
        setFontSizeScale(parsedSettings.fontSizeScale || 'medium');
        setNotificationsEnabled(parsedSettings.notificationsEnabled !== false);
        setSyncEnabled(parsedSettings.syncEnabled || false);
        
        // 加载通知设置
        const taskNotificationsValue = await AsyncStorage.getItem('taskNotifications');
        if (taskNotificationsValue !== null) {
          setTaskNotifications(JSON.parse(taskNotificationsValue));
        }
        
        const notificationSoundValue = await AsyncStorage.getItem('notificationSound');
        if (notificationSoundValue !== null) {
          setNotificationSound(notificationSoundValue);
        }
        
        const quietHoursEnabledValue = await AsyncStorage.getItem('quietHoursEnabled');
        if (quietHoursEnabledValue !== null) {
          setQuietHoursEnabled(JSON.parse(quietHoursEnabledValue));
        }
        
        const quietHoursStartValue = await AsyncStorage.getItem('quietHoursStart');
        if (quietHoursStartValue !== null) {
          setQuietHoursStart(parseInt(quietHoursStartValue));
        }
        
        const quietHoursEndValue = await AsyncStorage.getItem('quietHoursEnd');
        if (quietHoursEndValue !== null) {
          setQuietHoursEnd(parseInt(quietHoursEndValue));
        }
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
        
        // 冥想提醒设置
        meditationReminder,
        meditationReminderTime: meditationReminderTime.toISOString(),
        
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
        await notificationService.scheduleJournalReminder(0, 0, false);
      }
      
      // 设置冥想提醒通知（如果启用）
      if (meditationReminder && notificationsEnabled) {
        await scheduleMeditationReminder();
      } else {
        await notificationService.scheduleMeditationReminder(0, 0, false);
      }
      
      // 保存通知设置
      await AsyncStorage.setItem('taskNotifications', JSON.stringify(taskNotifications));
      await AsyncStorage.setItem('notificationSound', notificationSound);
      await AsyncStorage.setItem('quietHoursEnabled', JSON.stringify(quietHoursEnabled));
      await AsyncStorage.setItem('quietHoursStart', quietHoursStart.toString());
      await AsyncStorage.setItem('quietHoursEnd', quietHoursEnd.toString());
      
      // 更新通知服务配置
      await notificationService.updateConfig({
        taskNotifications,
        notificationSound,
        quietHoursEnabled,
        quietHoursStart: new Date(quietHoursStart),
        quietHoursEnd: new Date(quietHoursEnd)
      });
      
      // 延迟显示保存成功的提示，避免与可能的通知冲突
      setTimeout(() => {
        Alert.alert('设置已保存', '您的偏好设置已更新。');
      }, 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('错误', '无法保存设置。请重试。');
    }
  };
  
  const scheduleJournalReminder = async () => {
    try {
      if (journalReminder && notificationsEnabled) {
        const hours = journalReminderTime.getHours();
        const minutes = journalReminderTime.getMinutes();
        
        // 使用通知服务调度日志提醒
        await notificationService.scheduleJournalReminder(hours, minutes, true);
        console.log('Journal reminder scheduled for:', hours, ':', minutes);
      } else {
        // 如果禁用了提醒，取消调度
        await notificationService.scheduleJournalReminder(0, 0, false);
        console.log('Journal reminder disabled');
      }
    } catch (error) {
      console.error('Error scheduling journal reminder:', error);
    }
  };
  
  // 调度冥想提醒
  const scheduleMeditationReminder = async () => {
    try {
      if (meditationReminder && notificationsEnabled) {
        const hours = meditationReminderTime.getHours();
        const minutes = meditationReminderTime.getMinutes();
        
        // 使用通知服务调度冥想提醒
        await notificationService.scheduleMeditationReminder(hours, minutes, true);
        console.log('Meditation reminder scheduled for:', hours, ':', minutes);
      } else {
        // 如果禁用了提醒，取消调度
        await notificationService.scheduleMeditationReminder(0, 0, false);
        console.log('Meditation reminder disabled');
      }
    } catch (error) {
      console.error('Error scheduling meditation reminder:', error);
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
    // 确保options是一个数组
    if (!Array.isArray(options) || options.length === 0) {
      console.error('Error: options must be a non-empty array', options);
      Alert.alert('Error', 'An error occurred. Please try again later.');
      return;
    }
    
    // 确保setterFunction是一个函数
    if (typeof setterFunction !== 'function') {
      console.error('Error: setterFunction is not a function', setterFunction);
      Alert.alert('Error', 'An error occurred. Please try again later.');
      return;
    }
    
    // 确保title是一个字符串
    const modalTitle = typeof title === 'string' ? title : 'Select an option';
    
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
        case 'Notification Sound':
          return setNotificationSound;
        default:
          console.warn(`No setter found for label: ${label}`);
          // 返回一个空函数而不是null，避免类型错误
          return (val) => {
            console.warn(`Attempted to set value for unknown setting: ${label}`, val);
          };
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
      </View>
    </TouchableOpacity>
  );
  
  const renderActionButton = (onPress, label, icon, description = null, destructive = false) => (
    <TouchableOpacity 
      style={[styles.actionButton, destructive && styles.dangerButton]} 
      onPress={onPress}
    >
      <View style={styles.actionButtonContent}>
        <View style={styles.actionButtonTextContainer}>
          <Text style={[
            styles.actionButtonLabel, 
            appTheme === 'light' && styles.lightText,
            destructive && styles.dangerButtonText
          ]}>
            {label}
          </Text>
          {description && <Text style={styles.actionButtonDescription}>{description}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
  
  // 修改时间选择器处理函数
  const handleTimeChange = (event, selectedTime) => {
    if (selectedTime) {
      // 只更新临时状态，不立即应用
      setTempSelectedTime(selectedTime);
    }
  };
  
  // 添加确认时间的函数
  const confirmTimeSelection = () => {
    if (tempSelectedTime) {
      if (currentTimePickerMode === 'journalReminder') {
        setJournalReminderTime(tempSelectedTime);
      } else if (currentTimePickerMode === 'meditationReminder') {
        setMeditationReminderTime(tempSelectedTime);
      }
      setSettingsChanged(true);
    }
    setTimePickerVisible(false);
    setTempSelectedTime(null);
  };
  
  // 取消时间选择
  const cancelTimeSelection = () => {
    setTimePickerVisible(false);
    setTempSelectedTime(null);
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
  
  // 处理静音时段开始时间变更
  const handleQuietHoursStartChange = (event, selectedTime) => {
    setShowQuietHoursStartPicker(false);
    if (selectedTime) {
      setQuietHoursStart(selectedTime.getTime());
      autoSaveSettings();
    }
  };
  
  // 处理静音时段结束时间变更
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
    const selectedTemplate = journalTemplates.find(template => template.value === selectedJournalTemplate);
    const selectedLabel = selectedTemplate ? selectedTemplate.label : 'Default';
    
    return (
      <TouchableOpacity 
        style={styles.settingRow}
        onPress={openTemplateManager}
      >
        <View style={styles.settingLabelContainer}>
          <Text style={[styles.settingLabel, appTheme === 'light' && styles.lightText]}>Journal Template</Text>
          <Text style={styles.settingDescription}>Choose default template for new journal entries</Text>
        </View>
        <View style={styles.settingValueContainer}>
          <Text style={[styles.settingValue, appTheme === 'light' && styles.lightText]}>
            {selectedLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
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
          
          {renderSettingSwitch(
            meditationReminder,
            setMeditationReminder,
            'Meditation Reminder',
            'Set a daily reminder for your meditation practice'
          )}
          
          {meditationReminder && renderTimeSetting(
            meditationReminderTime,
            () => {
              setCurrentTimePickerMode('meditationReminder');
              setTimePickerVisible(true);
            },
            'Reminder Time',
            'Time to remind you for your daily meditation practice'
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
            () => {
              setCurrentTimePickerMode('journalReminder');
              setTimePickerVisible(true);
            },
            'Reminder Time',
            'Time to remind you to write in your journal daily'
          )}
          
          {/* Replace standard dropdown with custom journal template option */}
          {renderJournalTemplateOption()}
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
        </View>
        
        {/* 通知设置部分 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          
          {renderSettingSwitch(
            notificationsEnabled,
            (value) => {
              setNotificationsEnabled(value);
              autoSaveSettings();
            },
            'Enable Notifications',
            'Allow the app to send notification reminders'
          )}
          
          {notificationsEnabled && (
            <>
              {renderSettingSwitch(
                taskNotifications,
                (value) => {
                  setTaskNotifications(value);
                  autoSaveSettings();
                },
                'Task Reminders',
                'Remind you before tasks start'
              )}
              
              {renderSettingSwitch(
                focusNotifications,
                (value) => {
                  setFocusNotifications(value);
                  autoSaveSettings();
                },
                'Focus Mode Notifications',
                'Notify you when focus sessions end'
              )}
              
              {renderDropdownOption(
                notificationSound,
                [
                  { label: 'Default', value: 'default' },
                  { label: 'Gentle', value: 'gentle' },
                  { label: 'Alert', value: 'alert' },
                  { label: 'None', value: 'none' }
                ],
                'Notification Sound',
                'Choose notification alert sound'
              )}
              
              {renderSettingSwitch(
                quietHoursEnabled,
                (value) => {
                  setQuietHoursEnabled(value);
                  autoSaveSettings();
                },
                'Quiet Hours',
                'Disable notification sounds during specific hours'
              )}
              
              {quietHoursEnabled && (
                <>
                  {renderTimeSetting(
                    new Date(quietHoursStart),
                    () => setShowQuietHoursStartPicker(true),
                    'Quiet Hours Start',
                    'Set when quiet hours begin'
                  )}
                  
                  {renderTimeSetting(
                    new Date(quietHoursEnd),
                    () => setShowQuietHoursEndPicker(true),
                    'Quiet Hours End',
                    'Set when quiet hours end'
                  )}
                </>
              )}
            </>
          )}
        </View>
        
        {/* Data Management Section */}
        <View style={styles.settingSection}>
          <Text style={[styles.sectionTitle, appTheme === 'light' && styles.lightSectionTitle]}>Data Management</Text>
          
          {renderSettingSwitch(
            syncEnabled,
            setSyncEnabled,
            'Data Sync',
            'Sync your data across devices'
          )}
          
          {/* Cloud Backup */}
          {renderActionButton(
            () => {
              // Show the CloudBackupSection as a modal or navigate to a dedicated screen
              // For now, we'll just toggle the visibility of the CloudBackupSection
              setShowCloudBackup(!showCloudBackup);
            },
            'Cloud Backup',
            null,
            'Backup and sync your app data'
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
            '备份数据到本地文件 (推荐无Apple开发者账号用户使用)'
          )}
          
          {renderActionButton(
            importData,
            'Restore from Local',
            'restore',
            '从本地备份文件恢复数据'
          )}
          
          {/* Clear Data */}
          {renderActionButton(
            clearAllData,
            'Clear All Data',
            'delete',
            'Permanently delete all app data',
            true
          )}
        </View>
        
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
                    <MaterialIcons name="check" size={22} color="#FFFFFF" />
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
          onRequestClose={cancelTimeSelection}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Reminder Time</Text>
              <View style={styles.timePickerContainer}>
                <CustomDateTimePicker
                  value={tempSelectedTime || (currentTimePickerMode === 'journalReminder' ? journalReminderTime : meditationReminderTime)}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.timePicker}
                  textColor="#FFFFFF"
                  themeVariant="dark"
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelTimeSelection}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmTimeSelection}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
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
                <Text style={styles.confirmButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 静音时段开始时间选择器 */}
      {showQuietHoursStartPicker && (
        <CustomDateTimePicker
          value={new Date(quietHoursStart)}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleQuietHoursStartChange}
        />
      )}
      
      {/* 静音时段结束时间选择器 */}
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
    marginLeft: 0,
  },
  actionButtonLabel: {
    color: '#CCC',
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
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  confirmButton: {
    backgroundColor: '#FFFFFF',
    flex: 1,
    marginLeft: 10,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  timePickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
  },
  timePicker: {
    height: 200,
    width: '100%',
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  cloudBackupContainer: {
    // marginTop: 3,
    marginBottom: 10,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingTop: 10,
  },
  manageButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SettingsScreen; 