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
import { AntDesign, MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FrogIcon from './assets/frog.svg';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    defaultTime.setMinutes(30, 0, 0); // 设置默认分钟为30分
    return defaultTime;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const addTaskContainerRef = useRef(null);

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
        console.log('执行每日重置...');
        
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
      console.error('检查每日重置时出错:', error);
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
      
      // 重置当日番茄钟计数（这里只是UI上的重置，不影响历史数据）
      setPomodoroCount(0);
    } catch (error) {
      console.error('重置番茄钟计数时出错:', error);
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
        
        console.log('已自动将明日计划中的任务转移到今天的任务列表');
      }
    } catch (error) {
      console.error('自动转移明日任务时出错:', error);
    }
  };

  const loadData = async () => {
    try {
      // 获取今天的日期字符串（格式：YYYY-MM-DD）
      const today = new Date().toISOString().split('T')[0];
      
      // 加载任务数据
      const tasksJson = await AsyncStorage.getItem('tasks');
      let allTasks = [];
      
      // 处理任务数据
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
        // 筛选今天完成的任务和今天未完成的任务
        const todayTasks = allTasks.filter((task) => {
          // 如果任务有完成时间，检查是否是今天完成的
          if (task.completedAt) {
            const completedDate = new Date(task.completedAt).toISOString().split('T')[0];
            return completedDate === today;
          }
          // 对于未完成的任务，默认显示所有未完成任务
          return !task.completed;
        });
        
        const completed = todayTasks.filter((task) => task.completed);
        const pending = todayTasks.filter((task) => !task.completed);
        
        setCompletedTasks(completed);
        setPendingTasks(pending);
        
        // 计算今日任务完成率（只考虑今天的任务）
        const rate = todayTasks.length > 0 ? (completed.length / todayTasks.length) * 100 : 0;
        setCompletionRate(Math.round(rate));
      } else {
        // 如果没有任务数据，初始化为空数组
        setCompletedTasks([]);
        setPendingTasks([]);
        setCompletionRate(0);
        // 创建初始空任务数组并保存
        await AsyncStorage.setItem('tasks', JSON.stringify([]));
      }

      // 加载冥想数据（只加载今天的冥想时间）
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

      // 加载专注时间数据（只加载今天的专注时间）
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

      // 加载番茄钟数量（只加载今天的番茄钟数量）
      const pomodorosJson = await AsyncStorage.getItem('pomodoros');
      if (pomodorosJson) {
        const pomodoros = JSON.parse(pomodorosJson);
        // 筛选今天的番茄钟记录
        const todayPomodoros = pomodoros.filter(
          (pomodoro) => pomodoro.date === today
        );
        // 设置今天的番茄钟数量
        setPomodoroCount(todayPomodoros.length);
      } else {
        setPomodoroCount(0);
      }

      // 加载明天的任务
      const tomorrowTasksJson = await AsyncStorage.getItem('tomorrowTasks');
      if (tomorrowTasksJson) {
        setTomorrowTasks(JSON.parse(tomorrowTasksJson));
      } else {
        // 如果没有明天任务数据，初始化为空数组
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
        isTimeTagged: isTimeTagged || showTimePicker, // 如果时间选择器显示，则认为已标记时间
        taskTime: (isTimeTagged || showTimePicker) ? taskTime.toISOString() : null,
        hasReminder: hasReminder,
        reminderTime: reminderTime, // 提前通知时间（分钟）
        notifyAtDeadline: true, // 在截止时间到达时通知
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SUMMARY</Text>
          <View style={styles.headerButton} />
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          style={[
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: slideAnim }] 
            }
          ]}
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.headerSubtitle}>Today</Text>
            <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
          </View>
          
          {/* Daily Statistics */}
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statTitle}>Completion Rate</Text>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${completionRate}%` }]} />
                  <Text style={styles.progressText}>{completionRate}%</Text>
                </View>
              </View>
              
              <View style={styles.statDivider} />
              
              {/* 使用水平布局容器 */}
              <View style={styles.statRowContainer}>
                {/* 冥想时间 */}
                <View style={styles.statItemHalf}>
                  <Text style={styles.statTitle}>Meditation</Text>
                  <View style={styles.focusTimeContainer}>
                    <MaterialIcons name="self-improvement" size={22} color="#CCCCCC" />
                    <Text style={styles.focusTimeText}>{totalMeditationMinutes} min</Text>
                  </View>
                </View>
                
                {/* 垂直分隔线 */}
                <View style={styles.verticalDivider} />
                
                {/* 番茄钟会话 */}
                <View style={styles.statItemHalf}>
                  <Text style={styles.statTitle}>Pomodoros</Text>
                  <View style={styles.focusTimeContainer}>
                    <MaterialIcons name="timer" size={22} color="#CCCCCC" />
                    <Text style={styles.focusTimeText}>{pomodoroCount} sessions</Text>
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
                      style={[styles.taskPriorityIndicator, { backgroundColor: PRIORITY_COLORS[item.priority] }]}
                    />
                    <View style={styles.taskContent}>
                      <Text style={styles.taskText}>{item.text}</Text>
                    </View>
                    <MaterialIcons name="check-circle" size={20} color="#CCCCCC" />
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
                      style={[styles.taskPriorityIndicator, { backgroundColor: PRIORITY_COLORS[item.priority] }]}
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
                          <DateTimePicker
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
        </Animated.ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerButton: {
    width: 24,
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  headerContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerSubtitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 2,
    textAlign: 'center',
  },
  dateText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statItem: {
    marginBottom: 20,
  },
  statTitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 10,
  },
  progressContainer: {
    height: 24,
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: 24,
    backgroundColor: '#CCCCCC', // Monochrome light gray
    borderRadius: 12,
  },
  progressText: {
    position: 'absolute',
    right: 10,
    top: 2,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 20,
  },
  focusTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  focusTimeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    marginTop: 20,
    letterSpacing: 1,
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
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
    color: '#fff',
    fontSize: 16,
  },
  taskTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  frogTag: {
    backgroundColor: '#2E8B57', // 青蛙标签的绿色背景
  },
  importantTag: {
    backgroundColor: '#3D2645', // 重要标签的紫色背景
  },
  urgentTag: {
    backgroundColor: '#832232', // 紧急标签的红色背景
  },
  taskTagText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  emptyText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  addTaskText: {
    color: '#CCCCCC',
    fontSize: 16,
    marginLeft: 8,
  },
  addTaskContainer: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
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
    backgroundColor: '#FFFFFF', // 改为白色
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
    backgroundColor: '#FFFFFF', // 改为白色
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
  statRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItemHalf: {
    flex: 1,
    paddingHorizontal: 10,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#333',
    alignSelf: 'stretch',
  },
  tagButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  tagButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#666666',
    marginRight: 10,
  },
  tagButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
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
    marginBottom: 20, // 增加底部边距，使按钮与边框距离更大
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
    marginBottom: 20, // 增加底部边距，使按钮与边框距离更大
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
    backgroundColor: '#FFFFFF', // 改为白色背景
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  reminderButtonTextActive: {
    color: '#000000', // 激活状态的文字为黑色
  },
});

export default SummaryScreen;