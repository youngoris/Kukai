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
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const tasksJson = await AsyncStorage.getItem('tasks');
      let allTasks = [];
      if (tasksJson) {
        allTasks = JSON.parse(tasksJson);
        const completed = allTasks.filter((task) => task.completed);
        const pending = allTasks.filter((task) => !task.completed);
        setCompletedTasks(completed);
        setPendingTasks(pending);
        const rate = allTasks.length > 0 ? (completed.length / allTasks.length) * 100 : 0;
        setCompletionRate(Math.round(rate));
      } else {
        throw new Error('Failed to load tasks');
      }

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

      const pomodoros = await AsyncStorage.getItem('pomodoroCount');
      if (pomodoros) {
        setPomodoroCount(parseInt(pomodoros));
      }

      const tomorrowTasksJson = await AsyncStorage.getItem('tomorrowTasks');
      if (tomorrowTasksJson) {
        setTomorrowTasks(JSON.parse(tomorrowTasksJson));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load summary data. Please try again.');
    }
  };

  const addTomorrowTask = async () => {
    if (newTomorrowTask.trim() === '') return;
    try {
      const newTask = {
        id: Date.now().toString(),
        text: newTomorrowTask.trim(),
        completed: false,
      };
      const updatedTasks = [...tomorrowTasks, newTask];
      setTomorrowTasks(updatedTasks);
      await AsyncStorage.setItem('tomorrowTasks', JSON.stringify(updatedTasks));
      setNewTomorrowTask('');
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
        isFrog: false,
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
                    {item.isFrog && (
                      <Text style={styles.frogIndicator}>🐸 Main Task</Text>
                    )}
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
              <View style={styles.inputButtonsContainer}>
                <TouchableOpacity
                  style={[styles.inputButton, styles.cancelButton]}
                  onPress={() => {
                    setIsAddingTask(false);
                    setNewTomorrowTask('');
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
          )}
          {tomorrowTasks.length > 0 ? (
            <>
              <FlatList
                data={tomorrowTasks}
                renderItem={({ item }) => (
                  <View style={styles.tomorrowTaskItem}>
                    <Text style={styles.tomorrowTaskText}>{item.text}</Text>
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
  frogIndicator: {
    color: '#CCCCCC', // Monochrome light gray
    fontSize: 12,
    marginTop: 4,
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
});

export default SummaryScreen;