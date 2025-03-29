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
    defaultTime.setMinutes(30, 0, 0); // 设置默认分钟为30分
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

    // Animation effects removed as requested
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
        // 获取键盘高度
        const keyboardHeight = event.endCoordinates.height;
        scrollToInput(keyboardHeight);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        // 键盘隐藏时，可以选择滚动到特定位置或不做处理
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
    const datesArray = [];
    
    // Generate dates for the current month
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get first day of month
    const firstDay = new Date(currentYear, currentMonth, 1);
    
    // Get last day of month
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // Generate all dates in the current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(currentYear, currentMonth, i);
      datesArray.push(date);
    }
    
    setMonthDates(datesArray);
    
    // Set initial selected date to today
    setSelectedDate(today);
    
    // Calculate scroll position to show today in the middle
    // This will be used in a useEffect after render
  };
  
  // Reference for the dates ScrollView
  const datesScrollViewRef = useRef(null);
  
  // Effect to scroll to today when component mounts
  useEffect(() => {
    // Timeout to ensure the ScrollView has rendered
    setTimeout(() => {
      centerSelectedDate();
    }, 100);
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
    
    // Center the selected date in the scrollview
    setTimeout(() => {
      centerSelectedDate();
    }, 50);
  };
  
  // Function to center the selected date in the scrollview
  const centerSelectedDate = () => {
    if (datesScrollViewRef.current && monthDates.length > 0) {
      // Find index of selected date
      const selectedIndex = monthDates.findIndex(date => 
        date.getDate() === selectedDate.getDate() && 
        date.getMonth() === selectedDate.getMonth() && 
        date.getFullYear() === selectedDate.getFullYear()
      );
      
      if (selectedIndex !== -1) {
        // Calculate the item width (including margins)
        const itemWidth = 44; // width + margins
        
        // Estimate the visible width of the ScrollView
        const visibleWidth = 250; // Approximate visible width
        
        // Calculate position to center the selected date
        const scrollToX = Math.max(0, (selectedIndex * itemWidth) - (visibleWidth / 2) + (itemWidth / 2));
        
        // Scroll to the calculated position
        datesScrollViewRef.current.scrollTo({ x: scrollToX, animated: true });
      }
    }
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
    // 更新时间为当前小时和30分钟
    const currentTime = new Date();
    currentTime.setMinutes(30, 0, 0);
    setTaskTime(currentTime);
    
    if (showTimePicker) {
      // 如果时间选择器已经显示，点击后关闭选择器并取消标签
      setShowTimePicker(false);
      setIsTimeTagged(false);
      // 同时关闭提醒功能
      setHasReminder(false);
      setShowReminderOptions(false);
    } else if (isTimeTagged) {
      // 如果已经有时间标签但选择器未显示，点击后取消标签
      setIsTimeTagged(false);
      setShowTimePicker(false);
      // 同时关闭提醒功能
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // 如果没有时间标签，点击后显示选择器并激活标签
      setShowTimePicker(true);
      setIsTimeTagged(true);
      // 滚动到可见区域
      setTimeout(() => scrollToInput(), 100);
    }
  };

  // Handle reminder tag press
  const handleReminderPress = () => {
    // 如果没有设置时间，先提示设置时间
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
      // 如果选项已显示，则隐藏选项（但不更改提醒状态）
      setShowReminderOptions(false);
    } else if (hasReminder) {
      // 如果已有提醒，则取消提醒
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // 如果没有提醒，则显示选项并激活提醒状态
      setShowReminderOptions(true);
      // 设置默认提醒时间并激活
      setReminderTime(15);
      setHasReminder(true);
      // 显示提醒选项时关闭时间选择器，避免界面过于拥挤
      setShowTimePicker(false);
      // 滚动到可见区域
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
    // 给键盘弹出时间，再滚动
    setTimeout(() => {
      if (scrollViewRef.current && addTaskContainerRef.current) {
        // 测量添加任务容器在滚动视图中的位置
        addTaskContainerRef.current.measureLayout(
          scrollViewRef.current,
          (x, y, width, height) => {
            // 计算适当的滚动位置，确保元素与键盘顶部保持10px的距离
            const scrollPosition = y - 10; // 保持10px的距离
            scrollViewRef.current.scrollTo({
              y: scrollPosition,
              animated: true
            });
          },
          (error) => {
            console.error('测量布局时出错:', error);
            // 如果测量失败，回退到默认的scrollToEnd方法
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        );
      } else {
        // 如果引用不可用，回退到默认的scrollToEnd方法
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
            <View style={styles.monthDisplayContainer}>
              <Text style={styles.monthText}>
                {selectedDate.toLocaleString('default', { month: 'long' })} {selectedDate.getFullYear()}
              </Text>
            </View>
          </View>
          
          {/* Month date selection */}
          <View style={styles.dateSelectionContainer}>
            <TouchableOpacity 
              style={styles.dateNavigationButton}
              onPress={() => {
                // Handle previous day navigation
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() - 1);
                
                // If moving to previous month, regenerate dates
                if (newDate.getMonth() !== selectedDate.getMonth()) {
                  const newMonthDates = [];
                  const currentMonth = newDate.getMonth();
                  const currentYear = newDate.getFullYear();
                  
                  // Get last day of month
                  const lastDay = new Date(currentYear, currentMonth + 1, 0);
                  
                  // Generate all dates in the current month
                  for (let i = 1; i <= lastDay.getDate(); i++) {
                    const date = new Date(currentYear, currentMonth, i);
                    newMonthDates.push(date);
                  }
                  
                  setMonthDates(newMonthDates);
                }
                
                handleDateSelect(newDate);
              }}
            >
              <AntDesign name="left" size={18} color="#AAAAAA" />
            </TouchableOpacity>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datesScrollContent}
              ref={datesScrollViewRef}
            >
              {monthDates.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dateItem,
                    isSelected(date) && styles.selectedDateItem
                  ]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text style={[
                    styles.dateItemText,
                    isSelected(date) ? styles.selectedDateItemText : (isToday(date) ? styles.todayDateItemText : styles.dateItemText)
                  ]}>
                    {formatDateForDisplay(date)}
                  </Text>
                  
                  {/* Today indicator dot */}
                  {isToday(date) && !isSelected(date) && (
                    <View style={styles.todayIndicator} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.dateNavigationButton}
              onPress={() => {
                // Handle next day navigation
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() + 1);
                
                // Only allow selecting up to today
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                
                if (newDate <= today) {
                  // If moving to next month, regenerate dates
                  if (newDate.getMonth() !== selectedDate.getMonth()) {
                    const newMonthDates = [];
                    const currentMonth = newDate.getMonth();
                    const currentYear = newDate.getFullYear();
                    
                    // Get last day of month
                    const lastDay = new Date(currentYear, currentMonth + 1, 0);
                    
                    // Generate all dates in the current month
                    for (let i = 1; i <= lastDay.getDate(); i++) {
                      const date = new Date(currentYear, currentMonth, i);
                      newMonthDates.push(date);
                    }
                    
                    setMonthDates(newMonthDates);
                  }
                  
                  handleDateSelect(newDate);
                }
              }}
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
  },
  dateNavigationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#111", 
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  datesScrollContent: {
    paddingHorizontal: 5,
    flexGrow: 0,
  },
  dateItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
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
  todayDateItemText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  todayIndicator: {
    position: "absolute",
    bottom: -3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  monthDisplayContainer: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SummaryScreen;