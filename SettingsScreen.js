import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = ({ navigation }) => {
  // 冥想设置
  const [meditationDuration, setMeditationDuration] = useState(10);
  const [meditationSounds, setMeditationSounds] = useState(true);
  
  // 专注设置
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [focusNotifications, setFocusNotifications] = useState(true);
  
  // 日志设置
  const [includeWeather, setIncludeWeather] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [markdownSupport, setMarkdownSupport] = useState(true);
  
  // 通用设置
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('appSettings');
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        
        // 加载各项设置
        setMeditationDuration(parsedSettings.meditationDuration || 10);
        setMeditationSounds(parsedSettings.meditationSounds !== false);
        
        setFocusDuration(parsedSettings.focusDuration || 25);
        setBreakDuration(parsedSettings.breakDuration || 5);
        setFocusNotifications(parsedSettings.focusNotifications !== false);
        
        setIncludeWeather(parsedSettings.includeWeather !== false);
        setIncludeLocation(parsedSettings.includeLocation !== false);
        setMarkdownSupport(parsedSettings.markdownSupport !== false);
        
        setDarkMode(parsedSettings.darkMode !== false);
        setNotificationsEnabled(parsedSettings.notificationsEnabled !== false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  const saveSettings = async () => {
    try {
      const settings = {
        meditationDuration,
        meditationSounds,
        focusDuration,
        breakDuration,
        focusNotifications,
        includeWeather,
        includeLocation,
        markdownSupport,
        darkMode,
        notificationsEnabled
      };
      
      await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
      Alert.alert('Settings saved', 'Your preferences have been updated.');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };
  
  const renderSettingSwitch = (value, onValueChange, label) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#3e3e3e', true: '#5A5A5A' }}
        thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
      />
    </View>
  );
  
  const renderSettingOption = (value, options, onSelect, label) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.optionsContainer}>
        {options.map(option => (
          <TouchableOpacity 
            key={option.value}
            style={[
              styles.optionButton,
              value === option.value && styles.selectedOption
            ]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={[
              styles.optionText,
              value === option.value && styles.selectedOptionText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={saveSettings}
        >
          <MaterialIcons name="check" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.settingsContainer}>
        {/* 冥想设置 */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Meditation</Text>
          
          {renderSettingOption(
            meditationDuration,
            [
              { value: 5, label: '5 min' },
              { value: 10, label: '10 min' },
              { value: 15, label: '15 min' },
              { value: 20, label: '20 min' }
            ],
            setMeditationDuration,
            'Default Duration'
          )}
          
          {renderSettingSwitch(
            meditationSounds,
            setMeditationSounds,
            'Background Sounds'
          )}
        </View>
        
        {/* 专注设置 */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Focus</Text>
          
          {renderSettingOption(
            focusDuration,
            [
              { value: 15, label: '15 min' },
              { value: 25, label: '25 min' },
              { value: 30, label: '30 min' },
              { value: 45, label: '45 min' }
            ],
            setFocusDuration,
            'Focus Duration'
          )}
          
          {renderSettingOption(
            breakDuration,
            [
              { value: 3, label: '3 min' },
              { value: 5, label: '5 min' },
              { value: 10, label: '10 min' },
              { value: 15, label: '15 min' }
            ],
            setBreakDuration,
            'Break Duration'
          )}
          
          {renderSettingSwitch(
            focusNotifications,
            setFocusNotifications,
            'Notifications'
          )}
        </View>
        
        {/* 日志设置 */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Journal</Text>
          
          {renderSettingSwitch(
            includeWeather,
            setIncludeWeather,
            'Include Weather'
          )}
          
          {renderSettingSwitch(
            includeLocation,
            setIncludeLocation,
            'Include Location'
          )}
          
          {renderSettingSwitch(
            markdownSupport,
            setMarkdownSupport,
            'Markdown Support'
          )}
        </View>
        
        {/* 通用设置 */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>General</Text>
          
          {renderSettingSwitch(
            notificationsEnabled,
            setNotificationsEnabled,
            'Enable Notifications'
          )}
          
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={() => {
              Alert.alert(
                'Clear All Data',
                'Are you sure you want to clear all your data? This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Clear Data', 
                    style: 'destructive',
                    onPress: () => {
                      // 实现清除所有数据的逻辑
                      Alert.alert('Data Cleared', 'All your data has been removed.');
                    }
                  }
                ]
              );
            }}
          >
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 5,
  },
  settingsContainer: {
    flex: 1,
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  settingLabel: {
    color: '#CCC',
    fontSize: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    backgroundColor: '#222',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 8,
  },
  selectedOption: {
    backgroundColor: '#FFF',
  },
  optionText: {
    color: '#CCC',
    fontSize: 14,
  },
  selectedOptionText: {
    color: '#000',
  },
  dangerButton: {
    backgroundColor: '#300',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  dangerButtonText: {
    color: '#F55',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SettingsScreen; 