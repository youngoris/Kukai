import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
const AppContext = createContext();

// Create a custom hook for using the context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Default app settings
const defaultSettings = {
  theme: 'dark',
  meditationDuration: 10,
  focusDuration: 25,
  breakDuration: 5,
  soundTheme: 'rain',
  keepScreenAwake: true,
  notificationsEnabled: true
};

// Provider component
export const AppProvider = ({ children }) => {
  // State
  const [theme, setTheme] = useState(defaultSettings.theme);
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage
  useEffect(() => {
    loadSettings();
  }, []);

  // Load settings from AsyncStorage
  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('appSettings');
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(parsedSettings);
        setTheme(parsedSettings.theme);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setIsLoading(false);
    }
  };

  // Save settings to AsyncStorage
  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
      if (newSettings.theme !== theme) {
        setTheme(newSettings.theme);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Update a single setting
  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  };

  // Context value
  const value = {
    theme,
    settings,
    isLoading,
    updateSetting,
    saveSettings
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}; 