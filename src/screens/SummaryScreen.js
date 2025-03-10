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
  Dimensions,
  LayoutAnimation,
  UIManager,
} from "react-native";
import {
  AntDesign,
  MaterialIcons,
  Ionicons,
  Feather,
  Octicons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
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

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults(AsyncStorage);
        if (settings.appTheme) {
          setAppTheme(settings.appTheme);
        }
      } catch (error) {
        console.error("Error loading user settings:", error);
      }
    };

    loadUserSettings();
  }, []);

  useEffect(() => {
    RNStatusBar.setHidden(true);
    return () => RNStatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    // Check if daily reset is needed
    checkDailyReset();
    loadData();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 启用 LayoutAnimation 在 Android 上
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  // 使用简化且更可靠的键盘事件处理
  useEffect(() => {
    const keyboardWillShowListener = Platform.OS === 'ios' 
      ? Keyboard.addListener('keyboardWillShow', e => {
          setKeyboardVisible(true);
          setKeyboardHeight(e.endCoordinates.height);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTimeout(() => scrollToAddTask(), 100);
        })
      : Keyboard.addListener('keyboardDidShow', e => {
          setKeyboardVisible(true);
          setKeyboardHeight(e.endCoordinates.height);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setTimeout(() => scrollToAddTask(), 100);
        });

    const keyboardWillHideListener = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        })
      : Keyboard.addListener('keyboardDidHide', () => {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // 专注于滚动到添加任务区域 - 优化版本
  const scrollToAddTask = () => {
    // 只有当滚动视图、容器引用和添加任务状态都有效时才执行
    if (scrollViewRef.current && addTaskContainerRef.current && isAddingTask) {
      // 为确保组件已正确渲染和测量，使用短延迟
      setTimeout(() => {
        if (addTaskContainerRef.current) {
          addTaskContainerRef.current.measure((x, y, width, height, pageX, pageY) => {
            // 计算任务输入区域相对于可见区域的位置
            const screenHeight = Dimensions.get('window').height;
            const keyboardSpaceHeight = keyboardHeight + (Platform.OS === 'ios' ? 40 : 20);
            const visibleAreaHeight = screenHeight - keyboardSpaceHeight;
            
            // 只有当输入区域被键盘遮挡时才滚动
            const inputBottom = pageY + height;
            if (inputBottom > visibleAreaHeight) {
              const scrollToY = Math.max(0, pageY - 120); // 给顶部留120px的空间
              
              scrollViewRef.current.scrollTo({
                y: scrollToY,
                animated: true
              });
            }
            // 否则保持当前位置不变
          });
        }
      }, 50);
    }
  };

  // 使组件在布局后自动测量
  useEffect(() => {
    if (isAddingTask && keyboardVisible) {
      scrollToAddTask();
    }
  }, [isAddingTask, keyboardVisible]);

  const checkDailyReset = async () => {
    try {
      // Check if daily reset is needed

      // Get current date
      const today = new Date().toISOString().split("T")[0];

      // Get last recorded date
      const lastDateJson = await AsyncStorage.getItem("lastDate");

      // If date is different or no date has been recorded, perform daily reset
      if (!lastDateJson || JSON.parse(lastDateJson) !== today) {
        await resetDailyPomodoroCount(
          lastDateJson ? JSON.parse(lastDateJson) : null
        );

        // Update last recorded date to today
        await AsyncStorage.setItem("lastDate", JSON.stringify(today));

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
      const pomodorosJson = await AsyncStorage.getItem("pomodoros");
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
      const userSettingsJson = await AsyncStorage.getItem("userSettings");
      let autoTransfer = false;

      if (userSettingsJson) {
        const userSettings = JSON.parse(userSettingsJson);
        autoTransfer = userSettings.autoTransferTasks || false;
      }

      // If auto transfer is enabled, move tomorrow's tasks to today's tasks
      if (autoTransfer) {
        const tomorrowTasksJson = await AsyncStorage.getItem("tomorrowTasks");
        const tasksJson = await AsyncStorage.getItem("tasks");

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
            await AsyncStorage.setItem("tasks", JSON.stringify(updatedTasks));

            // Clear tomorrow's tasks
            await AsyncStorage.setItem("tomorrowTasks", JSON.stringify([]));
            setTomorrowTasks([]);
          }
        }
      }
    } catch (error) {
      console.error("Error auto-transferring tasks:", error);
    }
  };

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Load task data
      const tasksJson = await AsyncStorage.getItem("tasks");
      let allTasks = [];

      // Process task data
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
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
        await AsyncStorage.setItem("tasks", JSON.stringify([]));
      }

      // Load meditation data (only load today's meditation time)
      const meditationSessionsJson =
        await AsyncStorage.getItem("meditationSessions");
      let todayMeditationMinutes = 0;
      if (meditationSessionsJson) {
        const meditationSessions = JSON.parse(meditationSessionsJson);
        const todaySessions = meditationSessions.filter(
          (session) => session.date === today
        );
        todayMeditationMinutes = todaySessions.reduce(
          (total, session) => total + session.duration,
          0
        );
      }
      setTotalMeditationMinutes(todayMeditationMinutes);

      // Load focus time data (only load today's focus time)
      const focusSessionsJson = await AsyncStorage.getItem("focusSessions");
      if (focusSessionsJson) {
        const focusSessions = JSON.parse(focusSessionsJson);
        const todaySessions = focusSessions.filter(
          (session) => session.date === today
        );
        const todayMinutes = todaySessions.reduce(
          (total, session) => total + Math.round(session.duration / 60),
          0
        );
        setTotalFocusMinutes(todayMinutes);
      } else {
        setTotalFocusMinutes(0);
      }

      // Load pomodoro count (only load today's pomodoro count)
      const pomodorosJson = await AsyncStorage.getItem("pomodoros");
      if (pomodorosJson) {
        const pomodoros = JSON.parse(pomodorosJson);
        // Filter today's pomodoro records
        const todayPomodoros = pomodoros.filter(
          (pomodoro) => pomodoro.date === today
        );
        // Set today's pomodoro count
        setPomodoroCount(todayPomodoros.length);
      } else {
        setPomodoroCount(0);
      }

      // Load tomorrow's tasks
      const tomorrowTasksJson = await AsyncStorage.getItem("tomorrowTasks");
      if (tomorrowTasksJson) {
        setTomorrowTasks(JSON.parse(tomorrowTasksJson));
      } else {
        // If no tomorrow task data, initialize as empty array
        setTomorrowTasks([]);
        await AsyncStorage.setItem("tomorrowTasks", JSON.stringify([]));
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
        notifyAtDeadline: true, // Notify at deadline
      };
      const updatedTasks = [...tomorrowTasks, newTask];
      setTomorrowTasks(updatedTasks);
      await AsyncStorage.setItem("tomorrowTasks", JSON.stringify(updatedTasks));
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
      await AsyncStorage.setItem("tomorrowTasks", JSON.stringify(updatedTasks));
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
      const tasksJson = await AsyncStorage.getItem("tasks");
      let existingTasks = tasksJson ? JSON.parse(tasksJson) : [];
      const formattedTasks = tomorrowTasks.map((task) => ({
        ...task,
        priority: "medium",
        // Keep original tag information, do not overwrite
      }));
      const updatedTasks = [...existingTasks, ...formattedTasks];
      await AsyncStorage.setItem("tasks", JSON.stringify(updatedTasks));
      await AsyncStorage.setItem("tomorrowTasks", JSON.stringify([]));
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
      // If time picker is already displayed, click to close picker and remove tag
      setShowTimePicker(false);
      setIsTimeTagged(false);
      // Also close reminder functionality
      setHasReminder(false);
      setShowReminderOptions(false);
    } else if (isTimeTagged) {
      // If there's already a time tag but picker is not displayed, click to remove tag
      setIsTimeTagged(false);
      setShowTimePicker(false);
      // Also close reminder functionality
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // If there's no time tag, click to display picker and activate tag
      // 先设置状态，再应用动画
      setShowTimePicker(true);
      setIsTimeTagged(true);
      
      // 使用LayoutAnimation使转换更平滑，但不滚动位置，保持当前所见即所得
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      // 删除这一行，不要自动滚动，保持当前可见区域
      // setTimeout(() => scrollToAddTask(), 100);
    }
  };

  // Handle reminder tag press
  const handleReminderPress = () => {
    // If time is not set, first prompt to set time
    if (!isTimeTagged && !showTimePicker) {
      Alert.alert(
        "Reminder Setup",
        "You need to set a task time first to add a reminder",
        [
          { text: "Set Time", onPress: () => handleTimeTagPress() },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    // 使用LayoutAnimation使转换更平滑
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (showReminderOptions) {
      // If options are displayed, hide options (but do not change reminder status)
      setShowReminderOptions(false);
    } else if (hasReminder) {
      // If reminder is already set, cancel reminder
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // If there's no reminder, display options and activate reminder status
      setShowReminderOptions(true);
      // Set default reminder time and activate
      setReminderTime(15);
      setHasReminder(true);
      // Close time picker when reminder options are displayed to avoid interface crowding
      setShowTimePicker(false);
      
      // 不需要滚动，保持当前视图位置不变
      // setTimeout(() => scrollToAddTask(), 100);
    }
  };

  // Select reminder time
  const selectReminderTime = (minutes) => {
    setReminderTime(minutes);
    setHasReminder(true);
    setShowReminderOptions(false);
    // 选择后更新布局但不滚动
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    </View>
  );

  // 简化滚动逻辑
  const scrollToInput = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
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
        contentContainerStyle={[
          styles.scrollContent, 
          {
            paddingBottom: keyboardVisible 
              ? keyboardHeight + (Platform.OS === 'ios' ? 140 : 80) 
              : 100
          }
        ]}
        keyboardShouldPersistTaps="handled"
        style={[
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100
        }}
      >
        <View style={styles.headerContainer}>
          <Text style={[styles.headerSubtitle, isLightTheme && styles.lightText]}>Today</Text>
          <Text style={[styles.dateText, isLightTheme && styles.lightText]}>
            {new Date().toLocaleDateString()}
          </Text>
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

        {/* Tomorrow's Plan */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Tomorrow's Plan</Text>
          {!isAddingTask ? (
            <TouchableOpacity
              style={styles.addTaskButton}
              onPress={() => {
                setIsAddingTask(true);
                // 延迟聚焦以让布局动画先执行
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 100);
              }}
            >
              <AntDesign name="plus" size={20} color="#CCCCCC" />
              <Text style={styles.addTaskText}>Add Tomorrow Task</Text>
            </TouchableOpacity>
          ) : (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "position" : null}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
              style={{ width: "100%" }}
              contentContainerStyle={{ flex: 1 }}
              enabled={Platform.OS === "ios"}
            >
              <View ref={addTaskContainerRef} style={styles.addTaskContainer}>
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
                  <View
                    style={[styles.timePickerContainer, { marginBottom: 20 }]}
                  >
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
            </KeyboardAvoidingView>
          )}

          {/* Tomorrow task list */}
          {tomorrowTasks.length > 0 ? (
            <>
              <FlatList
                data={tomorrowTasks}
                renderItem={({ item }) => (
                  <View style={styles.tomorrowTaskItem}>
                    <View style={styles.tomorrowTaskContent}>
                      <Text style={styles.tomorrowTaskText}>{item.text}</Text>
                      <View style={styles.taskTagsContainer}>
                        {item.isFrog && (
                          <View style={[styles.taskTag, styles.frogTag]}>
                            <FrogIcon width={14} height={14} fill="#FFFFFF" />
                          </View>
                        )}
                        {item.isImportant && (
                          <View style={[styles.taskTag, styles.importantTag]}>
                            <MaterialIcons
                              name="star"
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                        )}
                        {item.isUrgent && (
                          <View style={[styles.taskTag, styles.urgentTag]}>
                            <Feather
                              name="alert-circle"
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                        )}
                        {item.isTimeTagged && item.taskTime && (
                          <View style={[styles.taskTag, styles.timeTag]}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.taskTagText}>
                              {new Date(item.taskTime).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </Text>
                          </View>
                        )}
                        {item.hasReminder && (
                          <View style={[styles.taskTag, styles.reminderTag]}>
                            <MaterialIcons
                              name="notifications"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.taskTagText}>
                              {item.reminderTime} min
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => deleteTomorrowTask(item.id)}>
                      <AntDesign name="close" size={18} color="#666666" />
                    </TouchableOpacity>
                  </View>
                )}
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
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  headerContainer: {
    padding: 10,
    marginBottom: 10,
    borderBottomWidth: 0,
  },
  headerSubtitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: 2,
    textAlign: "center",
  },
  dateText: {
    color: "#aaa",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 0,
  },
  statsContainer: {
    marginBottom: 15,
    marginTop: 10,
  },
  statsCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statItem: {
    marginBottom: 15,
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
    marginBottom: 15,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 15,
    letterSpacing: 1,
  },
  taskItem: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
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
    alignItems: "center",
  },
  taskTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333333",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  frogTag: {
    backgroundColor: "#2E8B57", // Green background for frog tag
  },
  importantTag: {
    backgroundColor: "#3D2645", // Purple background for important tag
  },
  urgentTag: {
    backgroundColor: "#832232", // Red background for urgent tag
  },
  taskTagText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 4,
  },
  emptyText: {
    color: "#999999",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
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
    width: 36,
    height: 36,
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
  tomorrowTaskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
  },
  tomorrowTaskContent: {
    flex: 1,
  },
  tomorrowTaskText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 8,
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
    height: Platform.OS === "ios" ? 140 : 120,
  },
  timeTag: {
    backgroundColor: "#555555",
  },
  reminderTag: {
    backgroundColor: "#9C27B0",
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
});

export default SummaryScreen;