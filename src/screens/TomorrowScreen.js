import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 引入TaskContext
import { useTaskContext } from "../context/TaskContext";

const { width } = Dimensions.get('window');

const TomorrowScreen = ({ navigation }) => {
  // 使用TaskContext
  const {
    tasks,
    tomorrowTasks,
    loading: taskLoading,
    error: taskError,
    refreshTasks,
    addTaskToTomorrow,
    removeTaskFromTomorrow,
    updateTomorrowTasksOrder
  } = useTaskContext();

  // 本地状态
  const [loading, setLoading] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // 获取安全区域尺寸
  const insets = useSafeAreaInsets();

  // 初始化加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 任务数据已通过Context加载，不需要额外加载
        // 只需等待Context完成加载
      } catch (error) {
        console.error("加载数据时出错:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 处理添加任务到明日计划
  const handleAddToTomorrow = async () => {
    try {
      setLoading(true);
      
      // 获取选定的任务
      const tasksToAdd = tasks.filter(task => selectedTaskIds.includes(task.id));
      
      // 使用Context添加到明日任务
      for (const task of tasksToAdd) {
        await addTaskToTomorrow(task.id);
      }
      
      // 清空选择
      setSelectedTaskIds([]);
    } catch (error) {
      console.error("添加任务到明日计划时出错:", error);
      Alert.alert("错误", "添加任务到明日计划时出错，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  // 处理移除任务
  const handleRemoveTask = async (taskId) => {
    try {
      setLoading(true);
      await removeTaskFromTomorrow(taskId);
    } catch (error) {
      console.error("从明日计划移除任务时出错:", error);
      Alert.alert("错误", "从明日计划移除任务时出错，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  // 处理任务重新排序
  const handleReorderTasks = async (reorderedTasks) => {
    try {
      // 提取重新排序的任务ID
      const taskIds = reorderedTasks.map(task => task.id);
      await updateTomorrowTasksOrder(taskIds);
    } catch (error) {
      console.error("重新排序任务时出错:", error);
      Alert.alert("错误", "重新排序任务时出错，请稍后再试。");
    }
  };

  // 切换任务选择
  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prevSelected => {
      if (prevSelected.includes(taskId)) {
        return prevSelected.filter(id => id !== taskId);
      } else {
        return [...prevSelected, taskId];
      }
    });
  };

  // 刷新任务
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshTasks();
    } catch (error) {
      console.error("刷新任务时出错:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // 渲染主任务列表项
  const renderTaskItem = (task) => {
    const isSelected = selectedTaskIds.includes(task.id);
    return (
      <TouchableOpacity
        key={task.id}
        style={[
          styles.taskItem,
          isSelected && styles.taskItemSelected
        ]}
        onPress={() => toggleTaskSelection(task.id)}
      >
        <View style={styles.taskCheckbox}>
          {isSelected && <Ionicons name="checkmark" size={18} color="#FFF" />}
        </View>
        <Text style={styles.taskTitle}>{task.title}</Text>
        {task.priority > 0 && (
          <View style={[
            styles.priorityIndicator, 
            { backgroundColor: task.priority === 1 ? '#FFD700' : '#FF6347' }
          ]} />
        )}
      </TouchableOpacity>
    );
  };

  // 渲染明日任务列表项
  const renderTomorrowTaskItem = (task, index) => {
    return (
      <View
        key={task.id}
        style={styles.tomorrowTaskItem}
      >
        <View style={styles.tomorrowTaskContent}>
          <Text style={styles.tomorrowTaskOrder}>{index + 1}</Text>
          <Text style={styles.tomorrowTaskTitle}>{task.title}</Text>
          {task.priority > 0 && (
            <View style={[
              styles.priorityIndicator, 
              { backgroundColor: task.priority === 1 ? '#FFD700' : '#FF6347' }
            ]} />
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveTask(task.id)}
          style={styles.removeButton}
        >
          <Text style={styles.removeButtonText}>移除</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 如果加载中，显示加载指示器
  if (loading || taskLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>加载任务...</Text>
      </View>
    );
  }

  // 如果出错，显示错误消息
  if (taskError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>错误: {taskError}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => refreshTasks()}
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 过滤任务 - 排除已在明日任务中的任务
  const availableTasks = tasks.filter(
    task => !tomorrowTasks.some(tt => tt.id === task.id) && !task.completed
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>明日计划</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>明日任务</Text>
          {tomorrowTasks.length === 0 ? (
            <Text style={styles.emptyText}>还没有添加明日任务</Text>
          ) : (
            tomorrowTasks.map((task, index) => renderTomorrowTaskItem(task, index))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>可用任务</Text>
          {availableTasks.length === 0 ? (
            <Text style={styles.emptyText}>没有可添加的任务</Text>
          ) : (
            availableTasks.map(task => renderTaskItem(task))
          )}
        </View>
        
        {/* 底部空间，确保内容可以完全滚动到按钮上方 */}
        {selectedTaskIds.length > 0 && <View style={styles.bottomSpace} />}
      </ScrollView>

      {selectedTaskIds.length > 0 && (
        <TouchableOpacity
          style={[styles.addButton, { marginBottom: insets.bottom > 0 ? insets.bottom : 20 }]}
          onPress={handleAddToTomorrow}
        >
          <Text style={styles.addButtonText}>
            添加 {selectedTaskIds.length} 个任务到明日计划
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// 样式定义
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  refreshButton: {
    padding: 5,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  emptyText: {
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  taskItemSelected: {
    backgroundColor: '#333333',
    borderColor: '#6495ED',
    borderWidth: 1,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  priorityIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  tomorrowTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  tomorrowTaskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tomorrowTaskOrder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#333333',
    textAlign: 'center',
    lineHeight: 22,
    color: '#FFFFFF',
    fontSize: 12,
    marginRight: 10,
  },
  tomorrowTaskTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  removeButton: {
    backgroundColor: '#FF4040',
    borderRadius: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#6495ED',
    borderRadius: 10,
    padding: 15,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSpace: {
    height: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorText: {
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TomorrowScreen; 