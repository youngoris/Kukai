/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Vibration,
  AppState,
  Modal,
  Pressable,
  Platform,
  BackHandler,
  Alert,
  StatusBar as RNStatusBar,
  Animated,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Progress from "react-native-progress";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import storageService from "../services/storage/StorageService";
import { useFocusEffect } from "@react-navigation/native";
import notificationService from "../services/NotificationService";
import SafeHeader from "../components/SafeHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { withErrorHandling, withRetry } from "../utils/errorHandlingUtils";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define focus and break times (in seconds)
const FOCUS_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 1 * 60; // 5 minutes

export default function FocusScreen({ navigation }) {
  // State variables
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasStartedBefore, setHasStartedBefore] = useState(false);
  const [appTheme, setAppTheme] = useState('dark');
  const [keepScreenAwake, setKeepScreenAwake] = useState(true);
  const [focusSound, setFocusSound] = useState(null);
  const [breakSound, setBreakSound] = useState(null);

  // Focus settings
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [focusNotifications, setFocusNotifications] = useState(true);
  const [autoStartNextFocus, setAutoStartNextFocus] = useState(false);

  // Define isLightTheme based on appTheme
  const isLightTheme = appTheme === 'light';

  // Reference variables
  const timer = useRef(null);
  const sessionStartTime = useRef(null);
  const appState = useRef(AppState.currentState);
  const iconAnimation = useRef(new Animated.Value(1)).current;

  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Load user settings including theme
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults();
        if (settings.appTheme) {
          setAppTheme(settings.appTheme);
        }
        
        // Load keep screen awake setting
        if (settings.keepScreenAwake !== undefined) {
          setKeepScreenAwake(settings.keepScreenAwake);
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  // Load completion sounds
  useEffect(() => {
    // Set audio mode for playing sounds even when device is in silent mode
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error('Error setting audio mode:', error);
      }
    };
    
    const loadSounds = async () => {
      try {
        // Load focus completion sound
        const { sound: completeFocusSound } = await Audio.Sound.createAsync(
          {
            uri: "https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3",
          },
          { volume: 0.7 }
        );
        setFocusSound(completeFocusSound);
        
        // Load break completion sound
        const { sound: completeBreakSound } = await Audio.Sound.createAsync(
          {
            uri: "https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3",
          },
          { volume: 0.7 }
        );
        setBreakSound(completeBreakSound);
        
        console.log("Focus and break completion sounds loaded successfully");
      } catch (error) {
        console.error("Unable to preload sound effects:", error);
      }
    };
    
    setupAudio();
    loadSounds();
    
    // Clean up sounds on unmount
    return () => {
      if (focusSound) {
        focusSound.unloadAsync();
      }
      if (breakSound) {
        breakSound.unloadAsync();
      }
    };
  }, []);

  // Load focus settings when screen gets focus
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useFocusEffect(
    useCallback(() => {
      const loadFocusSettings = async () => {
        // Skip initial load since it's already handled by initializeSession
        if (!hasInitialized) {
          setHasInitialized(true);
          return;
        }
        
        try {
          console.log('Screen regained focus, checking for setting changes');
          
          // Load the latest user settings
          const userSettings = await getSettingsWithDefaults();
          
          // Check if we have an active session
          if (hasStartedBefore) {
            console.log('Active session detected, preserving session progress');
            // If session already started, only update notifications settings
            setFocusNotifications(
              userSettings.focusNotifications !== undefined
                ? userSettings.focusNotifications
                : true
            );
            setAutoStartNextFocus(userSettings.autoStartNextFocus || false);
          } else {
            console.log('No active session, updating all focus settings');
            // No active session, so update all settings
            setFocusDuration(userSettings.focusDuration || 25);
            setBreakDuration(userSettings.breakDuration || 5);
            setLongBreakDuration(userSettings.longBreakDuration || 15);
            setLongBreakInterval(userSettings.longBreakInterval || 4);
            setFocusNotifications(
              userSettings.focusNotifications !== undefined
                ? userSettings.focusNotifications
                : true
            );
            setAutoStartNextFocus(userSettings.autoStartNextFocus || false);
            
            // Update timer display
            setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
          }
        } catch (error) {
          console.error("Error loading focus settings:", error);
        }
      };
      
      loadFocusSettings();
      
      return () => {
        // We no longer automatically save session state when the screen loses focus
        // Session state is now only saved when the user clicks pause
      };
    }, [hasStartedBefore, hasInitialized])
  );

  // Initialize notification permissions and app state listener
  useEffect(() => {
    const registerForNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status === "granted");
    };
    registerForNotifications();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // When app goes to background, save the current session state
      if (appState.current === "active" && nextAppState.match(/inactive|background/)) {
        saveSessionState();
        
        // If countdown is about to end (less than 5 seconds) and app goes to background, send notification
        if (isActive && timeRemaining <= 5 && timeRemaining > 0) {
          // Schedule a notification to trigger after the remaining seconds
          setTimeout(() => {
            if (AppState.currentState.match(/inactive|background/)) {
              triggerNotification();
            }
          }, timeRemaining * 1000);
        }
      }
      
      // When app comes to foreground and session is active, update timer
      if (appState.current.match(/inactive|background/) && 
          nextAppState === "active" && 
          isActive) {
        handleAppForeground();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isActive, timeRemaining]);

  // Handle logic when app returns to foreground
  const handleAppForeground = () => {
    if (!sessionStartTime.current) return;
    const now = new Date();
    const elapsedSeconds = Math.floor((now - sessionStartTime.current) / 1000);
    const totalTime = isBreak ? breakDuration * 60 : focusDuration * 60;
    if (elapsedSeconds >= totalTime) {
      if (!isBreak) handleFocusComplete();
      else handleBreakComplete();
    } else {
      setTimeRemaining(totalTime - elapsedSeconds);
      setProgress(1 - (totalTime - elapsedSeconds) / totalTime);
    }
  };

  // Timer logic
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      timer.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          const totalTime = isBreak ? breakDuration * 60 : focusDuration * 60;
          setProgress(1 - newTime / totalTime);
          return newTime;
        });
      }, 1000);
    } else if (isActive && timeRemaining <= 0) {
      clearInterval(timer.current);
      
      // only trigger notification when app is in background
      const isAppInBackground = appState.current.match(/inactive|background/);
      if (isAppInBackground && focusNotifications && notificationPermission) {
        triggerNotification();
      }
      
      if (!isBreak) handleFocusComplete();
      else handleBreakComplete();
    }
    return () => clearInterval(timer.current);
  }, [
    isActive,
    timeRemaining,
    isBreak,
    notificationPermission,
    focusNotifications,
    focusDuration,
    breakDuration,
  ]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Toggle timer state
  const toggleTimer = () => {
    if (!isActive) {
      if (!hasStartedBefore) {
        setShowConfirmation(true);
      } else {
        resumeFocusSession();
      }
    } else {
      setIsActive(false);
      clearInterval(timer.current);
      // Save session state when user clicks pause button
      saveSessionState();
    }
  };

  // Start focus session
  const startFocusSession = () => {
    setIsActive(true);
    const currentSessionTime = isBreak
      ? breakDuration * 60
      : focusDuration * 60;
    setTimeRemaining(currentSessionTime);
    sessionStartTime.current = new Date();
    setHasStartedBefore(true);
    
    // Screen will be kept awake by the useEffect hook if setting is enabled
  };

  // Resume focus session
  const resumeFocusSession = () => {
    setIsActive(true);
    const totalTime = isBreak ? breakDuration * 60 : focusDuration * 60;
    const elapsedTime = totalTime - timeRemaining;
    const now = new Date();
    sessionStartTime.current = new Date(now.getTime() - elapsedTime * 1000);
  };

  // Confirm and start focus mode
  const confirmFocusMode = () => {
    setShowConfirmation(false);
    startFocusSession();
  };

  // Cancel focus mode
  const cancelFocusMode = () => {
    setShowConfirmation(false);
  };

  // Load today's pomodoro count from history
  const loadTodayPomodoroCount = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const historyString = await storageService.getItem("focusHistory");
      
      if (historyString) {
        const history = JSON.parse(historyString);
        // Filter today's sessions (non-break sessions)
        const todaySessions = history.filter(
          (session) => 
            session.date.split('T')[0] === today && 
            !session.isBreak
        );
        
        // Update pomodoro count with today's sessions count
        setPomodoroCount(todaySessions.length);
      } else {
        setPomodoroCount(0);
      }
    } catch (error) {
      console.error("Error loading today's pomodoro count:", error);
      setPomodoroCount(0);
    }
  };

  // Refresh pomodoro count whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTodayPomodoroCount();
    }, [])
  );

  // Call loadTodayPomodoroCount after a new session is saved
  const handleFocusComplete = async () => {
    // Clear timer
    clearInterval(timer.current);
    
    // Update state
    setIsActive(false);
    
    // Play completion sound if app is in foreground
    playCompletionSound();
    
    // Vibrate device
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Save session state when focus session completes
    await saveSessionState();
    
    // Show choice or auto-start break
    if (autoStartNextFocus) {
      startBreak();
    } else {
      setShowChoice(true);
    }
    
    // Save session data
    try {
      // Get existing history
      const historyString = await storageService.getItem("focusHistory");
      let history = historyString ? JSON.parse(historyString) : [];
      
      // Add new session
      const newSession = {
        date: new Date().toISOString(),
        duration: focusDuration,
        isBreak: false,
      };
      
      history.push(newSession);
      
      // Save updated history
      await storageService.setItem("focusHistory", JSON.stringify(history));
      
      // Reload today's pomodoro count
      loadTodayPomodoroCount();
    } catch (error) {
      console.error("Error saving focus history:", error);
    }
  };

  // Handle break time completion
  const handleBreakComplete = () => {
    // Clear timer
    clearInterval(timer.current);
    
    // Update state
    setIsActive(false);
    
    // Keep break state true to show correct completion screen
    // Do not reset break state here
    
    // Play break completion sound if app is in foreground
    playCompletionSound();
    
    // Vibrate device
    Vibration.vibrate(500);
    
    // Show choice or auto-start focus
    if (autoStartNextFocus) {
      setTimeout(() => {
        // Reset break state before starting next focus
        setIsBreak(false);
        setTimeRemaining(focusDuration * 60);
        setProgress(0);
        setIsActive(true);
        sessionStartTime.current = new Date();
        setHasStartedBefore(false);
      }, 1500);
    } else {
      // Show break complete screen
      setShowChoice(true);
    }
  };

  // Start break
  const startBreak = () => {
    setShowChoice(false);
    setIsBreak(true);

    // Check if it's time for a long break
    let currentBreakDuration = breakDuration;
    if (pomodoroCount > 0 && pomodoroCount % longBreakInterval === 0) {
      currentBreakDuration = longBreakDuration;
    }

    setTimeRemaining(currentBreakDuration * 60);
    setProgress(0);
    setIsActive(true);
    sessionStartTime.current = new Date();
  };

  // Start next focus session
  const startNextFocus = () => {
    setShowChoice(false);
    setIsBreak(false);
    setTimeRemaining(focusDuration * 60);
    setProgress(0);
    setIsActive(true);
    sessionStartTime.current = new Date();
  };

  // Trigger notification
  const triggerNotification = async () => {
    // Only send notification if user has enabled focus notifications
    if (!focusNotifications) {
      console.log('Focus notifications disabled, skipping notification');
      return;
    }

    console.log('Triggering notification, app state:', AppState.currentState);

    // Check if it's time for a long break
    let isLongBreak = false;
    if (
      !isBreak &&
      pomodoroCount > 0 &&
      pomodoroCount % longBreakInterval === 0
    ) {
      isLongBreak = true;
    }

    const title = isBreak ? "Break Time Ended" : "Session Complete!";
    const body = isBreak
      ? "Break is over! Ready to start another work session?"
      : isLongBreak
        ? `Great job! You've completed ${longBreakInterval} work sessions. Time for a longer break!`
        : "Work session complete! Take a break or continue?";

    // Use notification service to send immediate notification
    console.log(`Sending notification: ${title} - ${body}`);
    
    await notificationService.sendImmediateNotification(title, body, {
      screen: "Focus",
      isBreak: isBreak,
      isLongBreak: isLongBreak,
    });
  };

  // Add a new render function to generate progress dots
  const renderProgressDots = () => {
    // Create an array with length of longBreakInterval
    const dots = Array.from({ length: longBreakInterval }, (_, index) => {
      // Calculate session progress within the current circle
      const sessionPosition = ((pomodoroCount + (isBreak ? 0 : 1) - 1) % longBreakInterval) + 1;
      
      // Calculate if the current dot is completed, current, or incomplete
      const isCompleted = index < sessionPosition - 1;
      const isCurrent = index === sessionPosition - 1;

      // Return different styled dots based on status
      return (
        <View
          key={index}
          style={[
            styles.progressDot,
            isLightTheme && styles.lightProgressDot,
            isCompleted || isCurrent
              ? isLightTheme 
                ? styles.lightProgressDotFilled 
                : styles.progressDotFilled
              : styles.progressDotEmpty,
          ]}
        />
      );
    });

    return <View style={styles.progressDotsContainer}>{dots}</View>;
  };

  // Save the current session state
  // This is now only called:
  // 1. When the user manually pauses the timer via toggleTimer
  // 2. When a focus session naturally completes
  // 3. When navigating away from the screen via back button
  // 4. When the app is backgrounded (handled in AppState listener)
  const saveSessionState = async () => {
    const result = await withErrorHandling(async () => {
      // Don't save if session never started
      if (!hasStartedBefore && !isActive) {
        console.log('Session never started, nothing to save');
        return;
      }
      
      console.log('Saving focus session state...');
      
      // Get current user settings to include with session state
      const userSettings = await getSettingsWithDefaults();
      
      const sessionState = {
        // Session progress
        timeRemaining,
        isActive,
        isBreak,
        pomodoroCount,
        progress,
        hasStartedBefore,
        sessionStartTime: sessionStartTime.current ? sessionStartTime.current.toISOString() : null,
        
        // Save current session settings (what session was actually using)
        currentFocusDuration: focusDuration,
        currentBreakDuration: breakDuration,
        currentLongBreakDuration: longBreakDuration,
        currentLongBreakInterval: longBreakInterval,
        
        // Also save latest user settings (for comparison when restoring)
        userFocusDuration: userSettings.focusDuration,
        userBreakDuration: userSettings.breakDuration,
        userLongBreakDuration: userSettings.longBreakDuration,
        userLongBreakInterval: userSettings.longBreakInterval,
        
        // Metadata
        timestamp: new Date().toISOString()
      };
      
      // Use withRetry to handle potential storage errors with exponential backoff
      await withRetry(async () => {
        // Save to storage
        await storageService.setItem('focusSessionState', JSON.stringify(sessionState));
      }, {
        maxRetries: 3,
        initialDelay: 100
      });
      
      console.log('Focus session state saved successfully');
    }, { 
      operation: 'Save focus session', 
      silent: false
    });
    
    if (!result.success) {
      console.log('Failed to save session state:', result.error.message);
    }
  };

  // Restore session state from AsyncStorage
  const restoreSessionState = async () => {
    const result = await withErrorHandling(async () => {
      console.log('Attempting to restore focus session state');
      
      // First load latest user settings
      const userSettings = await getSettingsWithDefaults();
      
      // Always update focus settings from user settings
      setFocusDuration(userSettings.focusDuration || 25);
      setBreakDuration(userSettings.breakDuration || 5);
      setLongBreakDuration(userSettings.longBreakDuration || 15);
      setLongBreakInterval(userSettings.longBreakInterval || 4);
      
      // Use withRetry to handle potential storage errors with exponential backoff
      const sessionStateJSON = await withRetry(async () => {
        return await storageService.getItem('focusSessionState');
      }, {
        maxRetries: 3,
        initialDelay: 100
      });
      
      if (!sessionStateJSON) {
        console.log('No saved session state found, initializing with user settings');
        setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
        // Load today's pomodoro count
        await loadTodayPomodoroCount();
        return;
      }
      
      console.log('Found saved session state, checking if settings were changed');
      let sessionState;
      
      try {
        sessionState = JSON.parse(sessionStateJSON);
      } catch (error) {
        console.error('Error parsing session state JSON:', error);
        // If we can't parse the JSON, treat it as if there's no saved state
        setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
        await loadTodayPomodoroCount();
        
        // Try to remove the corrupted state
        await storageService.removeItem('focusSessionState');
        return;
      }
      
      // Check if user changed focus settings since last session
      const settingsChanged = 
        userSettings.focusDuration !== sessionState.userFocusDuration ||
        userSettings.breakDuration !== sessionState.userBreakDuration ||
        userSettings.longBreakDuration !== sessionState.userLongBreakDuration ||
        userSettings.longBreakInterval !== sessionState.userLongBreakInterval;
      
      if (settingsChanged) {
        console.log('User settings changed, resetting session state');
        
        // Reset session with new settings
        setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
        setIsBreak(false);
        setPomodoroCount(0);
        setProgress(0);
        setHasStartedBefore(false);
        sessionStartTime.current = null;
        setIsActive(false);
        
        // Remove saved session state since it's now invalid
        await storageService.removeItem('focusSessionState');
        
        // Load today's pomodoro count
        await loadTodayPomodoroCount();
        
        return;
      }
      
      console.log('Restoring session progress (settings unchanged)');
      
      // Restore session progress state
      setTimeRemaining(sessionState.timeRemaining || (userSettings.focusDuration * 60));
      setIsBreak(sessionState.isBreak || false);
      setPomodoroCount(sessionState.pomodoroCount || 0);
      setProgress(sessionState.progress || 0);
      setHasStartedBefore(sessionState.hasStartedBefore || false);
      
      // Restore session start time
      if (sessionState.sessionStartTime) {
        sessionStartTime.current = new Date(sessionState.sessionStartTime);
      }
      
      // If previously active, don't auto-activate now
      // User needs to manually press "RESUME" button to continue
      setIsActive(false);
      
      console.log('Focus session state restored successfully');
      
      // Load today's pomodoro count
      await loadTodayPomodoroCount();
    }, { 
      operation: 'Restore focus session', 
      silent: false
    });
    
    if (!result.success) {
      console.log('Failed to restore session state:', result.error.message);
      
      // Initialize with default values in case of error
      const settings = await getSettingsWithDefaults();
      setTimeRemaining(settings.focusDuration * 60 || 25 * 60);
      setProgress(0);
      
      // Load today's pomodoro count
      await loadTodayPomodoroCount();
    }
  };

  // Check if app has been restarted
  const checkAppRestart = async () => {
    const result = await withErrorHandling(async () => {
      // Get the last app launch timestamp
      const lastLaunchTime = await withRetry(async () => {
        return await storageService.getItem('appLastLaunchTime');
      }, {
        maxRetries: 2,
        initialDelay: 100
      });
      
      const currentTime = new Date().toISOString();
      
      // Save current launch time with retry mechanism
      await withRetry(async () => {
        await storageService.setItem('appLastLaunchTime', currentTime);
      }, {
        maxRetries: 2,
        initialDelay: 100
      });
      
      // If no last launch time exists, this is first launch
      if (!lastLaunchTime) {
        return true;
      }
      
      // Check if the app has been closed (not just backgrounded)
      // This is a simplified check - in a real app, you might want to use
      // a more sophisticated approach to detect actual app restarts
      const lastLaunch = new Date(lastLaunchTime);
      const now = new Date();
      const minutesSinceLastLaunch = (now - lastLaunch) / (1000 * 60);
      
      // If more than 5 minutes have passed, consider it a restart
      return minutesSinceLastLaunch > 5;
    }, { 
      operation: 'Check app restart', 
      silent: true 
    });
    
    // Default to false (assume not restarted) if there was an error
    if (!result.success) {
      console.log('Error in checkAppRestart, assuming not restarted:', result.error.message);
      return false;
    }
    
    return result.data;
  };

  // Restore session state when component mounts
  useEffect(() => {
    const initializeSession = async () => {
      const result = await withErrorHandling(async () => {
        // Always load latest user settings
        const userSettings = await getSettingsWithDefaults();
        
        // Update focus settings from user settings
        setFocusDuration(userSettings.focusDuration || 25);
        setBreakDuration(userSettings.breakDuration || 5);
        setLongBreakDuration(userSettings.longBreakDuration || 15);
        setLongBreakInterval(userSettings.longBreakInterval || 4);
        
        // Check if app has been restarted
        const isAppRestart = await checkAppRestart();
        
        if (isAppRestart) {
          console.log('App restarted, resetting session progress');
          
          // Reset session progress while preserving settings
          setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
          setProgress(0);
          setIsActive(false);
          setHasStartedBefore(false);
          setIsBreak(false);
          setPomodoroCount(0);
          sessionStartTime.current = null;
          
          // Clear any saved session state with retry for reliability
          await withRetry(async () => {
            await storageService.removeItem('focusSessionState');
          }, {
            maxRetries: 2,
            initialDelay: 100,
            shouldRetry: (error) => {
              console.log('Retry removing focusSessionState:', error.message);
              return true;
            }
          });
        } else {
          console.log('App resumed, attempting to restore session');
          // App was just backgrounded/foregrounded, restore previous session
          await restoreSessionState();
        }
        
        return true;
      }, { 
        operation: 'Initialize focus session', 
        silent: false,
        onError: (error) => {
          console.log('Error in initializeSession, setting safe defaults:', error.message);
          // Set safe default values in case of unhandled error
          setTimeRemaining(25 * 60);
          setProgress(0);
          setIsActive(false); 
          setHasStartedBefore(false);
        }
      });
      
      // No additional handling needed here since onError in options handles the failure case
    };
    
    initializeSession();
  }, []);

  // Save session state when component unmounts or navigation leaves
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Only save state when screen is unmounted, not on every state change
      };
    }, [])
  );

  // Handle navigation back button press
  const handleBackPress = () => {
    // If focus or break is active, show confirmation dialog
    if (isActive) {
      Alert.alert(
        "Focus Mode Active",
        "Are you sure you want to exit? Your current session will be lost.",
        [
          { text: "Stay Focused", style: "cancel" },
          { 
            text: "Exit", 
            onPress: async () => {
              // Stop timer
              if (timer.current) {
                clearInterval(timer.current);
                timer.current = null;
              }
              setIsActive(false);
              
              // Save session state before navigating
              await saveSessionState();
              navigation.navigate("Home");
            },
            style: "destructive" 
          }
        ]
      );
      return true; // For Android hardware back button handling
    } else {
      // If no active session, save state and return directly
      saveSessionState();
      navigation.navigate("Home");
      return false; // For Android hardware back button handling
    }
  };

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [isActive, navigation]);

  // Manage screen wake lock based on focus state and user preference
  useEffect(() => {
    const manageScreenWakeLock = async () => {
      try {
        if (isActive && keepScreenAwake) {
          // Activate keep awake when focus session is active and setting is enabled
          await activateKeepAwakeAsync('FocusScreen');
        } else {
          // Deactivate keep awake when focus session ends or setting is disabled
          deactivateKeepAwake('FocusScreen');
        }
      } catch (error) {
        console.error('Error managing screen wake lock:', error);
      }
    };
    
    manageScreenWakeLock();
    
    // Clean up on component unmount
    return () => {
      try {
        deactivateKeepAwake('FocusScreen');
      } catch (error) {
        console.error('Error deactivating screen wake lock:', error);
      }
    };
  }, [isActive, keepScreenAwake]);

  // Check if it's a new day and reset the pomodoro count if needed
  const checkForNewDay = async () => {
    try {
      // Get last recorded date
      const lastDateJson = await storageService.getItem("lastFocusDate");
      const today = new Date().toISOString().split("T")[0];
      
      // If date is different or no date has been recorded
      if (!lastDateJson || JSON.parse(lastDateJson) !== today) {
        // It's a new day, reload the pomodoro count
        await loadTodayPomodoroCount();
        
        // Update last recorded date to today
        await storageService.setItem("lastFocusDate", JSON.stringify(today));
      }
    } catch (error) {
      console.error("Error checking for new day:", error);
    }
  };

  // Check for new day when the component mounts and becomes active
  useEffect(() => {
    checkForNewDay();
    
    // Also check when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.current === "background" && nextAppState === "active") {
        checkForNewDay();
      }
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Completion icon animation effect
  useEffect(() => {
    if (showChoice) {
      // Create a looping animation that slightly scales the icon up and down
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(iconAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset animation
      iconAnimation.setValue(1);
    }
    
    return () => {
      iconAnimation.setValue(1);
    };
  }, [showChoice, iconAnimation]);

  // Play completion sound based on session type
  const playCompletionSound = async () => {
    try {
      // Don't play sound if app is in foreground and should instead use vibration
      const isAppInBackground = appState.current.match(/inactive|background/);
      if (isAppInBackground) {
        return; // Skip sound if app is in background (notification will be shown instead)
      }
      
      // Select and play the correct sound based on session type
      const soundToPlay = isBreak ? breakSound : focusSound;
      
      if (soundToPlay) {
        // Make sure the sound is at the beginning
        await soundToPlay.setPositionAsync(0);
        await soundToPlay.playAsync();
        console.log(`${isBreak ? 'Break' : 'Focus'} completion sound played`);
      }
    } catch (error) {
      console.error("Error playing completion sound:", error);
    }
  };

  // Render interface
  return (
    <View style={[
      styles.container, 
      isLightTheme && styles.lightContainer
    ]}>
      {/* Header area */}
      {!isActive && (
        <SafeHeader 
          title="FOCUS"
          onBackPress={handleBackPress}
          hideBackButton={false}
          showBottomBorder={false}
        />
      )}

      {/* Main content area */}
      <View style={[
        styles.contentContainer, 
        isLightTheme && styles.lightContentContainer
      ]}>
        {showChoice ? (
          <View style={[styles.choiceContainer, isLightTheme && styles.lightChoiceContainer]}>
            <Animated.View style={{ 
              transform: [{ scale: iconAnimation }],
              marginBottom: 10 
            }}>
              <MaterialCommunityIcons 
                name={isBreak ? "coffee-outline" : "check-circle-outline"} 
                size={60} 
                color={isLightTheme ? "#000000" : "#FFFFFF"} 
              />
            </Animated.View>
            <Text style={[styles.choiceText, isLightTheme && styles.lightText]}>
              {isBreak ? "Break Time Complete!" : "Work Session Complete!"}
            </Text>
            <Text style={[styles.choiceSubtext, isLightTheme && styles.lightSubtext]}>
              {isBreak 
                ? "Ready to get back to work?" 
                : `You've completed ${pomodoroCount} pomodoros`
              }
            </Text>

            {/* Modify display text based on whether it's long break time */}
            <TouchableOpacity style={styles.actionButton} onPress={startBreak}>
              <Text style={styles.actionButtonText}>
                {pomodoroCount % longBreakInterval === 0
                  ? `Take a ${longBreakDuration} min Long Break`
                  : `Take a ${breakDuration} min Break`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={startNextFocus}
            >
              <Text style={styles.actionButtonText}>
                Next {focusDuration} min Session
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.subHeaderText, isLightTheme && styles.lightText]}>
              {"SESSION"}{" "}
              {Math.ceil((pomodoroCount + (isBreak ? 0 : 1)) / longBreakInterval)}.
              {((pomodoroCount + (isBreak ? 0 : 1) - 1) % longBreakInterval) + 1}
            </Text>
            <Text style={[styles.subText, isLightTheme && styles.lightSubtext]}>
              {isActive
                ? isBreak
                  ? "Taking a break..."
                  : "Working..."
                : isBreak
                  ? "Break time"
                  : "Ready to focus?"}
            </Text>
            
            {/* Main timer area */}
            <View style={styles.timerContainer}>
              <View style={styles.progressContainer}>
                <Progress.Circle
                  size={240}
                  thickness={8}
                  color={isLightTheme ? "#000000" : "#FFFFFF"}
                  unfilledColor={isLightTheme ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.2)"}
                  progress={progress}
                />
                <Text style={[styles.timerText, isLightTheme && styles.lightText]}>
                  {formatTime(timeRemaining)}
                </Text>
              </View>
            </View>
            
            {/* Controls area - Separated to optimize layout */}
            <View style={styles.controlsContainer}>
              {renderProgressDots()}

              <TouchableOpacity
                style={[styles.timerButton, isLightTheme && styles.lightTimerButton]}
                onPress={toggleTimer}
              >
                <Text style={[styles.timerButtonText, isLightTheme && styles.lightTimerButtonText]}>
                  {isActive ? "PAUSE" : hasStartedBefore ? "RESUME" : "START"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Bottom safe area */}
      <View style={[
        styles.footer,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }
      ]}>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{pomodoroCount} Pomodoros</Text>
          <MaterialCommunityIcons 
            name="timer-outline" 
            size={16} 
            color="#666666"
            style={styles.tomatoIcon} 
          />
        </View>
      </View>

      {/* Confirmation modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showConfirmation}
        onRequestClose={cancelFocusMode}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalText}>Enter Focus Mode?</Text>
            <Text style={styles.modalSubtext}>
              This will start a {focusDuration}-minute focus session.
            </Text>
            <View style={styles.modalButtonContainer}>
              <Pressable style={styles.modalButton} onPress={cancelFocusMode}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmFocusMode}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Style definitions
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000000" 
  },
  headerContainer: {
    width: "100%",
    height: 60, // fixed height
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 10,
    zIndex: 10,
  },
  headerButtonText: { color: "#FFFFFF", fontSize: 26, fontWeight: "bold" },
  headerText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  subHeaderText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  subText: {
    color: "#666666",
    fontSize: 18,
    marginBottom: 30,
    textAlign: "center",
  },
  timerContainer: { 
    alignItems: "center",
    justifyContent: "center",
    flex: 0.7,
  },
  progressContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    width: 240,
    height: 240,
  },
  timerText: {
    position: "absolute",
    color: "#FFFFFF",
    fontSize: 60,
    fontWeight: "200",
    fontFamily:
      Platform.OS === "ios"
        ? "Courier New" 
        : "monospace",
    textAlign: "center",
  },
  timerButton: { backgroundColor: "#FFFFFF", padding: 20, borderRadius: 40, marginTop: 20 },
  timerButtonText: { color: "#000000", fontSize: 20, fontWeight: "bold" },
  choiceContainer: { alignItems: "center" },
  choiceText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 10,
  },
  choiceSubtext: { color: "#666666", fontSize: 16, marginBottom: 20 },
  actionButton: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  actionButtonText: { color: "#000000", fontSize: 16, fontWeight: "500" },
  footer: {
    width: "100%",
    alignItems: "center",
    marginTop: "auto",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsText: {
    color: "#666666",
    fontSize: 14,
  },
  tomatoIcon: {
    marginLeft: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    width: "80%",
  },
  modalText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalSubtext: {
    fontSize: 16,
    color: "#666666",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: "#CCCCCC",
    alignItems: "center",
  },
  confirmButton: {
    backgroundColor: "#000000",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  progressDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  progressDotEmpty: {
    backgroundColor: "transparent",
  },
  progressDotFilled: {
    backgroundColor: "#FFFFFF",
  },
  lightContainer: {
    backgroundColor: "#FFFFFF",
  },
  lightContentContainer: {
    backgroundColor: "#FFFFFF",
  },
  lightChoiceContainer: {
    backgroundColor: "#FFFFFF",
  },
  lightText: {
    color: "#000000",
  },
  lightSubtext: {
    color: "#666666",
  },
  lightProgressDot: {
    borderColor: "#000000",
  },
  lightProgressDotFilled: {
    backgroundColor: "#000000",
  },
  lightTimerButton: {
    backgroundColor: "#000000",
  },
  lightTimerButtonText: {
    color: "#FFFFFF",
  },
  controlsContainer: {
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    gap: 30, // Increase vertical spacing
  },
});
