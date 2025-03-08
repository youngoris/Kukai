import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  FlatList,
  TextInput,
  Alert,
  Keyboard,
  Animated,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { AntDesign, MaterialIcons, Ionicons, Feather, Octicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FrogIcon from '../../assets/frog.svg';
import CustomDateTimePicker from '../components/CustomDateTimePicker';

const PRIORITY_COLORS = {
  high: '#666666', // Dark gray
  medium: '#999999', // Medium gray
  low: '#CCCCCC', // Light gray
};

const SummaryScreen = ({ navigation }) => {
  const [completedTasks, setCompletedTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completionRate, setCompletionRate] = useState(0);
  const [totalFocusMinutes, setTotalFocusMinutes] = useState(0);
  const [totalMeditationMinutes, setTotalMeditationMinutes] = useState(0);
  const [newTomorrowTask, setNewTomorrowTask] = useState('');
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
  const [appTheme, setAppTheme] = useState('dark');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const addTaskContainerRef = useRef(null);

  // 检查是否为浅色主题
  const isLightTheme = appTheme === 'light';

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  useEffect(() => {
    // 检查是否需要每日重置
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

  // 添加键盘事件监听
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

  // 检查是否需要每日重置
  const checkDailyReset = async () => {
    try {
      // 获取当前日期
      const today = new Date().toISOString().split('T')[0];
      
      // 获取上次记录的日期
      const lastRecordedDate = await AsyncStorage.getItem('lastRecordedDate');
      
      // 如果日期不同或没有记录过日期，执行每日重置
      if (!lastRecordedDate || lastRecordedDate !== today) {
        console.log('Performing daily reset...');
        
        // 更新最后记录日期为今天
        await AsyncStorage.setItem('lastRecordedDate', today);
        
        // 重置番茄钟计数（保存历史记录，但重置当日计数）
        await resetDailyPomodoroCount(lastRecordedDate);
        
        // 可以在这里添加其他每日重置逻辑
        // 例如：将昨天未完成的任务标记为过期，或者转移到今天的任务中
        
        // 自动将昨天"明日计划"中的任务转移到今天的任务列表中
        await autoTransferTomorrowTasks();
      }
    } catch (error) {
      console.error('Error checking daily reset:', error);
    }
  };

  // 重置每日番茄钟计数
  const resetDailyPomodoroCount = async (lastDate) => {
    try {
      // 读取旧的番茄钟记录
      const pomodorosJson = await AsyncStorage.getItem('pomodoros');
      let pomodoros = [];
      
      if (pomodorosJson) {
        pomodoros = JSON.parse(pomodorosJson);
      }
      
      // 如果是新的一天，保存旧的记录并清空计数器
      // 注意：这里只是重置计数器，保留历史记录
      await AsyncStorage.setItem('pomodoros', JSON.stringify(pomodoros));
      
      // Reset today's pomodoro count (UI reset only, doesn't affect historical data)
      setPomodoroCount(0);
    } catch (error) {
      console.error('Error resetting pomodoro count:', error);
    }
  };

  // 自动将昨天"明日计划"中的任务转移到今天的任务列表中
  const autoTransferTomorrowTasks = async () => {
    try {
      const tomorrowTasksJson = await AsyncStorage.getItem('tomorrowTasks');
      if (tomorrowTasksJson && JSON.parse(tomorrowTasksJson).length > 0) {
        const tomorrowTasks = JSON.parse(tomorrowTasksJson);
        
        // 获取现有任务
        const tasksJson = await AsyncStorage.getItem('tasks');
        let existingTasks = tasksJson ? JSON.parse(tasksJson) : [];
        
        // 将明日任务添加到任务列表中
        const formattedTasks = tomorrowTasks.map((task) => ({
          ...task,
          priority: 'medium',
        }));
        
        const updatedTasks = [...existingTasks, ...formattedTasks];
        await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
        
        // 清空明日任务列表
        await AsyncStorage.setItem('tomorrowTasks', JSON.stringify([]));
        
        console.log('Automatically transferred tasks from tomorrow\'s plan to today\'s task list');
      }
    } catch (error) {
      console.error('Error automatically transferring tomorrow\'s tasks:', error);
    }
  };

  const loadData = async () => {
    try {
      // Get today's date string (format: YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // 加载任务数据
      const tasksJson = await AsyncStorage.getItem('tasks');
      let allTasks = [];
      
      // 处理任务数据
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
        // Filter tasks completed today and pending tasks
        const todayTasks = allTasks.filter((task) => {
          // If task has completion time, check if it was completed today
          if (task.completedAt) {
            const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
            return completedDate === today;
          }
          // For incomplete tasks, display all by default
          return !task.completed;
        });
        
        const completed = todayTasks.filter((task) => task.completed);
        const pending = todayTasks.filter((task) => !task.completed);
        
        setCompletedTasks(completed);
        setPendingTasks(pending);
        
        // Calculate today's task completion rate (considering only today's tasks)
        const rate = todayTasks.length > 0 ? (completed.length / todayTasks.length) * 100 : 0;
        setCompletionRate(Math.round(rate));
      } else {
        // If no task data exists, initialize with empty arrays
        setCompletedTasks([]);
        setPendingTasks([]);
        setCompletionRate(0);
        // Create initial empty task array and save
        await AsyncStorage.setItem('tasks', JSON.stringify([]));
      }

      // Load meditation data (only today's meditation time)
      const meditationSessionsJson = await AsyncStorage.getItem('meditationSessions');
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

      // Load focus time data (only today's focus time)
      const focusSessionsJson = await AsyncStorage.getItem('focusSessions');
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

      // Load pomodoro count (only today's pomodoros)
      const pomodorosJson = await AsyncStorage.getItem('pomodoros');
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
      const tomorrowTasksJson = await AsyncStorage.getItem('tomorrowTasks');
      if (tomorrowTasksJson) {
        setTomorrowTasks(JSON.parse(tomorrowTasksJson));
      } else {
        // If no tomorrow's tasks data, initialize as empty array
        setTomorrowTasks([]);
        await AsyncStorage.setItem('tomorrowTasks', JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // 显示友好的错误消息并提供重试选项
      Alert.alert(
        'Data Loading Error',
        'Unable to load summary data.',
        [
          { 
            text: 'Retry', 
            onPress: () => loadData() 
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const addTomorrowTask = async () => {
    if (newTomorrowTask.trim() === '') return;
    try {
      // 如果显示了时间选择器，确保时间标签被激活
      if (showTimePicker) {
        setIsTimeTagged(true);
      }
      
      // 如果设置了提醒但没有设置时间，提示用户
      if (hasReminder && !isTimeTagged && !showTimePicker) {
        Alert.alert(
          "Reminder Setup",
          "You need to set a task time first to add a reminder",
          [
            { text: "OK", onPress: () => handleTimeTagPress() }
          ]
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
        taskTime: (isTimeTagged || showTimePicker) ? taskTime.toISOString() : null,
        hasReminder: hasReminder,
        reminderTime: reminderTime, // Advance notification time (minutes)
        notifyAtDeadline: true, // Notify at deadline
      };
      const updatedTasks = [...tomorrowTasks, newTask];
      setTomorrowTasks(updatedTasks);
      await AsyncStorage.setItem('tomorrowTasks', JSON.stringify(updatedTasks));
      setNewTomorrowTask('');
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
      console.error('Error saving tomorrow task:', error);
      Alert.alert('Error', 'Failed to save tomorrow task. Please try again.');
    }
  };

  const deleteTomorrowTask = async (id) => {
    try {
      const updatedTasks = tomorrowTasks.filter((task) => task.id !== id);
      setTomorrowTasks(updatedTasks);
      await AsyncStorage.setItem('tomorrowTasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.error('Error deleting tomorrow task:', error);
      Alert.alert('Error', 'Failed to delete tomorrow task. Please try again.');
    }
  };

  const transferTomorrowTasks = async () => {
    if (tomorrowTasks.length === 0) {
      Alert.alert('Notice', 'No tasks to transfer for tomorrow');
      return;
    }
    try {
      const tasksJson = await AsyncStorage.getItem('tasks');
      let existingTasks = tasksJson ? JSON.parse(tasksJson) : [];
      const formattedTasks = tomorrowTasks.map((task) => ({
        ...task,
        priority: 'medium',
        // 保留原有的标签信息，不覆盖
      }));
      const updatedTasks = [...existingTasks, ...formattedTasks];
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      await AsyncStorage.setItem('tomorrowTasks', JSON.stringify([]));
      setTomorrowTasks([]);
      Alert.alert('Success', 'Tomorrow\'s tasks have been added to the task list', [
        { text: 'View Tasks', onPress: () => navigation.navigate('Task') },
      ]);
    } catch (error) {
      console.error('Error transferring tasks:', error);
      Alert.alert('Error', 'Failed to transfer tasks. Please try again.');
    }
  };

  // 处理时间变更
  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedTime) {
      setTaskTime(selectedTime);
      setIsTimeTagged(true);
    }
  };

  // 处理时间标签点击
  const handleTimeTagPress = () => {
    // Update time to current hour and 30 minutes
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

  // 处理提醒标签点击
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

  // 选择提醒时间
  const selectReminderTime = (minutes) => {
    setReminderTime(minutes);
    setHasReminder(true);
    setShowReminderOptions(false);
  };

  // 渲染标签按钮
  const renderTagButtons = () => (
    <View style={styles.tagButtonsContainer}>
      <TouchableOpacity
        style={[
          styles.tagButton,
          isFrogTask && styles.frogButtonActive,
        ]}
        onPress={() => setIsFrogTask(!isFrogTask)}
      >
        <FrogIcon 
          width={18} 
          height={18} 
          fill={isFrogTask ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.tagButton,
          isImportant && styles.tagButtonActive,
        ]}
        onPress={() => setIsImportant(!isImportant)}
      >
        <MaterialIcons 
          name="star" 
          size={18} 
          color={isImportant ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.tagButton,
          isUrgent && styles.tagButtonActive,
        ]}
        onPress={() => setIsUrgent(!isUrgent)}
      >
        <Feather 
          name="alert-circle" 
          size={18} 
          color={isUrgent ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tagButton,
          isTimeTagged && styles.tagButtonActive,
        ]}
        onPress={handleTimeTagPress}
      >
        <Ionicons 
          name="time-outline" 
          size={18} 
          color={isTimeTagged ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tagButton,
          hasReminder && styles.tagButtonActive,
        ]}
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

  // 添加自动滚动到输入区域的函数
  const scrollToInput = (keyboardHeight = 300) => {
    // 给键盘弹出时间，再滚动
    setTimeout(() => {
      if (scrollViewRef.current && addTaskContainerRef.current) {
        // 测量添加任务容器在滚动视图中的位置
        addTaskContainerRef.current.measureLayout(
          scrollViewRef.current,
          (x, y, width, height) => {
            // Calculate appropriate scroll position, ensuring the element maintains a 10px distance from the keyboard top
            const scrollPosition = y - 10; // Maintain 10px distance
            scrollViewRef.current.scrollTo({
              y: scrollPosition,
              animated: true
            });
          },
          (error) => {
            console.error('Error measuring layout:', error);
            // If reference is unavailable, fall back to the default scrollToEnd method
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }
        );
      } else {
        // If reference is unavailable, fall back to the default scrollToEnd method
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 300);
  };

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settingsData = await AsyncStorage.getItem('userSettings');
        if (settingsData) {
          const parsedSettings = JSON.parse(settingsData);
          if (parsedSettings.appTheme) {
            setAppTheme(parsedSettings.appTheme);
          }
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  return (
    <SafeAreaView style={[styles.container, isLightTheme && styles.lightContainer]}>
      <StatusBar barStyle={isLightTheme ? "dark-content" : "light-content"} />
      <View style={[styles.header, isLightTheme && styles.lightHeader]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={isLightTheme ? "#000000" : "#FFFFFF"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isLightTheme && styles.lightHeaderTitle]}>SUMMARY</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        ref={scrollViewRef}
      >
        <View style={styles.content}>
          {/* Stats Card */}
          <View style={styles.statsContainer}>
            <View style={[styles.statsCard, isLightTheme && styles.lightStatsCard]}>
              <View style={styles.statItem}>
                <Text style={[styles.statTitle, isLightTheme && styles.lightStatTitle]}>Completion Rate</Text>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${completionRate}%` }]} />
                  <Text style={[styles.progressText, isLightTheme && styles.lightProgressText]}>{completionRate}%</Text>
                </View>
              </View>
              
              <View style={[styles.statDivider, isLightTheme && styles.lightStatDivider]} />
              
              {/* 使用水平布局容器 */}
              <View style={styles.statRowContainer}>
                {/* 冥想时间 */}
                <View style={styles.statItemHalf}>
                  <Text style={[styles.statTitle, isLightTheme && styles.lightStatTitle]}>Meditation</Text>
                  <View style={styles.focusTimeContainer}>
                    <MaterialIcons name="self-improvement" size={22} color={isLightTheme ? "#333333" : "#CCCCCC"} />
                    <Text style={[styles.focusTimeText, isLightTheme && styles.lightFocusTimeText]}>{totalMeditationMinutes} min</Text>
                  </View>
                </View>
                
                {/* 垂直分隔线 */}
                <View style={[styles.verticalDivider, isLightTheme && styles.lightVerticalDivider]} />
                
                {/* 番茄钟会话 */}
                <View style={styles.statItemHalf}>
                  <Text style={[styles.statTitle, isLightTheme && styles.lightStatTitle]}>Pomodoros</Text>
                  <View style={styles.focusTimeContainer}>
                    <MaterialIcons name="timer" size={22} color={isLightTheme ? "#333333" : "#CCCCCC"} />
                    <Text style={[styles.focusTimeText, isLightTheme && styles.lightFocusTimeText]}>{pomodoroCount} sessions</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Completed Tasks */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, isLightTheme && styles.lightSectionTitle]}>Completed Tasks</Text>
            {completedTasks.length > 0 ? (
              <FlatList
                data={completedTasks}
                renderItem={({ item }) => (
                  <View style={[styles.taskItem, isLightTheme && styles.lightTaskItem]}>
                    <View
                      style={[styles.taskPriorityIndicator, { backgroundColor: PRIORITY_COLORS[item.priority] }]}
                    />
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskText, isLightTheme && styles.lightTaskText]}>{item.text}</Text>
                    </View>
                    <MaterialIcons name="check-circle" size={20} color={isLightTheme ? "#333333" : "#CCCCCC"} />
                  </View>
                )}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={[styles.emptyText, isLightTheme && styles.lightEmptyText]}>No tasks completed today</Text>
            )}
          </View>

          {/* Pending Tasks */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, isLightTheme && styles.lightSectionTitle]}>Pending Tasks</Text>
            {pendingTasks.length > 0 ? (
              <FlatList
                data={pendingTasks}
                renderItem={({ item }) => (
                  <View style={[styles.taskItem, isLightTheme && styles.lightTaskItem]}>
                    <View
                      style={[styles.taskPriorityIndicator, { backgroundColor: PRIORITY_COLORS[item.priority] }]}
                    />
                    <View style={styles.taskContent}>
                      <Text style={[styles.taskText, isLightTheme && styles.lightTaskText]}>{item.text}</Text>
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <Text style={[styles.emptyText, isLightTheme && styles.lightEmptyText]}>All tasks completed!</Text>
            )}
          </View>

          {/* Tomorrow's Plan */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, isLightTheme && styles.lightSectionTitle]}>Tomorrow's Plan</Text>
            {!isAddingTask ? (
              <TouchableOpacity
                style={[styles.addTaskButton, isLightTheme && styles.lightAddTaskButton]}
                onPress={() => {
                  setIsAddingTask(true);
                }}
              >
                <AntDesign name="plus" size={20} color={isLightTheme ? "#333333" : "#FFFFFF"} />
                <Text style={[styles.addTaskText, isLightTheme && styles.lightAddTaskText]}>Add task for tomorrow</Text>
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
                            setNewTomorrowTask('');
                            setIsFrogTask(false);
                            setIsImportant(false);
                            setIsUrgent(false);
                            setIsTimeTagged(false);
                            setShowTimePicker(false);
                            setHasReminder(false);
                            setShowReminderOptions(false);
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
                        <View style={[styles.reminderOptionsContainer, { marginBottom: 20 }]}>
                          <Text style={styles.reminderOptionsTitle}>Select Reminder Time</Text>
                          <View style={styles.reminderButtonsContainer}>
                            <TouchableOpacity
                              style={[styles.reminderButton, reminderTime === 15 && styles.reminderButtonActive]}
                              onPress={() => selectReminderTime(15)}
                            >
                              <Text style={[styles.reminderButtonText, reminderTime === 15 && styles.reminderButtonTextActive]}>15 min</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reminderButton, reminderTime === 30 && styles.reminderButtonActive]}
                              onPress={() => selectReminderTime(30)}
                            >
                              <Text style={[styles.reminderButtonText, reminderTime === 30 && styles.reminderButtonTextActive]}>30 min</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.reminderButton, reminderTime === 60 && styles.reminderButtonActive]}
                              onPress={() => selectReminderTime(60)}
                            >
                              <Text style={[styles.reminderButtonText, reminderTime === 60 && styles.reminderButtonTextActive]}>1 hour</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              </View>
            )}
            
            {/* 明日任务列表 */}
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
                              <MaterialIcons name="star" size={14} color="#FFFFFF" />
                            </View>
                          )}
                          {item.isUrgent && (
                            <View style={[styles.taskTag, styles.urgentTag]}>
                              <Feather name="alert-circle" size={14} color="#FFFFFF" />
                            </View>
                          )}
                          {item.isTimeTagged && item.taskTime && (
                            <View style={[styles.taskTag, styles.timeTag]}>
                              <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                              <Text style={styles.taskTagText}>
                                {new Date(item.taskTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </Text>
                            </View>
                          )}
                          {item.hasReminder && (
                            <View style={[styles.taskTag, styles.reminderTag]}>
                              <MaterialIcons name="notifications" size={14} color="#FFFFFF" />
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
                <TouchableOpacity style={styles.transferButton} onPress={transferTomorrowTasks}>
                  <AntDesign name="swap" size={18} color="#000000" />
                  <Text style={styles.transferButtonText}>Move to Task List</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No tasks for tomorrow</Text>
            )}
          </View>
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
  lightContainer: {
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  lightHeader: {
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    position: 'absolute',
    left: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  lightHeaderTitle: {
    color: '#333',
  },
  statsCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    margin: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lightStatsCard: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
  },
  statItem: {
    marginBottom: 15,
  },
  statTitle: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 10,
  },
  lightStatTitle: {
    color: '#666',
  },
  progressContainer: {
    height: 20,
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
  },
  lightProgressContainer: {
    backgroundColor: '#e0e0e0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    position: 'absolute',
    right: 10,
    top: 0,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  lightProgressText: {
    color: '#333',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#333',
  },
  lightStatDivider: {
    backgroundColor: '#e0e0e0',
  },
  statRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItemHalf: {
    flex: 1,
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 15,
  },
  lightVerticalDivider: {
    backgroundColor: '#e0e0e0',
  },
  focusTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  focusTimeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  lightFocusTimeText: {
    color: '#333',
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  lightSectionTitle: {
    color: '#333',
  },
  taskItem: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lightTaskItem: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskPriorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  lightTaskText: {
    color: '#333',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  lightEmptyText: {
    color: '#999',
  },
  addTaskButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  lightAddTaskButton: {
    backgroundColor: '#e0e0e0',
  },
  addTaskText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  lightAddTaskText: {
    color: '#333',
  },
  addTaskContainer: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  taskInput: {
    color: '#fff',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 8,
    marginBottom: 15,
  },
  inputButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  inputButton: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginLeft: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#FFFFFF', // Changed to white
  },
  inputButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tomorrowTaskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
  },
  tomorrowTaskContent: {
    flex: 1,
  },
  tomorrowTaskText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#FFFFFF', // Changed to white
    marginTop: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  transferButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  tagButtonsContainer: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'space-between',
  },
  tagButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  tagButtonActive: {
    backgroundColor: '#4CAF50',
  },
  frogButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 15,
  },
  tagButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  spacer: {
    flex: 1,
  },
  timePickerContainer: {
    marginTop: 15,
    backgroundColor: '#222',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20, // Increase bottom margin to create more space between buttons and border
  },
  timePicker: {
    width: Platform.OS === 'ios' ? '100%' : 150,
    height: Platform.OS === 'ios' ? 140 : 120,
  },
  timeTag: {
    backgroundColor: '#555555', // 时间标签的灰色背景
  },
  reminderTag: {
    backgroundColor: '#9C27B0', // 紫色背景
  },
  reminderOptionsContainer: {
    marginTop: 15,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20, // Increase bottom margin to create more space between buttons and border
  },
  reminderOptionsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  reminderButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reminderButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  reminderButtonActive: {
    backgroundColor: '#FFFFFF', // Changed to white background
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  reminderButtonTextActive: {
    color: '#000000', // Text is black when active
  },
});

export default SummaryScreen;