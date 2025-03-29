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
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Progress from "react-native-progress";
import storageService from "../services/storage/StorageService";
import { useFocusEffect } from "@react-navigation/native";
import notificationService from "../services/NotificationService";
import CustomHeader from "../components/CustomHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

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
        // Save session state when screen loses focus
        saveSessionState();
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
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isActive
      ) {
        handleAppForeground();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isActive]);

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
      if (!isBreak) handleFocusComplete();
      else handleBreakComplete();
      if (focusNotifications && notificationPermission) triggerNotification();
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
    
    // Vibrate device
    Vibration.vibrate([0, 500, 200, 500]);
    
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
    setIsActive(false);
    setIsBreak(false);
    setTimeRemaining(focusDuration * 60);
    setProgress(0);
    setShowChoice(false);
    Vibration.vibrate(500);
    setHasStartedBefore(false);

    // Auto-start next focus session if enabled
    if (autoStartNextFocus) {
      setTimeout(() => {
        setIsActive(true);
        sessionStartTime.current = new Date();
      }, 1500);
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
    if (!focusNotifications) return;

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
      // Calculate if the current dot is completed, current, or incomplete
      const isCompleted = index < pomodoroCount % longBreakInterval;
      const isCurrent = !isBreak && index === pomodoroCount % longBreakInterval;

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
  const saveSessionState = async () => {
    try {
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
      
      // Save to AsyncStorage
      await storageService.setItem('focusSessionState', JSON.stringify(sessionState));
      console.log('Focus session state saved successfully');
    } catch (error) {
      console.error('Error saving focus session state:', error);
    }
  };

  // Restore session state from AsyncStorage
  const restoreSessionState = async () => {
    try {
      console.log('Attempting to restore focus session state');
      
      // First load latest user settings
      const userSettings = await getSettingsWithDefaults();
      
      // Always update focus settings from user settings
      setFocusDuration(userSettings.focusDuration || 25);
      setBreakDuration(userSettings.breakDuration || 5);
      setLongBreakDuration(userSettings.longBreakDuration || 15);
      setLongBreakInterval(userSettings.longBreakInterval || 4);
      
      // Get saved session state
      const sessionStateJSON = await storageService.getItem('focusSessionState');
      if (!sessionStateJSON) {
        console.log('No saved session state found, initializing with user settings');
        setTimeRemaining(userSettings.focusDuration * 60 || 25 * 60);
        // Load today's pomodoro count
        await loadTodayPomodoroCount();
        return;
      }
      
      console.log('Found saved session state, checking if settings were changed');
      const sessionState = JSON.parse(sessionStateJSON);
      
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
    } catch (error) {
      console.error('Error restoring focus session state:', error);
      
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
    try {
      // Get the last app launch timestamp
      const lastLaunchTime = await storageService.getItem('appLastLaunchTime');
      const currentTime = new Date().toISOString();
      
      // Save current launch time
      await storageService.setItem('appLastLaunchTime', currentTime);
      
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
    } catch (error) {
      console.error('Error checking app restart:', error);
      return false;
    }
  };

  // Restore session state when component mounts
  useEffect(() => {
    const initializeSession = async () => {
      try {
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
          
          // Clear any saved session state
          await storageService.removeItem('focusSessionState');
        } else {
          console.log('App resumed, attempting to restore session');
          // App was just backgrounded/foregrounded, restore previous session
          await restoreSessionState();
        }
      } catch (error) {
        console.error('Error in initializeSession:', error);
        // Set safe default values
        setTimeRemaining(25 * 60);
        setProgress(0);
      }
    };
    
    initializeSession();
  }, []);

  // Save session state when component unmounts or navigation leaves
  useFocusEffect(
    useCallback(() => {
      return () => {
        saveSessionState();
      };
    }, [timeRemaining, isActive, isBreak, pomodoroCount, progress, hasStartedBefore])
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

  // Render interface
  return (
    <View style={[
      styles.container, 
      isLightTheme && styles.lightContainer,
      { 
        paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
      }
    ]}>
      {/* Header - Hide back button during focus or break */}
      <CustomHeader 
        title="FOCUS"
        onBackPress={handleBackPress}
        hideBackButton={isActive} // Hide back button when timer is active
        showBottomBorder={false}
      />

      {/* Main content area */}
      <View style={[styles.contentContainer, isLightTheme && styles.lightContentContainer]}>
        {showChoice ? (
          <View style={[styles.choiceContainer, isLightTheme && styles.lightChoiceContainer]}>
            <Text style={[styles.choiceText, isLightTheme && styles.lightText]}>Work Session Complete!</Text>
            <Text style={[styles.choiceSubtext, isLightTheme && styles.lightSubtext]}>
              You've completed {pomodoroCount} pomodoros
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
              {isBreak ? "BREAK" : "SESSION"}{" "}
              {Math.floor(pomodoroCount / longBreakInterval) + 1}.
              {(pomodoroCount % longBreakInterval) + 1}
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
                  color="#FFFFFF"
                  unfilledColor="rgba(255, 255, 255, 0.2)"
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

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.statsText}>Pomodoros: {pomodoroCount}</Text>
      </View>
    </View>
  );
}

// Style definitions
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    position: "relative",
    width: "100%",
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: "center",
    // marginBottom: 20,
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
    paddingBottom: 20,
    marginTop: "auto",
  },
  statsText: {
    color: "#666666",
    fontSize: 14,
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
