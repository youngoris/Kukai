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
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Progress from "react-native-progress";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import notificationService from "../services/NotificationService";
import HeaderBar from "../components/HeaderBar";
import { getSettingsWithDefaults } from "../utils/defaultSettings";

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

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults(AsyncStorage);
        if (settings.appTheme) {
          setAppTheme(settings.appTheme);
        }
        
        // Load focus settings
        if (settings.focusDuration) {
          setFocusDuration(settings.focusDuration);
        }
        if (settings.breakDuration) {
          setBreakDuration(settings.breakDuration);
        }
        if (settings.longBreakDuration) {
          setLongBreakDuration(settings.longBreakDuration);
        }
        if (settings.longBreakInterval) {
          setLongBreakInterval(settings.longBreakInterval);
        }
        setAutoStartNextFocus(settings.autoStartNextFocus || false);
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  // Load focus settings
  useFocusEffect(
    React.useCallback(() => {
      const loadFocusSettings = async () => {
        try {
          const settingsData = await AsyncStorage.getItem("userSettings");
          if (settingsData) {
            const parsedSettings = JSON.parse(settingsData);
            console.log("Loaded focus settings:", parsedSettings);

            // Update focus settings
            if (parsedSettings.focusDuration) {
              setFocusDuration(parsedSettings.focusDuration);
            }

            if (parsedSettings.breakDuration) {
              setBreakDuration(parsedSettings.breakDuration);
            }

            if (parsedSettings.longBreakDuration) {
              setLongBreakDuration(parsedSettings.longBreakDuration);
            }

            if (parsedSettings.longBreakInterval) {
              setLongBreakInterval(parsedSettings.longBreakInterval);
            }

            if (parsedSettings.focusNotifications !== undefined) {
              setFocusNotifications(parsedSettings.focusNotifications);
            }

            if (parsedSettings.autoStartNextFocus !== undefined) {
              setAutoStartNextFocus(parsedSettings.autoStartNextFocus);
            }

            // Initialize timeRemaining with focus duration
            setTimeRemaining(parsedSettings.focusDuration * 60 || 25 * 60);
          } else {
            // Default values if no settings found
            setTimeRemaining(25 * 60);
          }
        } catch (error) {
          console.error("Error loading focus settings:", error);
          setTimeRemaining(25 * 60);
        }
      };

      loadFocusSettings();
      return () => {};
    }, []),
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

  // Handle focus time completion
  const handleFocusComplete = async () => {
    console.log("Work session completed");
    
    // Stop timer
    clearInterval(timer.current);
    timer.current = null;
    
    // Vibrate to notify user
    Vibration.vibrate([0, 500, 200, 500]);
    
    // Show notification
    if (focusNotifications) {
      triggerNotification();
    }

    setIsActive(false);
    setShowChoice(true);

    // Increment pomodoro count
    const newCount = pomodoroCount + 1;
    setPomodoroCount(newCount);

    // Save to AsyncStorage
    try {
      // Get today's date string as key
      const today = new Date().toISOString().split("T")[0];
      const savedData = await AsyncStorage.getItem("dailyStats");
      let dailyStats = savedData ? JSON.parse(savedData) : {};

      // Initialize today's data if not exists
      if (!dailyStats[today]) {
        dailyStats[today] = {
          pomodoroCount: 0,
          focusMinutes: 0,
          meditationMinutes: 0,
        };
      }

      // Update pomodoro count and focus minutes
      dailyStats[today].pomodoroCount = newCount;
      dailyStats[today].focusMinutes =
        (dailyStats[today].focusMinutes || 0) + focusDuration;

      // Save updated data
      await AsyncStorage.setItem("dailyStats", JSON.stringify(dailyStats));
    } catch (error) {
      console.error("Error saving focus session:", error);
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

  // Save current session state to AsyncStorage
  const saveSessionState = async () => {
    try {
      if (!isActive && !hasStartedBefore) return; // Don't save if session never started
      
      const sessionState = {
        timeRemaining,
        isActive,
        isBreak,
        pomodoroCount,
        progress,
        hasStartedBefore,
        sessionStartTime: sessionStartTime.current ? sessionStartTime.current.toISOString() : null,
        timestamp: new Date().toISOString()
      };
      
      await AsyncStorage.setItem('focusSessionState', JSON.stringify(sessionState));
      console.log('Focus session state saved:', sessionState);
    } catch (error) {
      console.error('Error saving focus session state:', error);
    }
  };

  // Restore session state from AsyncStorage
  const restoreSessionState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('focusSessionState');
      if (!savedState) {
        // No saved state found, initialize with default values
        const defaultDuration = focusDuration * 60;
        setTimeRemaining(defaultDuration);
        setProgress(0);
        return;
      }
      
      const sessionState = JSON.parse(savedState);
      console.log('Restoring focus session state:', sessionState);
      
      // Check if saved state is expired (more than 1 hour old)
      const savedTime = new Date(sessionState.timestamp);
      const currentTime = new Date();
      const hoursPassed = (currentTime - savedTime) / (1000 * 60 * 60);
      
      if (hoursPassed > 1) {
        console.log('Saved session state is too old, not restoring');
        await AsyncStorage.removeItem('focusSessionState');
        
        // Initialize with default values
        const defaultDuration = focusDuration * 60;
        setTimeRemaining(defaultDuration);
        setProgress(0);
        return;
      }
      
      // Restore state
      setTimeRemaining(sessionState.timeRemaining);
      setIsBreak(sessionState.isBreak);
      setPomodoroCount(sessionState.pomodoroCount);
      setProgress(sessionState.progress);
      setHasStartedBefore(sessionState.hasStartedBefore);
      
      // Restore session start time
      if (sessionState.sessionStartTime) {
        sessionStartTime.current = new Date(sessionState.sessionStartTime);
      }
      
      // If previously active, don't auto-activate now
      // User needs to manually press "RESUME" button to continue
      setIsActive(false);
    } catch (error) {
      console.error('Error restoring focus session state:', error);
      
      // Initialize with default values in case of error
      const defaultDuration = focusDuration * 60;
      setTimeRemaining(defaultDuration);
      setProgress(0);
    }
  };

  // Check if app has been restarted
  const checkAppRestart = async () => {
    try {
      // Get the last app launch timestamp
      const lastLaunchTime = await AsyncStorage.getItem('appLastLaunchTime');
      const currentTime = new Date().toISOString();
      
      // Save current launch time
      await AsyncStorage.setItem('appLastLaunchTime', currentTime);
      
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
      const isAppRestart = await checkAppRestart();
      
      if (isAppRestart) {
        // If app has restarted, initialize with default values
        console.log('App has been restarted, initializing with default values');
        const defaultDuration = focusDuration * 60;
        setTimeRemaining(defaultDuration);
        setProgress(0);
        setIsActive(false);
        setHasStartedBefore(false);
        setIsBreak(false);
        
        // Clear any saved session state
        await AsyncStorage.removeItem('focusSessionState');
      } else {
        // Otherwise, try to restore the previous session
        await restoreSessionState();
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

  // Render interface
  return (
    <SafeAreaView style={[styles.container, isLightTheme && styles.lightContainer]}>
      {/* Header - 在专注或休息时隐藏返回按钮 */}
      <HeaderBar 
        title="FOCUS"
        onBackPress={handleBackPress}
        appTheme={appTheme}
        hideBackButton={isActive} // 当计时器激活时隐藏返回按钮
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
            
            {/* 主计时器区域 */}
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
            
            {/* 控制区域 - 分离出来以优化布局 */}
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
    </SafeAreaView>
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
        ? "Courier New" // iOS上更美观的等宽字体
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
    gap: 30, // 增加垂直间距
  },
});
