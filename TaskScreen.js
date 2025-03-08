import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  FlatList,
  TextInput,
  Keyboard,
  Modal,
  Animated,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons, AntDesign, Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FrogIcon from './assets/frog.svg';
import CustomDateTimePicker from './components/CustomDateTimePicker';
import notificationService from './services/NotificationService';

const TaskScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editText, setEditText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isFrogTask, setIsFrogTask] = useState(false); // Mark as "frog" status
  const [isImportant, setIsImportant] = useState(false); // Important tag
  const [isUrgent, setIsUrgent] = useState(false); // Urgent tag
  const [isTimeTagged, setIsTimeTagged] = useState(false); // Time tag
  const [hasReminder, setHasReminder] = useState(false); // Reminder notification tag
  const [reminderTime, setReminderTime] = useState(15); // Advance notification time (minutes), default 15 minutes
  const [showReminderOptions, setShowReminderOptions] = useState(false); // Whether to show reminder options
  const [taskTime, setTaskTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setMinutes(30, 0, 0); // Set default minutes to 30
    return defaultTime;
  }); // Task time
  const [showTimePicker, setShowTimePicker] = useState(false); // Whether to show time picker
  const [timeLabel, setTimeLabel] = useState('');
  
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.95)).current;
  const addButtonAnim = useRef(new Animated.Value(1)).current;

  // Hide status bar
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  // Load tasks and fade-in animation
  useEffect(() => {
    loadTasks();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load tasks from storage
  const loadTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        setTasks(sortTasksByPriority(parsedTasks));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  // Sort tasks by tag priority: frog > urgent > important > no tag
  const sortTasksByPriority = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      // First, sort by completion status
      if (a.completed !== b.completed) {
        return a.completed - b.completed;
      }
      
      // Then, sort by tag priority
      // Frog tag has the highest priority
      if (a.isFrog && !b.isFrog) return -1;
      if (!a.isFrog && b.isFrog) return 1;
      
      // Urgent tag has the next highest priority
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      
      // Important tag has the third highest priority
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      
      // Default sort by creation time (ID is usually a timestamp)
      return parseInt(a.id) - parseInt(b.id);
    });
  };

  // Save tasks to storage
  const saveTasks = async (tasksToSave) => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(tasksToSave));
    } catch (error) {
      console.log('Error saving tasks:', error);
    }
  };

  // Add new task
  const addTask = async () => {
    if (newTaskText.trim() === '') return;

    // If time picker is displayed, ensure time tag is activated
    if (showTimePicker) {
      setIsTimeTagged(true);
    }

    // If reminder is set but time is not set, prompt user
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
      text: newTaskText.trim(),
      completed: false,
      isFrog: isFrogTask,
      isImportant: isImportant,
      isUrgent: isUrgent,
      isTimeTagged: isTimeTagged || showTimePicker, // If time picker is displayed, consider time tagged
      taskTime: (isTimeTagged || showTimePicker) ? taskTime.toISOString() : null,
      hasReminder: hasReminder,
      reminderTime: reminderTime, // Advance notification time (minutes)
      notifyAtDeadline: true, // Notify when deadline is reached
    };

    const updatedTasks = [...tasks, newTask];
    const sortedTasks = sortTasksByPriority(updatedTasks);
    setTasks(sortedTasks);
    await saveTasks(sortedTasks);
    
    // If task has reminder, schedule notification
    if (newTask.isTimeTagged && newTask.taskTime) {
      try {
        console.log(`Preparing notifications for task "${newTask.text}" (ID: ${newTask.id})`);
        console.log(`Task time: ${new Date(newTask.taskTime).toLocaleString()}`);
        console.log(`Has reminder: ${newTask.hasReminder}, Reminder minutes: ${newTask.reminderTime}`);
        
        const notificationId = await notificationService.scheduleTaskNotification(newTask);
        if (notificationId) {
          console.log(`Task notification(s) scheduled successfully, IDs:`, notificationId);
        } else {
          console.log(`No notifications were scheduled (possibly due to time constraints)`);
        }
      } catch (error) {
        console.error('Failed to schedule task notification:', error);
      }
    } else {
      console.log(`Task "${newTask.text}" has no time set, skipping notifications`);
    }
    
    setNewTaskText('');
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
    setIsTimeTagged(false);
    setShowTimePicker(false);
    setHasReminder(false);
    setReminderTime(15);
    setShowReminderOptions(false);
    setTaskTime(new Date());
    setModalVisible(false);
  };

  // Toggle task completion status
  const toggleComplete = async (id) => {
    const taskToToggle = tasks.find(task => task.id === id);
    const isCompleting = !taskToToggle.completed;
    
    const updatedTasks = tasks.map((task) =>
      task.id === id 
        ? { 
            ...task, 
            completed: !task.completed,
            // If task is marked as completed, add completion timestamp; if not completed, remove completion timestamp
            completedAt: !task.completed ? new Date().toISOString() : null
          } 
        : task
    );
    
    const sortedTasks = sortTasksByPriority(updatedTasks);
    setTasks(sortedTasks);
    await saveTasks(sortedTasks);
    
    // If task is marked as completed, cancel its notification
    if (isCompleting && taskToToggle.hasReminder && taskToToggle.isTimeTagged && taskToToggle.taskTime) {
      await notificationService.cancelTaskNotification(id);
      console.log('Task completed, notification cancelled');
    }
  };

  // Open edit modal
  const openEditModal = (task) => {
    setEditingTask(task);
    setEditText(task.text);
    setIsFrogTask(task.isFrog || false);
    setIsImportant(task.isImportant || false);
    setIsUrgent(task.isUrgent || false);
    setIsTimeTagged(task.isTimeTagged || false);
    setHasReminder(task.hasReminder || false);
    setReminderTime(task.reminderTime || 15);
    setShowReminderOptions(false); // Ensure initial not to show reminder options
    if (task.isTimeTagged && task.taskTime) {
      setTaskTime(new Date(task.taskTime));
    } else {
      setTaskTime(new Date());
    }
    setEditModalVisible(true);

    setTimeout(() => {
      editInputRef.current?.focus();
    }, 100);
  };

  // Save edited task
  const saveEditedTask = async () => {
    if (editText.trim() === '') return;
    
    // If reminder is set but time is not set, prompt user
    if (hasReminder && !isTimeTagged) {
      Alert.alert(
        "Reminder Setup",
        "You need to set a task time first to add a reminder",
        [
          { text: "OK", onPress: () => handleTimeTagPress() }
        ]
      );
      return;
    }

    // Cancel original task notification (if any)
    if (editingTask.hasReminder && editingTask.isTimeTagged && editingTask.taskTime) {
      await notificationService.cancelTaskNotification(editingTask.id);
    }
    
    const updatedTask = {
      ...editingTask,
      text: editText.trim(),
      isFrog: isFrogTask,
      isImportant: isImportant,
      isUrgent: isUrgent,
      isTimeTagged: isTimeTagged,
      taskTime: isTimeTagged ? taskTime.toISOString() : null,
      hasReminder: hasReminder,
      reminderTime: reminderTime,
    };

    const updatedTasks = tasks.map((task) =>
      task.id === editingTask.id ? updatedTask : task
    );
    
    const sortedTasks = sortTasksByPriority(updatedTasks);
    setTasks(sortedTasks);
    await saveTasks(sortedTasks);
    
    // If updated task has reminder, reschedule notification
    if (updatedTask.hasReminder && updatedTask.isTimeTagged && updatedTask.taskTime) {
      try {
        const notificationId = await notificationService.scheduleTaskNotification(updatedTask);
        console.log('Task notification updated, ID:', notificationId);
      } catch (error) {
        console.error('Failed to update task notification:', error);
      }
    }
    
    setEditModalVisible(false);
  };

  // Delete task
  const deleteTask = async (id) => {
    // Cancel task notification (if any)
    const taskToDelete = tasks.find(task => task.id === id);
    if (taskToDelete && taskToDelete.hasReminder && taskToDelete.isTimeTagged && taskToDelete.taskTime) {
      await notificationService.cancelTaskNotification(id);
    }
    
    const filteredTasks = tasks.filter((task) => task.id !== id);
    setTasks(filteredTasks);
    await saveTasks(filteredTasks);
  };

  // Open create task modal
  const openModal = () => {
    // Reset all states
    setNewTaskText('');
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
    setIsTimeTagged(false);
    setTaskTime(new Date());
    setShowTimePicker(false);
    setShowReminderOptions(false);
    setHasReminder(false);
    setReminderTime(15); // Set default value to 15 minutes, but only enable when user selects it
    
    // Show modal
    setModalVisible(true);
    Animated.timing(modalScaleAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.timing(addButtonAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(addButtonAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Close create task modal
  const closeModal = () => {
    Keyboard.dismiss();
    Animated.timing(modalScaleAnim, {
      toValue: 0.95,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setNewTaskText('');
      setIsFrogTask(false);
      setIsImportant(false);
      setIsUrgent(false);
      setIsTimeTagged(false);
      setTaskTime(new Date());
      setShowTimePicker(false);
      setShowReminderOptions(false);
      setHasReminder(false);
      setReminderTime(0);
    });
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditText('');
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
    setIsTimeTagged(false);
    setTaskTime(new Date());
    setShowTimePicker(false);
    setShowReminderOptions(false);
    setHasReminder(false);
    setReminderTime(0);
  };

  // Handle time change
  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
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
      // If time picker is already displayed, click to close picker and cancel tag
      setShowTimePicker(false);
      setIsTimeTagged(false);
      // Also close reminder functionality
      setHasReminder(false);
      setShowReminderOptions(false);
    } else {
      // Show time picker
      setShowTimePicker(true);
      setIsTimeTagged(true);
      // Show time picker to close reminder options, to avoid interface too crowded
      setShowReminderOptions(false);
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
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }
    
    if (showReminderOptions) {
      // If reminder options are already displayed, click to close options
      setShowReminderOptions(false);
      // Only set hasReminder to true when user actually selects a reminder time
      if (!reminderTime) {
        setHasReminder(false);
      }
    } else {
      // Show reminder options
      setShowReminderOptions(true);
      // Don't automatically set hasReminder, wait for user to select specific time
      // setHasReminder(true);
      // Show reminder options to close time picker, to avoid interface too crowded
      setShowTimePicker(false);
    }
  };

  // Select reminder time
  const selectReminderTime = (minutes) => {
    console.log(`User selected reminder time: ${minutes} minutes before task`);
    setReminderTime(minutes);
    setHasReminder(true); // User explicitly selected reminder time, set hasReminder to true
    setShowReminderOptions(false);
  };

  // Render task item
  const renderTaskItem = ({ item }) => (
    <View style={styles.taskItem}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => toggleComplete(item.id)}
      >
        <View style={[styles.checkbox, item.completed && styles.checkboxChecked]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.taskTextContainer}
        onPress={() => openEditModal(item)}
      >
        <Text
          style={[
            styles.taskText,
            item.completed && styles.taskTextCompleted,
            item.isFrog && styles.taskTextFrog,
          ]}
        >
          {item.text}
        </Text>
        <View style={styles.taskTagsContainer}>
          {item.isFrog && (
            <View style={[
              styles.taskTag, 
              styles.frogTag,
              item.completed && styles.completedTaskTag
            ]}>
              <FrogIcon width={14} height={14} fill={item.completed ? "#888888" : "#FFFFFF"} />
              <Text style={[styles.taskTagText, item.completed && styles.completedTaskTagText]}>Priority</Text>
            </View>
          )}
          {item.isImportant && (
            <View style={[
              styles.taskTag, 
              styles.importantTag,
              item.completed && styles.completedTaskTag
            ]}>
              <MaterialIcons name="star" size={14} color={item.completed ? "#888888" : "#FFFFFF"} />
              <Text style={[styles.taskTagText, item.completed && styles.completedTaskTagText]}>Important</Text>
            </View>
          )}
          {item.isUrgent && (
            <View style={[
              styles.taskTag, 
              styles.urgentTag,
              item.completed && styles.completedTaskTag
            ]}>
              <Feather name="alert-circle" size={14} color={item.completed ? "#888888" : "#FFFFFF"} />
              <Text style={[styles.taskTagText, item.completed && styles.completedTaskTagText]}>Urgent</Text>
            </View>
          )}
          {item.isTimeTagged && item.taskTime && (
            <View style={[
              styles.taskTag, 
              styles.timeTag,
              item.completed && styles.completedTaskTag
            ]}>
              <Ionicons name="time-outline" size={14} color={item.completed ? "#888888" : "#FFFFFF"} />
              <Text style={[styles.taskTagText, item.completed && styles.completedTaskTagText]}>
                {new Date(item.taskTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          )}
          {item.hasReminder && (
            <View style={[
              styles.taskTag, 
              styles.reminderTag,
              item.completed && styles.completedTaskTag
            ]}>
              <MaterialIcons name="notifications" size={14} color={item.completed ? "#888888" : "#FFFFFF"} />
              <Text style={[styles.taskTagText, item.completed && styles.completedTaskTagText]}>
                {item.reminderTime} min
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  // Render tag buttons
  const renderTagButtons = () => (
    <View style={styles.tagButtonsRow}>
      {/* Frog icon button */}
      <TouchableOpacity
        style={[
          styles.tagButton,
          isFrogTask && styles.tagButtonActive,
        ]}
        onPress={() => setIsFrogTask(!isFrogTask)}
      >
        <FrogIcon 
          width={20} 
          height={20} 
          fill={isFrogTask ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      {/* Important button */}
      <TouchableOpacity
        style={[
          styles.tagButton,
          isImportant && styles.tagButtonActive,
        ]}
        onPress={() => setIsImportant(!isImportant)}
      >
        <MaterialIcons 
          name="star" 
          size={20} 
          color={isImportant ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      {/* Urgent button */}
      <TouchableOpacity
        style={[
          styles.tagButton,
          isUrgent && styles.tagButtonActive,
        ]}
        onPress={() => setIsUrgent(!isUrgent)}
      >
        <Feather 
          name="alert-circle" 
          size={20} 
          color={isUrgent ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      {/* Time button */}
      <TouchableOpacity
        style={[
          styles.tagButton,
          (isTimeTagged || showTimePicker) && styles.tagButtonActive,
        ]}
        onPress={handleTimeTagPress}
      >
        <Ionicons 
          name="time-outline" 
          size={20} 
          color={(isTimeTagged || showTimePicker) ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
      
      {/* Reminder button */}
      <TouchableOpacity
        style={[
          styles.tagButton,
          hasReminder && styles.tagButtonActive,
        ]}
        onPress={handleReminderPress}
      >
        <MaterialIcons 
          name="notifications" 
          size={20} 
          color={hasReminder ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
    </View>
  );

  // Completed task count
  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.headerButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerText}>TASK</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={openModal}
          >
            <Text style={styles.headerButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {tasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No tasks yet</Text>
              <Text style={styles.emptySubtext}>Add your first task to get started</Text>
            </View>
          ) : (
            <FlatList
              data={tasks}
              renderItem={renderTaskItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
            />
          )}
        </Animated.View>

        {tasks.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.statsText}>
              {completedCount}/{tasks.length} tasks completed
            </Text>
          </View>
        )}

        {/* New task modal */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeModal}
        >
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: '100%' }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
              >
                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <Animated.View
                    style={[
                      styles.modalContainer,
                      { transform: [{ scale: modalScaleAnim }] },
                    ]}
                  >
                    <ScrollView 
                      contentContainerStyle={{ paddingBottom: 20 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Task</Text>
                        <TextInput
                          ref={inputRef}
                          style={styles.modalInput}
                          placeholder="Add a task..."
                          placeholderTextColor="#666666"
                          value={newTaskText}
                          onChangeText={setNewTaskText}
                          autoFocus={true}
                          returnKeyType="done"
                          onSubmitEditing={addTask}
                          keyboardAppearance="dark"
                        />
                        
                        {renderTagButtons()}
                        
                        {showTimePicker && (
                          <View style={styles.timePickerContainer}>
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
                          <View style={styles.reminderOptionsContainer}>
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
                        
                        <View style={styles.modalButtons}>
                          <TouchableOpacity
                            style={styles.modalButton}
                            onPress={closeModal}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.modalButton, styles.addTaskButton]}
                            onPress={addTask}
                          >
                            <Text style={styles.addTaskButtonText}>Add Task</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </ScrollView>
                  </Animated.View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Edit task modal */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeEditModal}
        >
          <TouchableWithoutFeedback onPress={closeEditModal}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: '100%' }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
              >
                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <View style={styles.modalContainer}>
                    <ScrollView 
                      contentContainerStyle={{ paddingBottom: 20 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Task</Text>
                        <TextInput
                          ref={editInputRef}
                          style={styles.modalInput}
                          placeholder="Edit task..."
                          placeholderTextColor="#666666"
                          value={editText}
                          onChangeText={setEditText}
                          autoFocus={true}
                          keyboardAppearance="dark"
                        />
                        
                        {renderTagButtons()}
                        
                        {showTimePicker && (
                          <View style={styles.timePickerContainer}>
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
                          <View style={styles.reminderOptionsContainer}>
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
                        
                        <View style={styles.modalButtons}>
                          <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => {
                              deleteTask(editingTask?.id);
                              closeEditModal();
                            }}
                          >
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.modalButton}
                            onPress={closeEditModal}
                          >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.modalButton, styles.addTaskButton]}
                            onPress={saveEditedTask}
                          >
                            <Text style={styles.addTaskButtonText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 0, // Title bar moved to top
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
  },
  checkboxContainer: {
    marginRight: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#666666',
  },
  checkboxChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  taskTextContainer: {
    flex: 1,
  },
  taskText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 6,
  },
  taskTextCompleted: {
    color: '#666666',
    textDecorationLine: 'line-through',
  },
  taskTextFrog: {
    fontWeight: 'bold', // Marked as "frog" tasks are bold
    // color: '#2E8B57', // Frog task text is displayed in green
  },
  taskTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    backgroundColor: '#2E8B57', // Add green background for frog tag
  },
  importantTag: {
    backgroundColor: '#3D2645',
  },
  urgentTag: {
    backgroundColor: '#832232',
  },
  timeTag: {
    backgroundColor: '#555555', // Gray background for time tag
  },
  taskTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  emptySubtext: {
    color: '#666666',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statsText: {
    color: '#666666',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    maxHeight: '93%',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#000000',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    padding: 12,
    marginLeft: 10,
  },
  addTaskButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
  },
  addTaskButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 80,
    paddingHorizontal: 20,
  },
  tagButtonsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  tagButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#222222',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  tagButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  timePickerContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 0,
    marginBottom: 15,
    alignItems: 'center',
    height: 90, 
    overflow: 'hidden',
    justifyContent: 'center',
  },
  timePicker: {
    width: Platform.OS === 'ios' ? '100%' : 150,
    height: Platform.OS === 'ios' ? 100 : 90,
  },
  timeConfirmButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeConfirmText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderTag: {
    backgroundColor: '#7B29BD', // Purple background for reminder tag
  },
  reminderOptionsContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20, // Increase bottom margin to make button closer to border
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
    color: '#000000', // Activated text is black
  },
  completedTaskTag: {
    opacity: 0.5,
    backgroundColor: '#333333', // Uniformly use dark gray background
  },
  completedTaskTagText: {
    color: '#888888',
  },
});

export default TaskScreen;