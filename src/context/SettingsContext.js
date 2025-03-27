/**
 * SettingsContext.js
 * Manages application settings using Context API + useReducer pattern
 * Integrates with SQLite data persistence layer
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import storageService from '../services/StorageService';
import { getSettingsWithDefaults } from '../utils/defaultSettings';

// Action types
const ACTIONS = {
  INITIALIZE_SETTINGS: 'INITIALIZE_SETTINGS',
  UPDATE_SETTING: 'UPDATE_SETTING',
  UPDATE_MULTIPLE_SETTINGS: 'UPDATE_MULTIPLE_SETTINGS',
  RESET_SETTINGS: 'RESET_SETTINGS',
};

// Initial state - will be replaced by loaded settings
const initialState = {
  isLoading: true,
  isInitialized: false,
  error: null,
  data: null,
};

// Reducer function
const settingsReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INITIALIZE_SETTINGS:
      return {
        ...state,
        isLoading: false,
        isInitialized: true,
        error: null,
        data: action.payload,
      };
    case ACTIONS.UPDATE_SETTING:
      return {
        ...state,
        data: {
          ...state.data,
          [action.payload.key]: action.payload.value,
        },
      };
    case ACTIONS.UPDATE_MULTIPLE_SETTINGS:
      return {
        ...state,
        data: {
          ...state.data,
          ...action.payload,
        },
      };
    case ACTIONS.RESET_SETTINGS:
      return {
        ...state,
        data: action.payload,
      };
    default:
      return state;
  }
};

// Create context
const SettingsContext = createContext(null);

// Provider component
export const SettingsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults();
        dispatch({ type: ACTIONS.INITIALIZE_SETTINGS, payload: settings });
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async (key, value) => {
    if (!state.isInitialized) return;

    try {
      // Update state
      dispatch({ type: ACTIONS.UPDATE_SETTING, payload: { key, value } });

      // Persist to storage
      const updatedSettings = { ...state.data, [key]: value };
      await storageService.setItem('userSettings', updatedSettings);
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
    }
  }, [state.isInitialized, state.data]);

  // Update multiple settings at once
  const updateSettings = useCallback(async (newSettings) => {
    if (!state.isInitialized) return;

    try {
      // Update state
      dispatch({ type: ACTIONS.UPDATE_MULTIPLE_SETTINGS, payload: newSettings });

      // Persist to storage
      const updatedSettings = { ...state.data, ...newSettings };
      await storageService.setItem('userSettings', updatedSettings);
    } catch (error) {
      console.error('Failed to update multiple settings:', error);
    }
  }, [state.isInitialized, state.data]);

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      const defaultSettings = await getSettingsWithDefaults();
      
      // Update state
      dispatch({ type: ACTIONS.RESET_SETTINGS, payload: defaultSettings });
      
      // Persist to storage
      await storageService.setItem('userSettings', defaultSettings);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    settings: state.data,
    updateSetting,
    updateSettings,
    resetSettings,
  }), [
    state.isLoading,
    state.isInitialized,
    state.data,
    updateSetting,
    updateSettings,
    resetSettings
  ]);

  // Don't render children until settings are loaded
  if (state.isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook for using the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Export action types for testing
export const SETTINGS_ACTIONS = ACTIONS; 