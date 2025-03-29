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

const PRIORITY_COLORS = {
  high: "#666666", // Dark gray
  medium: "#999999", // Medium gray
  low: "#CCCCCC", // Light gray
};

const SummaryScreen = ({ navigation }) => {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completionRate, setCompletionRate] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);
  const [totalMeditationMinutes, setTotalMeditationMinutes] = useState(0);
  const [newTomorrowTask, setNewTomorrowTask] = useState("");
  const [tomorrowTasks, setTomorrowTasks] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [isFrogTask, setIsFrogTask] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isTimeTagged, setIsTimeTagged] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [reminderTime, setReminderTime] = useState(15);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [taskTime, setTaskTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setMinutes(30, 0, 0); // Set default minutes to 30
    return defaultTime;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [appTheme, setAppTheme] = useState("dark");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Added states for date navigation
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthDates, setMonthDates] = useState([]);
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const addTaskContainerRef = useRef(null);

  // Define isLightTheme based on appTheme
  const isLightTheme = appTheme === "light";

  // Get safe area insets
  const insets = useSafeAreaInsets();

  // Get status bar height for Android
  const STATUSBAR_HEIGHT =
    Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0;

  // Load settings
  const loadSettings = async () => {
    try {
      const settings = await getSettingsWithDefaults();
      
      // Set theme based on settings
      if (settings.appTheme) {
        setAppTheme(settings.appTheme);
      }
    } catch (error) {
      console.error("Error loading user settings:", error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    RNStatusBar.setHidden(true);
    return () => RNStatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    // Check if daily reset is needed
    checkDailyReset();
    loadData();
    generateMonthDates();

    // Fade-in animation when the screen loads
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Add effect to reload data when selected date changes
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Add keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        // Get keyboard height
        const keyboardHeight = event.endCoordinates.height;
        scrollToInput(keyboardHeight);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        // When keyboard hides, can choose to scroll to a specific position or do nothing
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Additional effect to scroll when specific UI elements change visibility
  useEffect(() => {
    if (showTimePicker || showReminderOptions) {
      setTimeout(() => scrollToInput(), 100);
    }
  }, [showTimePicker, showReminderOptions]);

  const checkDailyReset = async () => {
    try {
      // Check if daily reset is needed

      // Get current date
      const today = new Date().toISOString().split("T")[0];

      // Get last recorded date
      const lastDateJson = await storageService.getItem("lastDate");

      // If date is different or no date has been recorded, perform daily reset
      if (!lastDateJson || JSON.parse(lastDateJson) !== today) {
        await resetDailyPomodoroCount(
          lastDateJson ? JSON.parse(lastDateJson) : null
        );

        // Update last recorded date to today
        await storageService.setItem("lastDate", JSON.stringify(today));

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
      const pomodorosJson = await storageService.getItem("pomodoros");
      if (pomodorosJson) {
        const pomodoros = JSON.parse(pomodorosJson);
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
      const userSettingsJson = await storageService.getItem("userSettings");
      let autoTransfer = false;

      if (userSettingsJson) {
        const userSettings = JSON.parse(userSettingsJson);
        autoTransfer = userSettings.autoTransferTasks || false;
      }

      // If auto transfer is enabled, move tomorrow's tasks to today's tasks
      if (autoTransfer) {
        const tomorrowTasksJson = await storageService.getItem("tomorrowTasks");
        const tasksJson = await storageService.getItem("tasks");

        if (tomorrowTasksJson) {
          const tomorrowTasks = JSON.parse(tomorrowTasksJson);

          if (tomorrowTasks.length > 0) {
            let allTasks = [];

            if (tasksJson) {
              allTasks = JSON.parse(tasksJson);
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
            await storageService.setItem("tasks", JSON.stringify(updatedTasks));

            // Clear tomorrow's tasks
            await storageService.setItem("tomorrowTasks", JSON.stringify([]));
            setTomorrowTasks([]);
          }
        }
      }
    } catch (error) {
      console.error("Error auto-transferring tasks:", error);
    }
  };

  // Generate array of dates for the month with the selected date in the middle
  const generateMonthDates = () => {
    const today = new Date();
    
    // Generate 7 dates with today in the middle (3 days before, today, 3 days after)
    const datesArray = [];
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }
    
    setMonthDates(datesArray);
    
    // Set initial selected date to today
    setSelectedDate(today);
  };
  
  // Reference for the dates ScrollView
  const datesScrollViewRef = useRef(null);
  
  // Function to update visible dates based on selected date
  const updateVisibleDates = (centralDate) => {
    const datesArray = [];
    for (let i = -3; i <= 3; i++) {
      const date = new Date(centralDate);
      date.setDate(centralDate.getDate() + i);
      datesArray.push(date);
    }
    setMonthDates(datesArray);
  };
  
  // Function to center selected date in the scroll view
  const centerSelectedDate = (date) => {
    // No need for complex scrolling logic since we'll always show 7 dates
    // with selected date in the middle
  };
  
  // Show month selector modal
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  // Handle month selection
  const handleMonthSelect = (month, year) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(month);
    newDate.setFullYear(year);
    
    // If the day doesn't exist in the new month (e.g. Feb 30), adjust to last day
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (newDate.getDate() > lastDayOfMonth) {
      newDate.setDate(lastDayOfMonth);
    }
    
    // Update selected date and visible dates
    handleDateSelect(newDate);
    // Don't close the picker automatically when selecting month/year
  };
  
  // Function to handle the confirm button click in month picker
  const handleMonthPickerConfirm = () => {
    setShowMonthPicker(false);
  };
  
  // Effect to center selected date when dates change
  useEffect(() => {
    centerSelectedDate(selectedDate);
  }, [monthDates]);
  
  // Format date for display in date picker
  const formatDateForDisplay = (date) => {
    return date.getDate().toString();
  };
  
  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };
  
  // Check if date is selected
  const isSelected = (date) => {
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };
  
  // Handle date selection
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    
    // Check if selected date is today
    const isSelectedToday = isToday(date);
    setIsViewingHistory(!isSelectedToday);
    
    // Update visible dates with selected date in the middle
    updateVisibleDates(date);
  };

  // Update Today button in month picker modal
  const goToToday = () => {
    const today = new Date();
    
    // Update selected date
    setSelectedDate(today);
    setIsViewingHistory(false); // Today is not history
    
    // Update visible dates with today in the middle
    updateVisibleDates(today);
    
    // Close the modal
    setShowMonthPicker(false);
  };

  const loadData = async () => {
    try {
      // Use the selected date instead of today
      const selectedDateStr = selectedDate.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      // Load task data
      const tasksJson = await storageService.getItem("tasks");
      let allTasks = [];

      // Process task data
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
        
        // Filter completed and pending tasks for the selected date
        const selectedDateTasks = allTasks.filter((task) => {
          // If task has a completion time, check if it's on the selected date
          if (task.completedAt) {
            const completedDate = new Date(task.completedAt)
              .toISOString()
              .split("T")[0];
            return completedDate === selectedDateStr;
          }
          
          // For pending tasks, only show them for today
          return !task.completed && selectedDateStr === today;
        });

        const completed = selectedDateTasks.filter((task) => task.completed);
        const pending = selectedDateTasks.filter((task) => !task.completed);

        setCompletedTasks(completed);
        setPendingTasks(pending);

        // Calculate task completion rate (only consider selected date's tasks)
        const rate =
          selectedDateTasks.length > 0
            ? (completed.length / selectedDateTasks.length) * 100
            : 0;
        setCompletionRate(Math.round(rate));
      } else {
        // If no task data, initialize as empty array
        setCompletedTasks([]);
        setPendingTasks([]);
        setCompletionRate(0);
        // Create initial empty task array and save
        await storageService.setItem("tasks", JSON.stringify([]));
      }

      // Load meditation data (filter for selected date)
      const meditationSessionsJson =
        await storageService.getItem("meditationHistory");
      let selectedDateMeditationMinutes = 0;
      if (meditationSessionsJson) {
        const meditationSessions = JSON.parse(meditationSessionsJson);
        // Filter for selected date
        const selectedDateSessions = meditationSessions.filter(
          (session) => session.date.split('T')[0] === selectedDateStr
        );
        // Calculate total minutes
        selectedDateMeditationMinutes = selectedDateSessions.reduce(
          (total, session) => total + session.duration,
          0
        );
      }
      setTotalMeditationMinutes(selectedDateMeditationMinutes);

      // Load focus time data (filter for selected date)
      const focusHistoryJson = await storageService.getItem("focusHistory");
      if (focusHistoryJson) {
        const focusHistory = JSON.parse(focusHistoryJson);
        // Filter for selected date
        const selectedDateSessions = focusHistory.filter(
          (session) => 
            session.date.split('T')[0] === selectedDateStr && 
            !session.isBreak
        );
        
        // Calculate total focus minutes
        const selectedDateMinutes = selectedDateSessions.reduce(
          (total, session) => total + session.duration,
          0
        );
        setTotalFocusMinutes(selectedDateMinutes);
        
        // Calculate pomodoro session count
        setPomodoroCount(selectedDateSessions.length);
      } else {
        setTotalFocusMinutes(0);
        setPomodoroCount(0);
      }

      // Only load tomorrow's tasks when viewing today
      if (selectedDateStr === today) {
        const tomorrowTasksJson = await storageService.getItem("tomorrowTasks");
        if (tomorrowTasksJson) {
          setTomorrowTasks(JSON.parse(tomorrowTasksJson));
        } else {
          // If no tomorrow task data, initialize as empty array
          setTomorrowTasks([]);
          await storageService.setItem("tomorrowTasks", JSON.stringify([]));
        }
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
          [{ text: "OK", onPress: () => handleTimeTagPress() }]
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
        isRecurring: isRecurring, // Add recurring property
        notifyAtDeadline: true, // Notify at deadline
      };
      const updatedTasks = [...tomorrowTasks, newTask];
      setTomorrowTasks(updatedTasks);
      await storageService.setItem("tomorrowTasks", JSON.stringify(updatedTasks));
      setNewTomorrowTask("");
      setIsFrogTask(false);
      setIsImportant(false);
      setIsUrgent(false);
      setIsTimeTagged(false);
      setShowTimePicker(false);
      setHasReminder(false);
      setIsRecurring(false);
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
      await storageService.setItem("tomorrowTasks", JSON.stringify(updatedTasks));
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
      const tasksJson = await storageService.getItem("tasks");
      let existingTasks = tasksJson ? JSON.parse(tasksJson) : [];
      const formattedTasks = tomorrowTasks.map((task) => ({
        ...task,
        priority: "medium",
        // Keep original tag information, do not overwrite
      }));
      const updatedTasks = [...existingTasks, ...formattedTasks];
      await storageService.setItem("tasks", JSON.stringify(updatedTasks));
      await storageService.setItem("tomorrowTasks", JSON.stringify([]));
      setTomorrowTasks([]);
      Alert.alert(
        "Success",
        "Tomorrow's tasks have been added to the task list",
        [{ text: "View Tasks", onPress: () => navigation.navigate("Task") }]
      );
    } catch (error) {
      console.error("Error transferring tasks:", error);
      Alert.alert("Error", "Failed to transfer tasks. Please try again.");
    }
  };

  // Handle time change
  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (selectedTime) {
      setTaskTime(selectedTime);
      setIsTimeTagged(true);
    }
  };

  // Handle time tag press
  const handleTimeTagPress = () => {
    // Update time to current hour and 30 minutes
    const currentTime = new Date();
    currentTime.setMinutes(30, 0, 0);
    setTaskTime(currentTime);
    
    if (showTimePicker) {
      // If time picker is already displayed, clicking will close the picker and cancel the tag
      setShowTimePicker(false);
      setIsTimeTagged(false);
      // Also turn off reminder functionality
      setHasReminder(false);
      setShowReminderOptions(false);
    } else if (isTimeTagged) {
      // If there's already a time tag but picker is not displayed, clicking will cancel the tag
      setIsTimeTagged(false);
      setShowTimePicker(false);
      // Also turn off reminder functionality
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // If there's no time tag, clicking will display the picker and activate the tag
      setShowTimePicker(true);
      setIsTimeTagged(true);
      // Scroll to visible area
      setTimeout(() => scrollToInput(), 100);
    }
  };

  // Handle reminder tag press
  const handleReminderPress = () => {
    // If time is not set, prompt to set time first
    if (!isTimeTagged && !showTimePicker) {
      Alert.alert(
        "Reminder Setup",
        "You need to set a task time first to add a reminder",
        [
          { text: "Set Time", onPress: () => handleTimeTagPress() },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }
    
    if (showReminderOptions) {
      // If options are already displayed, hide them (but don't change reminder status)
      setShowReminderOptions(false);
    } else if (hasReminder) {
      // If there's already a reminder, cancel it
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // If there's no reminder, display options and activate reminder status
      setShowReminderOptions(true);
      // Set default reminder time and activate
      setReminderTime(15);
      setHasReminder(true);
      // Close time picker when showing reminder options to avoid cluttered UI
      setShowTimePicker(false);
      // Scroll to visible area
      setTimeout(() => scrollToInput(), 100);
    }
  };

  // Select reminder time
  const selectReminderTime = (minutes) => {
    setReminderTime(minutes);
    setHasReminder(true);
    setShowReminderOptions(false);
  };

  // Render tag buttons
  const renderTagButtons = () => (
    <View style={styles.tagButtonsContainer}>
      <TouchableOpacity
        style={[styles.tagButton, isFrogTask && styles.frogButtonActive]}
        onPress={() => setIsFrogTask(!isFrogTask)}
      >
        <FrogIcon
          width={18}
          height={18}
          fill={isFrogTask ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tagButton, isImportant && styles.tagButtonActive]}
        onPress={() => setIsImportant(!isImportant)}
      >
        <MaterialIcons
          name="star"
          size={18}
          color={isImportant ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tagButton, isUrgent && styles.tagButtonActive]}
        onPress={() => setIsUrgent(!isUrgent)}
      >
        <Feather
          name="alert-circle"
          size={18}
          color={isUrgent ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tagButton, isTimeTagged && styles.tagButtonActive]}
        onPress={handleTimeTagPress}
      >
        <Ionicons
          name="time-outline"
          size={18}
          color={isTimeTagged ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tagButton, hasReminder && styles.tagButtonActive]}
        onPress={handleReminderPress}
      >
        <MaterialIcons
          name="notifications"
          size={18}
          color={hasReminder ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tagButton, isRecurring && styles.tagButtonActive]}
        onPress={() => setIsRecurring(!isRecurring)}
      >
        <AntDesign
          name="reload1"
          size={18}
          color={isRecurring ? "#000000" : "#FFFFFF"}
        />
      </TouchableOpacity>
    </View>
  );

  // Add automatic scroll to input area function
  const scrollToInput = (keyboardHeight = 300) => {
    // Give time for keyboard to appear, then scroll
    setTimeout(() => {
      if (scrollViewRef.current && addTaskContainerRef.current) {
        // Measure the position of the add task container in the scroll view
        addTaskContainerRef.current.measureLayout(
          scrollViewRef.current,
          (x, y, width, height) => {
            // Calculate appropriate scroll position to ensure the element maintains 10px distance from keyboard top
            const scrollPosition = y - 10; // Maintain 10px distance
            scrollViewRef.current.scrollTo({
              y: scrollPosition,
              animated: true
            });
          },
          (error) => {
            console.error('Error measuring layout:', error);
            // If measurement fails, fall back to default scrollToEnd method
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        );
      } else {
        // If references are not available, fall back to default scrollToEnd method
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 300);
  };

  // Render tomorrow task
  const renderTomorrowTask = ({ item }) => (
    <View style={styles.tomorrowTask}>
      <View style={styles.tomorrowTaskTextContainer}>
        <Text style={styles.tomorrowTaskText}>{item.text}</Text>
        <View style={styles.taskTagsContainer}>
          {item.isFrog && (
            <View style={[styles.taskTag, styles.frogTag]}>
              <FrogIcon width={12} height={12} fill="#FFFFFF" />
              <Text style={styles.taskTagText}>Priority</Text>
            </View>
          )}
          {item.isImportant && (
            <View style={[styles.taskTag, styles.importantTag]}>
              <MaterialIcons name="star" size={12} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Important</Text>
            </View>
          )}
          {item.isUrgent && (
            <View style={[styles.taskTag, styles.urgentTag]}>
              <Feather name="alert-circle" size={12} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Urgent</Text>
            </View>
          )}
          {item.isTimeTagged && item.taskTime && (
            <View style={[styles.taskTag, styles.timeTag]}>
              <Ionicons name="time-outline" size={12} color="#FFFFFF" />
              <Text style={styles.taskTagText}>
                {new Date(item.taskTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
          {item.hasReminder && (
            <View style={[styles.taskTag, styles.reminderTag]}>
              <MaterialIcons name="notifications" size={12} color="#FFFFFF" />
              <Text style={styles.taskTagText}>{item.reminderTime} min</Text>
            </View>
          )}
          {item.isRecurring && (
            <View style={[styles.taskTag, styles.recurringTag]}>
              <AntDesign name="reload1" size={12} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Everyday</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTomorrowTask(item.id)}
      >
        <AntDesign name="close" size={16} color="#666666" />
      </TouchableOpacity>
    </View>
  );

  // Effect to scroll to initial position when month changes
  useEffect(() => {
    if (monthDates.length > 0 && datesScrollViewRef.current) {
      // Need a timeout to ensure the ScrollView has rendered
      setTimeout(() => {
        centerSelectedDate(selectedDate);
      }, 100);
    }
  }, [monthDates]);

  // Handle previous day navigation
  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 1);
    
    // Update selected date
    setSelectedDate(newDate);
    
    // Check if selected date is today
    const isSelectedToday = isToday(newDate);
    setIsViewingHistory(!isSelectedToday);
    
    // Update visible dates with selected date in the middle
    updateVisibleDates(newDate);
  };
  
  // Handle next day navigation
  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 1);
    
    // Only allow selecting up to today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (newDate <= today) {
      // Update selected date
      setSelectedDate(newDate);
      
      // Check if selected date is today
      const isSelectedToday = isToday(newDate);
      setIsViewingHistory(!isSelectedToday);
      
      // Update visible dates with selected date in the middle
      updateVisibleDates(newDate);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isLightTheme && styles.lightContainer,
        {
          paddingTop:
            Platform.OS === "android"
              ? STATUSBAR_HEIGHT + 40
              : insets.top > 0
              ? insets.top + 10
              : 20,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
        },
      ]}
    >
      <RNStatusBar hidden={true} />

      <CustomHeader
        title="SUMMARY"
        onBackPress={() => navigation.navigate("Home")}
        showBottomBorder={false}
      />

      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 300 }]}
        keyboardShouldPersistTaps="always"
        style={[
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={[styles.headerSubtitle, isLightTheme && styles.lightText]}>
              {isViewingHistory ? "History" : "Today"}
            </Text>
            
            {/* Month display */}
            <TouchableOpacity 
              style={styles.monthDisplayContainer}
              onPress={() => setShowMonthPicker(true)}
            >
              <View style={styles.monthDisplayContent}>
                <Text style={styles.monthText}>
                  {selectedDate.toLocaleString('default', { month: 'long' })} {selectedDate.getFullYear()}
                </Text>
                <AntDesign name="caretdown" size={10} color="#999999" style={styles.dropdownIcon} />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Month date selection */}
          <View style={styles.dateSelectionContainer}>
            <TouchableOpacity 
              style={styles.dateNavigationButton}
              onPress={handlePreviousDay}
            >
              <AntDesign name="left" size={18} color="#AAAAAA" />
            </TouchableOpacity>
            
            <View style={styles.datesContainer}>
              {monthDates.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateItem,
                    isSelected(date) && styles.selectedDateItem,
                    isToday(date) && !isSelected(date) && styles.todayDateItem
                  ]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text style={[
                    styles.dateItemText,
                    isSelected(date) ? styles.selectedDateItemText : 
                    (isToday(date) ? styles.todayDateItemText : styles.dateItemText)
                  ]}>
                    {formatDateForDisplay(date)}
                  </Text>
                  
                  {/* Today indicator dot - always show for today's date */}
                  {isToday(date) && (
                    <View style={styles.todayIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity 
              style={styles.dateNavigationButton}
              onPress={handleNextDay}
            >
              <AntDesign name="right" size={18} color="#AAAAAA" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statTitle}>Completion Rate</Text>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${completionRate}%` },
                  ]}
                />
                <Text style={styles.progressText}>{completionRate}%</Text>
              </View>
            </View>

            {/* Use horizontal layout container */}
            <View style={styles.statRowContainer}>
              {/* Meditation Time */}
              <View style={styles.statItemHalf}>
                <Text style={styles.statTitle}>Meditation</Text>
                <View style={styles.focusTimeContainer}>
                  <MaterialIcons
                    name="self-improvement"
                    size={22}
                    color="#CCCCCC"
                  />
                  <Text style={styles.focusTimeText}>
                    {totalMeditationMinutes} min
                  </Text>
                </View>
              </View>

              {/* Vertical divider */}
              <View style={styles.verticalDivider} />

              {/* Pomodoro Sessions */}
              <View style={styles.statItemHalf}>
                <Text style={styles.statTitle}>Pomodoros</Text>
                <View style={styles.focusTimeContainer}>
                  <MaterialIcons name="timer" size={22} color="#CCCCCC" />
                  <Text style={styles.focusTimeText}>
                    {pomodoroCount} sessions
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Completed Tasks */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Completed Tasks</Text>
          {completedTasks.length > 0 ? (
            <FlatList
              data={completedTasks}
              renderItem={({ item }) => (
                <View style={styles.taskItem}>
                  <View
                    style={[
                      styles.taskPriorityIndicator,
                      { backgroundColor: PRIORITY_COLORS[item.priority] },
                    ]}
                  />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskText}>{item.text}</Text>
                  </View>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color="#CCCCCC"
                  />
                </View>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>No tasks completed today</Text>
          )}
        </View>

        {/* Pending Tasks */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Pending Tasks</Text>
          {pendingTasks.length > 0 ? (
            <FlatList
              data={pendingTasks}
              renderItem={({ item }) => (
                <View style={styles.taskItem}>
                  <View
                    style={[
                      styles.taskPriorityIndicator,
                      { backgroundColor: PRIORITY_COLORS[item.priority] },
                    ]}
                  />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskText}>{item.text}</Text>
                  </View>
                </View>
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <Text style={styles.emptyText}>All tasks completed!</Text>
          )}
        </View>

        {/* Tomorrow's Plan - Only show when viewing today */}
        {!isViewingHistory && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Tomorrow's Plan</Text>
            {!isAddingTask ? (
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => {
                  setIsAddingTask(true);
                  setTimeout(() => {
                    inputRef.current?.focus();
                    scrollToInput();
                  }, 100);
                }}
              >
                <AntDesign name="plus" size={20} color="#CCCCCC" />
                <Text style={styles.addTaskText}>Add Tomorrow Task</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addTaskWrapperContainer}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "position" : null}
                  keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
                  style={{width: '100%'}}
                  enabled
                >
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 10 }}
                  >
                    <View 
                      ref={addTaskContainerRef}
                      style={styles.addTaskContainer}
                    >
                      <TextInput
                        ref={inputRef}
                        style={styles.taskInput}
                        placeholder="Enter task..."
                        placeholderTextColor="#666"
                        value={newTomorrowTask}
                        onChangeText={setNewTomorrowTask}
                        onSubmitEditing={addTomorrowTask}
                        keyboardAppearance="dark"
                      />
                      <View style={styles.tagButtonsRow}>
                        {renderTagButtons()}
                        <View style={styles.spacer} />
                        <TouchableOpacity
                          style={[styles.inputButton, styles.cancelButton]}
                          onPress={() => {
                            setIsAddingTask(false);
                            setNewTomorrowTask("");
                            Keyboard.dismiss();
                          }}
                        >
                          <AntDesign name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.inputButton, styles.saveButton]}
                          onPress={addTomorrowTask}
                        >
                          <AntDesign name="check" size={24} color="#000000" />
                        </TouchableOpacity>
                      </View>
                      {showTimePicker && (
                        <View style={[styles.timePickerContainer, { marginBottom: 20 }]}>
                          <CustomDateTimePicker
                            value={taskTime}
                            mode="time"
                            is24Hour={true}
                            display="spinner"
                            onChange={onTimeChange}
                            textColor="#FFFFFF"
                            themeVariant="dark"
                            style={styles.timePicker}
                            minuteInterval={15}
                          />
                        </View>
                      )}
                      {showReminderOptions && (
                        <View
                          style={[
                            styles.reminderOptionsContainer,
                            { marginBottom: 20 },
                          ]}
                          onLayout={() => scrollToInput()}
                        >
                          <Text style={styles.reminderOptionsTitle}>
                            Select Reminder Time
                          </Text>
                          <View style={styles.reminderButtonsContainer}>
                            <TouchableOpacity
                              style={[
                                styles.reminderButton,
                                reminderTime === 15 && styles.reminderButtonActive,
                              ]}
                              onPress={() => selectReminderTime(15)}
                            >
                              <Text
                                style={[
                                  styles.reminderButtonText,
                                  reminderTime === 15 &&
                                    styles.reminderButtonTextActive,
                                ]}
                              >
                                15 min
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.reminderButton,
                                reminderTime === 30 && styles.reminderButtonActive,
                              ]}
                              onPress={() => selectReminderTime(30)}
                            >
                              <Text
                                style={[
                                  styles.reminderButtonText,
                                  reminderTime === 30 &&
                                    styles.reminderButtonTextActive,
                                ]}
                              >
                                30 min
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.reminderButton,
                                reminderTime === 60 && styles.reminderButtonActive,
                              ]}
                              onPress={() => selectReminderTime(60)}
                            >
                              <Text
                                style={[
                                  styles.reminderButtonText,
                                  reminderTime === 60 &&
                                    styles.reminderButtonTextActive,
                                ]}
                              >
                                1 hour
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              </View>
            )}

            {/* Tomorrow task list */}
            {tomorrowTasks.length > 0 ? (
              <>
                <FlatList
                  data={tomorrowTasks}
                  renderItem={renderTomorrowTask}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
                <TouchableOpacity
                  style={styles.transferButton}
                  onPress={transferTomorrowTasks}
                >
                  <AntDesign name="swap" size={18} color="#000000" />
                  <Text style={styles.transferButtonText}>Move to Task List</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No tasks for tomorrow</Text>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* Month Picker Modal - Moved outside of ScrollView */}
      {showMonthPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Month</Text>
            
            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }).map((_, index) => {
                const year = selectedDate.getFullYear();
                const monthName = new Date(year, index).toLocaleString('default', { month: 'short' });
                const isCurrentMonth = index === selectedDate.getMonth();
                
                // Check if this month is in the future (for the current year)
                const isInFuture = year === new Date().getFullYear() && index > new Date().getMonth();
                // Check if this month is current month and year
                const isCurrentActualMonth = year === new Date().getFullYear() && index === new Date().getMonth();
                // Check if this month is in the past
                const isInPast = year < new Date().getFullYear() || 
                  (year === new Date().getFullYear() && index < new Date().getMonth());
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthGridItem,
                      isCurrentMonth && styles.selectedMonthItem,
                      isInFuture && styles.futureMonthItem,
                      isCurrentActualMonth && styles.currentActualMonthItem,
                      isInPast && styles.pastMonthItem
                    ]}
                    disabled={isInFuture}
                    onPress={() => handleMonthSelect(index, year)}
                  >
                    <Text style={[
                      styles.monthGridText,
                      isCurrentMonth && styles.selectedMonthText,
                      isInFuture && styles.futureMonthText,
                      isCurrentActualMonth && styles.currentActualMonthText,
                      isInPast && styles.pastMonthText
                    ]}>
                      {monthName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.yearSelector}>
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  selectedDate.getFullYear() - 1 === selectedDate.getFullYear() && styles.selectedYearItem
                ]}
                onPress={() => {
                  const year = selectedDate.getFullYear() - 1;
                  handleMonthSelect(selectedDate.getMonth(), year);
                }}
              >
                <Text style={[
                  styles.yearButtonText,
                  selectedDate.getFullYear() - 1 === selectedDate.getFullYear() && styles.selectedYearText,
                  selectedDate.getFullYear() - 1 === new Date().getFullYear() && styles.currentActualYearText,
                  selectedDate.getFullYear() - 1 < new Date().getFullYear() && styles.pastYearText,
                  selectedDate.getFullYear() - 1 > new Date().getFullYear() && styles.futureYearText
                ]}>
                  {selectedDate.getFullYear() - 1}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  styles.selectedYearItem
                ]}
              >
                <Text style={[
                  styles.selectedYearText,
                  selectedDate.getFullYear() === new Date().getFullYear() && styles.currentActualYearText
                ]}>
                  {selectedDate.getFullYear()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  selectedDate.getFullYear() + 1 === selectedDate.getFullYear() && styles.selectedYearItem,
                  // Disable if next year is in the future
                  selectedDate.getFullYear() >= new Date().getFullYear() && styles.disabledYearButton
                ]}
                disabled={selectedDate.getFullYear() >= new Date().getFullYear()}
                onPress={() => {
                  const year = selectedDate.getFullYear() + 1;
                  if (year <= new Date().getFullYear()) {
                    handleMonthSelect(selectedDate.getMonth(), year);
                  }
                }}
              >
                <Text style={[
                  styles.yearButtonText,
                  selectedDate.getFullYear() + 1 === selectedDate.getFullYear() && styles.selectedYearText,
                  selectedDate.getFullYear() + 1 === new Date().getFullYear() && styles.currentActualYearText,
                  selectedDate.getFullYear() + 1 < new Date().getFullYear() && styles.pastYearText,
                  selectedDate.getFullYear() + 1 > new Date().getFullYear() && styles.futureYearText
                ]}>
                  {selectedDate.getFullYear() + 1}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleMonthPickerConfirm}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={goToToday}
              >
                <Text style={styles.modalPrimaryText}>Today</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleMonthPickerConfirm}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  lightContainer: {
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerButton: {
    width: 24,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  scrollContent: {
    paddingTop: 5,
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  headerContainer: {
    padding: 5,
    marginBottom: 5,
    borderBottomWidth: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerSubtitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "left",
  },
  dateText: {
    color: "#aaa",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 0,
  },
  statsContainer: {
    marginBottom: 12,
    marginTop: 5,
  },
  statsCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statItem: {
    marginBottom: 12,
  },
  statTitle: {
    color: "#aaa",
    fontSize: 16,
    marginBottom: 8,
  },
  progressContainer: {
    height: 24,
    backgroundColor: "#222",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  progressBar: {
    height: 24,
    backgroundColor: "#CCCCCC", // Monochrome light gray
    borderRadius: 12,
  },
  progressText: {
    position: "absolute",
    right: 10,
    top: 2,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statDivider: {
    height: 0,
    backgroundColor: "transparent",
    marginVertical: 0,
  },
  focusTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  focusTimeText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
  },
  sectionContainer: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 1,
  },
  taskItem: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    alignItems: "center",
  },
  taskPriorityIndicator: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    color: "#fff",
    fontSize: 16,
  },
  taskTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  taskTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  taskTagText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginLeft: 4,
  },
  frogTag: {
    backgroundColor: "#2E8B57",
  },
  importantTag: {
    backgroundColor: "#3D2645",
  },
  urgentTag: {
    backgroundColor: "#832232",
  },
  emptyText: {
    color: "#999999",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
  },
  addTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  addTaskText: {
    color: "#CCCCCC",
    fontSize: 16,
    marginLeft: 8,
  },
  addTaskContainer: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  taskInput: {
    color: "#fff",
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingVertical: 8,
    marginBottom: 15,
  },
  tagButtonsContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  tagButton: {
    width: 30,
    height: 30,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#666666",
    marginRight: 10,
  },
  tagButtonActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  frogButtonActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 15,
  },
  tagButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  spacer: {
    flex: 1,
  },
  inputButton: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginLeft: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#333",
  },
  saveButton: {
    backgroundColor: "#FFFFFF",
  },
  tomorrowTask: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
  },
  tomorrowTaskTextContainer: {
    flex: 1,
  },
  tomorrowTaskText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
  },
  deleteButton: {
    padding: 5,
  },
  transferButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
    marginBottom: 20,
    justifyContent: "center",
  },
  transferButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  statRowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  statItemHalf: {
    flex: 1,
    paddingHorizontal: 10,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: "#333",
    alignSelf: "stretch",
  },
  timePickerContainer: {
    marginTop: 15,
    backgroundColor: "#222",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
  },
  timePicker: {
    width: Platform.OS === "ios" ? "100%" : 150,
    height: Platform.OS === "ios" ? 180 : 150,
  },
  timeTag: {
    backgroundColor: "#555555",
  },
  reminderTag: {
    backgroundColor: "#9C27B0",
  },
  recurringTag: {
    backgroundColor: "#3E4095", // Blue background for recurring "Everyday" tag
  },
  reminderOptionsContainer: {
    marginTop: 15,
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  reminderOptionsTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  reminderButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reminderButton: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
  },
  reminderButtonActive: {
    backgroundColor: "#FFFFFF",
  },
  reminderButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  reminderButtonTextActive: {
    color: "#000000",
  },
  addTaskWrapperContainer: {
    marginBottom: 20,
  },
  dateSelectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    width: "100%",
    paddingHorizontal: 0,
  },
  dateNavigationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#111", 
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 0,
  },
  datesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
    paddingHorizontal: 10,
  },
  dateItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginHorizontal: 0,
  },
  dateItemText: {
    color: "#AAAAAA",
    fontSize: 16,
    fontWeight: "500",
  },
  selectedDateItem: {
    backgroundColor: "#FFFFFF",
  },
  selectedDateItemText: {
    color: "#000000",
    fontWeight: "700",
  },
  todayDateItem: {
    backgroundColor: "transparent", // No background for today's date
  },
  todayDateItemText: {
    color: "#FFFFFF", // White text for today
    fontWeight: "900",  // Extra bold
  },
  todayIndicator: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    left: "50%",
    marginLeft: -4,
    zIndex: 2,
  },
  monthDisplayContainer: {
    padding: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#111",
    justifyContent: "center",
  },
  monthDisplayContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 5,
  },
  dropdownIcon: {
    marginTop: 2,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    width: "90%",
    overflow: "hidden",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 16,
  },
  monthGridItem: {
    width: "25%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderRadius: 6,
    marginHorizontal: 0,
  },
  monthGridText: {
    color: "#999999", // Medium shade for default
    fontSize: 16,
    fontWeight: "500",
  },
  selectedMonthItem: {
    backgroundColor: "transparent", // No background
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  selectedMonthText: {
    color: "#FFFFFF", // Brightest white for selected
    fontWeight: "700",
  },
  futureMonthItem: {
    backgroundColor: "transparent", // No background
  },
  futureMonthText: {
    color: "#555555", // Darkest shade for future
  },
  currentActualMonthItem: {
    backgroundColor: "transparent", // No background
  },
  currentActualMonthText: {
    color: "#DDDDDD", // Bright white for current month
    fontWeight: "700",
  },
  pastMonthItem: {
    backgroundColor: "transparent", // No background
  },
  pastMonthText: {
    color: "#999999", // Medium shade for past
  },
  yearSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    padding: 12,
  },
  yearButton: {
    padding: 8,
    width: 80,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "transparent", // No background
  },
  yearButtonText: {
    color: "#999999", // Medium shade
    fontSize: 16,
    fontWeight: "500",
  },
  selectedYearItem: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  selectedYearText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  currentActualYearText: {
    color: "#DDDDDD",
    fontWeight: "700",
  },
  pastYearText: {
    color: "#999999",
  },
  futureYearText: {
    color: "#555555",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  modalButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    width: 90, // Increase width to prevent text wrapping
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  modalPrimaryButton: {
    backgroundColor: "#555555", // Darker button
  },
  modalPrimaryText: {
    color: "#FFFFFF", // White text
    fontSize: 16,
    fontWeight: "600",
  },
  modalConfirmButton: {
    backgroundColor: "#FFFFFF",
  },
  modalConfirmText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledYearButton: {
    backgroundColor: "transparent", // No background
    opacity: 0.5,
  },
});

export default SummaryScreen;