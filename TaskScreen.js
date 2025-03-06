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
import DateTimePicker from '@react-native-community/datetimepicker';
import notificationService from './services/NotificationService';

const TaskScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editText, setEditText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isFrogTask, setIsFrogTask] = useState(false); // 标记为"蛙"状态
  const [isImportant, setIsImportant] = useState(false); // 重要标签
  const [isUrgent, setIsUrgent] = useState(false); // 紧急标签
  const [isTimeTagged, setIsTimeTagged] = useState(false); // 时间标签
  const [hasReminder, setHasReminder] = useState(false); // 提醒通知标签
  const [reminderTime, setReminderTime] = useState(15); // 提前通知时间（分钟），默认15分钟
  const [showReminderOptions, setShowReminderOptions] = useState(false); // 是否显示提醒选项
  const [taskTime, setTaskTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setMinutes(30, 0, 0); // 设置默认分钟为30分
    return defaultTime;
  }); // 任务时间
  const [showTimePicker, setShowTimePicker] = useState(false); // 是否显示时间选择器
  const [timeLabel, setTimeLabel] = useState('');
  
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalScaleAnim = useRef(new Animated.Value(0.95)).current;
  const addButtonAnim = useRef(new Animated.Value(1)).current;

  // 隐藏状态栏
  useEffect(() => {
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, []);

  // 加载任务和淡入动画
  useEffect(() => {
    loadTasks();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // 从存储中加载任务
  const loadTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        // 按照标签优先级排序：青蛙 > 紧急 > 重要 > 无标签
        const sortedTasks = sortTasksByPriority(parsedTasks);
        setTasks(sortedTasks);
      }
    } catch (error) {
      console.log('Error loading tasks:', error);
    }
  };

  // 按照标签优先级排序任务
  const sortTasksByPriority = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      // 首先按照完成状态排序
      if (a.completed !== b.completed) {
        return a.completed - b.completed;
      }
      
      // 然后按照标签优先级排序
      // 青蛙标签最高优先级
      if (a.isFrog && !b.isFrog) return -1;
      if (!a.isFrog && b.isFrog) return 1;
      
      // 紧急标签次高优先级
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      
      // 重要标签第三优先级
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      
      // 默认按照创建时间排序（ID通常是时间戳）
      return parseInt(a.id) - parseInt(b.id);
    });
  };

  // 保存任务到存储
  const saveTasks = async (tasksToSave) => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(tasksToSave));
    } catch (error) {
      console.log('Error saving tasks:', error);
    }
  };

  // 添加新任务
  const addTask = async () => {
    if (newTaskText.trim() === '') return;

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
      text: newTaskText.trim(),
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

    const updatedTasks = [...tasks, newTask];
    const sortedTasks = sortTasksByPriority(updatedTasks);
    setTasks(sortedTasks);
    await saveTasks(sortedTasks);
    
    // 如果任务有提醒，调度通知
    if (newTask.hasReminder && newTask.isTimeTagged && newTask.taskTime) {
      try {
        const notificationId = await notificationService.scheduleTaskNotification(newTask);
        console.log('Task notification scheduled, ID:', notificationId);
      } catch (error) {
        console.error('Failed to schedule task notification:', error);
      }
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

  // 切换任务完成状态
  const toggleComplete = async (id) => {
    const taskToToggle = tasks.find(task => task.id === id);
    const isCompleting = !taskToToggle.completed;
    
    const updatedTasks = tasks.map((task) =>
      task.id === id 
        ? { 
            ...task, 
            completed: !task.completed,
            // 如果任务被标记为完成，添加完成时间戳；如果取消完成，移除完成时间戳
            completedAt: !task.completed ? new Date().toISOString() : null
          } 
        : task
    );
    
    const sortedTasks = sortTasksByPriority(updatedTasks);
    setTasks(sortedTasks);
    await saveTasks(sortedTasks);
    
    // 如果任务被标记为完成，取消其通知
    if (isCompleting && taskToToggle.hasReminder && taskToToggle.isTimeTagged && taskToToggle.taskTime) {
      await notificationService.cancelTaskNotification(id);
      console.log('Task completed, notification cancelled');
    }
  };

  // 打开编辑模态框
  const openEditModal = (task) => {
    setEditingTask(task);
    setEditText(task.text);
    setIsFrogTask(task.isFrog || false);
    setIsImportant(task.isImportant || false);
    setIsUrgent(task.isUrgent || false);
    setIsTimeTagged(task.isTimeTagged || false);
    setHasReminder(task.hasReminder || false);
    setReminderTime(task.reminderTime || 15);
    setShowReminderOptions(false); // 确保初始不显示提醒选项
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

  // 保存编辑后的任务
  const saveEditedTask = async () => {
    if (editText.trim() === '') return;
    
    // 如果设置了提醒但没有设置时间，提示用户
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

    // 取消原有任务的通知（如果有）
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
    
    // 如果更新后的任务有提醒，重新调度通知
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

  // 删除任务
  const deleteTask = async (id) => {
    // 取消任务的通知（如果有）
    const taskToDelete = tasks.find(task => task.id === id);
    if (taskToDelete && taskToDelete.hasReminder && taskToDelete.isTimeTagged && taskToDelete.taskTime) {
      await notificationService.cancelTaskNotification(id);
    }
    
    const filteredTasks = tasks.filter((task) => task.id !== id);
    setTasks(filteredTasks);
    await saveTasks(filteredTasks);
  };

  // 打开创建任务模态框
  const openModal = () => {
    // 重置所有状态
    setNewTaskText('');
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
    setIsTimeTagged(false);
    setTaskTime(new Date());
    setShowTimePicker(false);
    setShowReminderOptions(false);
    setHasReminder(false);
    setReminderTime(15);
    
    // 显示模态框
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

  // 关闭创建任务模态框
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

  // 关闭编辑模态框
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
    } else {
      // 显示时间选择器
      setShowTimePicker(true);
      setIsTimeTagged(true);
      // 显示时间选择器时关闭提醒选项，避免界面过于拥挤
      setShowReminderOptions(false);
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
      // 如果提醒选项已经显示，点击后关闭选项
      setShowReminderOptions(false);
      setHasReminder(false);
    } else {
      // 显示提醒选项
      setShowReminderOptions(true);
      setHasReminder(true);
      // 显示提醒选项时关闭时间选择器，避免界面过于拥挤
      setShowTimePicker(false);
    }
  };

  // 选择提醒时间
  const selectReminderTime = (minutes) => {
    setReminderTime(minutes);
    setHasReminder(true);
    setShowReminderOptions(false);
  };

  // 渲染任务项
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
            <View style={[styles.taskTag, styles.frogTag]}>
              <FrogIcon width={14} height={14} fill="#FFFFFF" />
              <Text style={styles.taskTagText}>Priority</Text>
            </View>
          )}
          {item.isImportant && (
            <View style={[styles.taskTag, styles.importantTag]}>
              <MaterialIcons name="star" size={14} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Important</Text>
            </View>
          )}
          {item.isUrgent && (
            <View style={[styles.taskTag, styles.urgentTag]}>
              <Feather name="alert-circle" size={14} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Urgent</Text>
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
      </TouchableOpacity>
    </View>
  );

  // 渲染标签按钮
  const renderTagButtons = () => (
    <View style={styles.tagButtonsRow}>
      {/* 蛙图标按钮 */}
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
      
      {/* Important 按钮 */}
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
      
      {/* Urgent 按钮 */}
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
      
      {/* 时间按钮 */}
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
      
      {/* 提醒按钮 */}
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

  // 已完成任务计数
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

        {/* 新建任务模态框 */}
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

        {/* 编辑任务模态框 */}
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
    paddingTop: 0, // 标题栏移至顶端
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
    fontWeight: 'bold', // 标记为"蛙"的任务加粗显示
    // color: '#2E8B57', // 青蛙任务文本显示为绿色
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
    backgroundColor: '#2E8B57', // 添加青蛙标签的绿色背景
  },
  importantTag: {
    backgroundColor: '#3D2645',
  },
  urgentTag: {
    backgroundColor: '#832232',
  },
  timeTag: {
    backgroundColor: '#555555', // 时间标签的灰色背景
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
    backgroundColor: '#9C27B0', // 紫色背景
  },
  reminderOptionsContainer: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 15,
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

export default TaskScreen;