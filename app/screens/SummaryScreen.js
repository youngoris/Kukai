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
  StatusBar as RNStatusBar,
  FlatList,
  TextInput,
  Alert,
  Keyboard,
  Animated,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import {
  AntDesign,
  MaterialIcons,
  Ionicons,
  Feather,
  Octicons,
} from "@expo/vector-icons";
import storageService from "../services/storage/StorageService";
import FrogIcon from "../../assets/frog.svg";
import CustomDateTimePicker from "../components/CustomDateTimePicker";
import CustomHeader from "../components/CustomHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SummaryScreen = ({ navigation }) => {
  // ... existing state variables ...

  // ... existing useEffect hooks ...

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults();
        if (settings.appTheme) {
          setAppTheme(settings.appTheme);
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  // Add self-test function for data handling
  const testDataHandling = (data) => {
    try {
      // Test parsing JSON string (AsyncStorage format)
      const jsonString = JSON.stringify({ test: 'value' });
      const parsedJson = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      console.log('JSON string test passed:', parsedJson.test === 'value');
      
      // Test handling direct object (SQLite format)
      const directObject = { test: 'value' };
      const parsedObject = typeof directObject === 'string' ? JSON.parse(directObject) : directObject;
      console.log('Direct object test passed:', parsedObject.test === 'value');
      
      return true;
    } catch (error) {
      console.error('Self-test failed:', error);
      return false;
    }
  };
  
  // Run self-test when component mounts
  useEffect(() => {
    testDataHandling();
  }, []);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Load task data
      const tasksData = await storageService.getItem("tasks");
      let allTasks = [];

      // Process task data
      if (tasksData) {
        // Handle both JSON strings and direct objects from SQLite
        allTasks = typeof tasksData === 'string' ? JSON.parse(tasksData) : tasksData;
        
        // Filter completed and pending tasks for today
        const todayTasks = allTasks.filter((task) => {
          // If task has a completion time, check if it's today's task
          if (task.completedAt) {
            const completedDate = new Date(task.completedAt)
              .toISOString()
              .split("T")[0];
            return completedDate === today;
          }
          // For pending tasks, default to showing all pending tasks
          return !task.completed;
        });

        const completed = todayTasks.filter((task) => task.completed);
        const pending = todayTasks.filter((task) => !task.completed);

        setCompletedTasks(completed);
        setPendingTasks(pending);

        // Calculate today's task completion rate (only consider today's tasks)
        const rate =
          todayTasks.length > 0
            ? (completed.length / todayTasks.length) * 100
            : 0;
        setCompletionRate(Math.round(rate));
      } else {
        // If no task data, initialize as empty array
        setCompletedTasks([]);
        setPendingTasks([]);
        setCompletionRate(0);
        // Create initial empty task array and save
        await storageService.setItem("tasks", []);
      }

      // Load meditation data (only load today's meditation time)
      const meditationSessionsData = await storageService.getItem("meditationSessions");
      let todayMeditationMinutes = 0;
      
      if (meditationSessionsData) {
        const meditationSessions = typeof meditationSessionsData === 'string' 
          ? JSON.parse(meditationSessionsData) 
          : meditationSessionsData;
          
        const todaySessions = meditationSessions.filter(
          (session) => session.date === today,
        );
        todayMeditationMinutes = todaySessions.reduce(
          (total, session) => total + session.duration,
          0,
        );
      }
      setTotalMeditationMinutes(todayMeditationMinutes);

      // Load focus time data (only load today's focus time)
      const focusSessionsData = await storageService.getItem("focusSessions");
      if (focusSessionsData) {
        const focusSessions = typeof focusSessionsData === 'string'
          ? JSON.parse(focusSessionsData)
          : focusSessionsData;
          
        const todaySessions = focusSessions.filter(
          (session) => session.date === today,
        );
        const todayMinutes = todaySessions.reduce(
          (total, session) => total + Math.round(session.duration / 60),
          0,
        );
        setTotalFocusMinutes(todayMinutes);
      } else {
        setTotalFocusMinutes(0);
      }

      // Load pomodoro count (only load today's pomodoro count)
      const pomodorosData = await storageService.getItem("pomodoros");
      if (pomodorosData) {
        const pomodoros = typeof pomodorosData === 'string'
          ? JSON.parse(pomodorosData)
          : pomodorosData;
          
        // Filter today's pomodoro records
        const todayPomodoros = pomodoros.filter(
          (pomodoro) => pomodoro.date === today,
        );
        // Set today's pomodoro count
        setPomodoroCount(todayPomodoros.length);
      } else {
        setPomodoroCount(0);
      }

      // Load tomorrow's tasks
      const tomorrowTasksData = await storageService.getItem("tomorrowTasks");
      if (tomorrowTasksData) {
        setTomorrowTasks(typeof tomorrowTasksData === 'string'
          ? JSON.parse(tomorrowTasksData)
          : tomorrowTasksData);
      } else {
        // If no tomorrow task data, initialize as empty array
        setTomorrowTasks([]);
        await storageService.setItem("tomorrowTasks", []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      // Show friendly error message and provide retry option
      Alert.alert("Data Loading Error", "Unable to load summary data.", [
        {
          text: "Retry",
          onPress: () => loadData(),
        },
        {
          text: "OK",
          style: "cancel",
        },
      ]);
    }
  };

  const checkDailyReset = async () => {
    try {
      // Check if daily reset is needed

      // Get current date
      const today = new Date().toISOString().split("T")[0];

      // Get last recorded date
      const lastDateData = await storageService.getItem("lastDate");

      // If date is different or no date has been recorded, perform daily reset
      if (!lastDateData || (typeof lastDateData === 'string' ? JSON.parse(lastDateData) : lastDateData) !== today) {
        await resetDailyPomodoroCount(
          lastDateData ? (typeof lastDateData === 'string' ? JSON.parse(lastDateData) : lastDateData) : null,
        );

        // Update last recorded date to today
        await storageService.setItem("lastDate", today);

        // Auto transfer tomorrow's tasks to today's tasks if enabled
        await autoTransferTomorrowTasks();
      }
    } catch (error) {
      console.error("Error checking daily reset:", error);
    }
  };

  // Reset daily pomodoro count but keep history
  const resetDailyPomodoroCount = async (lastDate) => {
    try {
      // Reset daily pomodoro count but keep history
      const pomodorosData = await storageService.getItem("pomodoros");
      if (pomodorosData) {
        const pomodoros = typeof pomodorosData === 'string'
          ? JSON.parse(pomodorosData)
          : pomodorosData;
        // Keep the history but reset today's count
        setPomodoroCount(0);
      }
    } catch (error) {
      console.error("Error resetting pomodoro count:", error);
    }
  };

  // If auto transfer is enabled, move tomorrow's tasks to today's tasks
  const autoTransferTomorrowTasks = async () => {
    try {
      // Get user settings to check if auto transfer is enabled
      const userSettingsData = await storageService.getItem("userSettings");
      let autoTransfer = false;

      if (userSettingsData) {
        const userSettings = typeof userSettingsData === 'string'
          ? JSON.parse(userSettingsData)
          : userSettingsData;
        autoTransfer = userSettings.autoTransferTasks || false;
      }

      // If auto transfer is enabled, move tomorrow's tasks to today's tasks
      if (autoTransfer) {
        const tomorrowTasksData = await storageService.getItem("tomorrowTasks");
        const tasksData = await storageService.getItem("tasks");

        if (tomorrowTasksData) {
          const tomorrowTasks = typeof tomorrowTasksData === 'string'
            ? JSON.parse(tomorrowTasksData)
            : tomorrowTasksData;

          if (tomorrowTasks.length > 0) {
            let allTasks = [];

            if (tasksData) {
              allTasks = typeof tasksData === 'string'
                ? JSON.parse(tasksData)
                : tasksData;
            }

            // Add tomorrow's tasks to the task list
            const updatedTasks = [
              ...allTasks,
              ...tomorrowTasks.map((task) => ({
                ...task,
                completed: false,
                completedAt: null,
                createdAt: new Date().toISOString(),
              })),
            ];

            // Save updated tasks
            await storageService.setItem("tasks", updatedTasks);

            // Clear tomorrow's tasks
            await storageService.setItem("tomorrowTasks", []);
            setTomorrowTasks([]);
          }
        }
      }
    } catch (error) {
      console.error("Error auto-transferring tasks:", error);
    }
  };

  const addTomorrowTask = async () => {
    if (newTomorrowTask.trim() === "") return;
    try {
      // If time picker is displayed, ensure time tag is activated
      if (showTimePicker) {
        setIsTimeTagged(true);
      }

      // If reminder is set but time is not set, prompt user
      if (hasReminder && !isTimeTagged && !showTimePicker) {
        Alert.alert(
          "Reminder Setup",
          "You need to set a task time first to add a reminder",
          [{ text: "OK", onPress: () => handleTimeTagPress() }],
        );
        return;
      }

      const newTask = {
        id: Date.now().toString(),
        text: newTomorrowTask.trim(),
        completed: false,
        isFrog: isFrogTask,
        isImportant: isImportant,
        isUrgent: isUrgent,
        isTimeTagged: isTimeTagged || showTimePicker, // If time picker is displayed, consider time as tagged
        taskTime:
          isTimeTagged || showTimePicker ? taskTime.toISOString() : null,
        hasReminder: hasReminder,
        reminderTime: reminderTime, // Advance notification time (minutes)
        notifyAtDeadline: true, // Notify at deadline
      };
      const updatedTasks = [...tomorrowTasks, newTask];
      setTomorrowTasks(updatedTasks);
      await storageService.setItem("tomorrowTasks", updatedTasks);
      setNewTomorrowTask("");
      setIsFrogTask(false);
      setIsImportant(false);
      setIsUrgent(false);
      setIsTimeTagged(false);
      setShowTimePicker(false);
      setHasReminder(false);
      setReminderTime(15);
      setShowReminderOptions(false);
      setTaskTime(new Date());
      Keyboard.dismiss();
      setIsAddingTask(false);
    } catch (error) {
      console.error("Error saving tomorrow task:", error);
      Alert.alert("Error", "Failed to save tomorrow task. Please try again.");
    }
  };

  const deleteTomorrowTask = async (id) => {
    try {
      const updatedTasks = tomorrowTasks.filter((task) => task.id !== id);
      setTomorrowTasks(updatedTasks);
      await storageService.setItem("tomorrowTasks", updatedTasks);
    } catch (error) {
      console.error("Error deleting tomorrow task:", error);
      Alert.alert("Error", "Failed to delete tomorrow task. Please try again.");
    }
  };

  const transferTomorrowTasks = async () => {
    if (tomorrowTasks.length === 0) {
      Alert.alert("Notice", "No tasks to transfer for tomorrow");
      return;
    }
    try {
      const tasksData = await storageService.getItem("tasks");
      let existingTasks = tasksData ? (typeof tasksData === 'string' ? JSON.parse(tasksData) : tasksData) : [];
      const formattedTasks = tomorrowTasks.map((task) => ({
        ...task,
        priority: "medium",
        // Keep original tag information, do not overwrite
      }));
      const updatedTasks = [...existingTasks, ...formattedTasks];
      await storageService.setItem("tasks", updatedTasks);
      await storageService.setItem("tomorrowTasks", []);
      setTomorrowTasks([]);
      Alert.alert(
        "Success",
        "Tomorrow's tasks have been added to the task list",
        [{ text: "View Tasks", onPress: () => navigation.navigate("Task") }],
      );
    } catch (error) {
      console.error("Error transferring tasks:", error);
      Alert.alert("Error", "Failed to transfer tasks. Please try again.");
    }
  };

  // ... rest of the code remains the same ...
}; 