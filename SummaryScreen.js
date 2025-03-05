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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  useEffect(() => {
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

  const loadData = async () => {
    try {
      // Load task data
      const tasksJson = await AsyncStorage.getItem('tasks');
      let allTasks = [];
      
      // Process tasks data
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
        const completed = allTasks.filter((task) => task.completed);
        const pending = allTasks.filter((task) => !task.completed);
        setCompletedTasks(completed);
        setPendingTasks(pending);
        const rate = allTasks.length > 0 ? (completed.length / allTasks.length) * 100 : 0;
        setCompletionRate(Math.round(rate));
      } else {
        // If no task data exists, initialize as empty array instead of throwing an error
        setCompletedTasks([]);
        setPendingTasks([]);
        setCompletionRate(0);
        // Create initial empty tasks array and save
        await AsyncStorage.setItem('tasks', JSON.stringify([]));
      }

      // Load meditation data
      const today = new Date().toISOString().split('T')[0];
      const meditationSessionsJson = await AsyncStorage.getItem('meditationSessions');
      let totalMeditationMinutes = 0;
      if (meditationSessionsJson) {
        const meditationSessions = JSON.parse(meditationSessionsJson);
        const todaySessions = meditationSessions.filter(
          (session) => session.date === today
        );
        totalMeditationMinutes = todaySessions.reduce(
          (total, session) => total + session.duration,
          0
        );
      }
      setTotalMeditationMinutes(totalMeditationMinutes);

      // Load focus time data
      const focusSessionsJson = await AsyncStorage.getItem('focusSessions');
      if (focusSessionsJson) {
        const focusSessions = JSON.parse(focusSessionsJson);
        const todaySessions = focusSessions.filter(
          (session) => session.date === today
        );
        const totalMinutes = todaySessions.reduce(
          (total, session) => total + Math.round(session.duration / 60),
          0
        );
        setTotalFocusMinutes(totalMinutes);
      }

      // Load pomodoro count
      const pomodoros = await AsyncStorage.getItem('pomodoroCount');
      if (pomodoros) {
        setPomodoroCount(parseInt(pomodoros));
      }

      // Load tomorrow's tasks
      const tomorrowTasksJson = await AsyncStorage.getItem('tomorrowTasks');
      if (tomorrowTasksJson) {
        setTomorrowTasks(JSON.parse(tomorrowTasksJson));
      } else {
        // If no tomorrow tasks data exists, initialize as empty array
        setTomorrowTasks([]);
        await AsyncStorage.setItem('tomorrowTasks', JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Display friendly error message and provide retry option
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
    } else if (isTimeTagged) {
      // 如果已经有时间标签但选择器未显示，点击后取消标签
      setIsTimeTagged(false);
      setShowTimePicker(false);
    } else {
      // 如果没有时间标签，点击后显示选择器并激活标签
      setShowTimePicker(true);
      setIsTimeTagged(true);
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
      setShowReminderOptions(false);
    } else if (hasReminder) {
      setHasReminder(false);
    } else {
      setShowReminderOptions(true);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button and Title at the Top */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>SUMMARY</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        style={[
          styles.scrollView, 
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }] 
          }
        ]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.headerSubtitle}>Today</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString()}</Text>
        </View>

        {/* Stats Card */}
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
                  <MaterialIcons name="check-circle" size={20} color="#CCCCCC" />
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
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            >
              <AntDesign name="plus" size={20} color="#CCCCCC" />
              <Text style={styles.addTaskText}>Add Tomorrow Task</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addTaskContainer}>
              <TextInput
                ref={inputRef}
                style={styles.taskInput}
                placeholder="Enter task..."
                placeholderTextColor="#666"
                value={newTomorrowTask}
                onChangeText={setNewTomorrowTask}
                onSubmitEditing={addTomorrowTask}
              />
              {showTimePicker && (
                <View style={styles.timePickerContainer}>
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
                <View style={styles.reminderOptionsContainer}>
                  <Text style={styles.reminderOptionsTitle}>Select Reminder Time</Text>
                  <View style={styles.reminderButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.reminderButton, reminderTime === 15 && styles.reminderButtonActive]}
                      onPress={() => selectReminderTime(15)}
                    >
                      <Text style={styles.reminderButtonText}>15 min</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reminderButton, reminderTime === 30 && styles.reminderButtonActive]}
                      onPress={() => selectReminderTime(30)}
                    >
                      <Text style={styles.reminderButtonText}>30 min</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reminderButton, reminderTime === 60 && styles.reminderButtonActive]}
                      onPress={() => selectReminderTime(60)}
                    >
                      <Text style={styles.reminderButtonText}>1 hour</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.actionButtonsContainer}>
                <View style={styles.tagButtonsRow}>
                  {renderTagButtons()}
                </View>
                <View style={styles.inputButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.inputButton, styles.cancelButton]}
                    onPress={() => {
                      setIsAddingTask(false);
                      setNewTomorrowTask('');
                      setIsFrogTask(false);
                      setIsImportant(false);
                      setIsUrgent(false);
                      Keyboard.dismiss();
                    }}
                  >
                    <Text style={styles.inputButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inputButton, styles.saveButton]}
                    onPress={addTomorrowTask}
                  >
                    <Text style={styles.inputButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {tomorrowTasks.length > 0 ? (
            <>
              <FlatList
                data={tomorrowTasks}
                renderItem={({ item }) => (
                  <View style={styles.tomorrowTaskItem}>
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
                    <TouchableOpacity onPress={() => deleteTomorrowTask(item.id)}>
                      <AntDesign name="close" size={18} color="#666666" />
                    </TouchableOpacity>
                  </View>
                )}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
              <TouchableOpacity style={styles.transferButton} onPress={transferTomorrowTasks}>
                <AntDesign name="swap" size={18} color="#fff" />
                <Text style={styles.transferButtonText}>Move to Task List</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.emptyText}>No tasks for tomorrow</Text>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#000',
  },
  backButton: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: 'center',
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
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
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
    color: '#CCCCCC', // Monochrome light gray
    fontSize: 16,
    marginLeft: 10,
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
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#CCCCCC', // Monochrome light gray
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
  tomorrowTaskText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#CCCCCC', // Monochrome light gray
    marginTop: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  transferButtonText: {
    color: '#fff',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  tagButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 0,
    marginBottom: 15,
    alignItems: 'center',
    height: 140, // 固定高度，约3行
    overflow: 'hidden',
    justifyContent: 'center',
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
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
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
    backgroundColor: '#9C27B0', // 紫色背景
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default SummaryScreen;