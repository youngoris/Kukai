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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FrogIcon from './assets/frog.svg';

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
        setTasks(JSON.parse(savedTasks));
      }
    } catch (error) {
      console.log('Error loading tasks:', error);
    }
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
  const addTask = () => {
    if (newTaskText.trim() === '') return;

    const newTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
      isFrog: isFrogTask, // 保存"蛙"状态
      isImportant: isImportant, // 保存重要状态
      isUrgent: isUrgent, // 保存紧急状态
    };

    const updatedTasks = [newTask, ...tasks].sort((a, b) => {
      if (a.isFrog && !b.isFrog) return -1; // 蛙任务优先
      if (!a.isFrog && b.isFrog) return 1;
      return a.completed - b.completed; // 未完成任务在上
    });

    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    setNewTaskText('');
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
    closeModal();
  };

  // 切换任务完成状态
  const toggleComplete = (id) => {
    const updatedTasks = tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ).sort((a, b) => {
      if (a.isFrog && !b.isFrog) return -1;
      if (!a.isFrog && b.isFrog) return 1;
      return a.completed - b.completed;
    });

    setTasks(updatedTasks);
    saveTasks(updatedTasks);
  };

  // 打开编辑模态框
  const openEditModal = (task) => {
    setEditingTask(task);
    setEditText(task.text);
    setIsFrogTask(task.isFrog || false);
    setIsImportant(task.isImportant || false);
    setIsUrgent(task.isUrgent || false);
    setEditModalVisible(true);

    setTimeout(() => {
      editInputRef.current?.focus();
    }, 100);
  };

  // 保存编辑后的任务
  const saveEditedTask = () => {
    if (editText.trim() === '') return;

    const updatedTasks = tasks.map((task) =>
      task.id === editingTask.id ? { 
        ...task, 
        text: editText.trim(), 
        isFrog: isFrogTask,
        isImportant: isImportant,
        isUrgent: isUrgent
      } : task
    ).sort((a, b) => {
      if (a.isFrog && !b.isFrog) return -1;
      if (!a.isFrog && b.isFrog) return 1;
      return a.completed - b.completed;
    });

    setTasks(updatedTasks);
    saveTasks(updatedTasks);
    setEditModalVisible(false);
    setIsFrogTask(false);
    setIsImportant(false);
    setIsUrgent(false);
  };

  // 删除任务
  const deleteTask = (id) => {
    const filteredTasks = tasks.filter((task) => task.id !== id);
    setTasks(filteredTasks);
    saveTasks(filteredTasks);
  };

  // 打开创建任务模态框
  const openModal = () => {
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
    });
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
              <MaterialIcons name="alarm" size={14} color="#FFFFFF" />
              <Text style={styles.taskTagText}>Urgent</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

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
          width={20} 
          height={20} 
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
          size={20} 
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
        <MaterialIcons 
          name="alarm" 
          size={20} 
          color={isUrgent ? "#000000" : "#FFFFFF"} 
        />
      </TouchableOpacity>
    </View>
  );

  // 已完成任务计数
  const completedCount = tasks.filter((task) => task.completed).length;

  return (
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
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={[
                  styles.modalContainer,
                  { transform: [{ scale: modalScaleAnim }] },
                ]}
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
                  />
                  {renderTagButtons()}
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
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 编辑任务模态框 */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Edit Task</Text>
                  <TextInput
                    ref={editInputRef}
                    style={styles.modalInput}
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus={true}
                    returnKeyType="done"
                    onSubmitEditing={saveEditedTask}
                  />
                  {renderTagButtons()}
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => {
                        deleteTask(editingTask?.id);
                        setEditModalVisible(false);
                      }}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalButton}
                      onPress={() => setEditModalVisible(false)}
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
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
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
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#000000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
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
  tagButtonsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  tagButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#666666',
  },
  tagButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  frogButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
});

export default TaskScreen;