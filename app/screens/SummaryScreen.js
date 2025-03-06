import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AsyncStorage } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const SummaryScreen = () => {
  const navigation = useNavigation();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 加载任务函数
  const loadTasks = async () => {
    try {
      setIsLoading(true);
      console.log('正在加载任务...');
      
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (tasksJson) {
        const loadedTasks = JSON.parse(tasksJson);
        console.log('从AsyncStorage加载的任务:', loadedTasks);
        setTasks(loadedTasks);
      } else {
        console.log('没有找到任务数据，设置为空数组');
        setTasks([]);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 重置每日番茄钟计数
  const resetDailyPomodoroCount = async () => {
    try {
      console.log('重置每日番茄钟计数...');
      
      // 获取现有的番茄钟数据
      const pomodoroDataJson = await AsyncStorage.getItem('pomodoroData');
      if (!pomodoroDataJson) {
        console.log('没有找到番茄钟数据');
        return;
      }
      
      // 保留历史记录，但重置今日计数
      await AsyncStorage.setItem('dailyPomodoroCount', '0');
      console.log('每日番茄钟计数已重置为0');
    } catch (error) {
      console.error('重置番茄钟计数失败:', error);
    }
  };

  const checkDailyReset = async () => {
    try {
      // 获取当前日期，确保使用本地时区
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const currentDate = `${year}-${month}-${day}`;
      
      console.log('当前检测到的日期:', currentDate);
      
      // 从AsyncStorage获取上次记录的日期
      let lastRecordedDate = await AsyncStorage.getItem('lastRecordedDate');
      console.log('从存储中读取的上次日期:', lastRecordedDate);
      
      // 如果没有上次记录的日期，立即设置当前日期并返回
      if (!lastRecordedDate) {
        console.log('首次运行应用，设置初始日期');
        await AsyncStorage.setItem('lastRecordedDate', currentDate);
        return;
      }
      
      // 明确比较日期是否不同
      if (lastRecordedDate !== currentDate) {
        console.log(`检测到日期变更: ${lastRecordedDate} -> ${currentDate}`);
        
        // 先执行明日任务自动转换
        await autoTransferTomorrowTasks();
        
        // 重置每日番茄钟计数
        await resetDailyPomodoroCount();
        
        // 更新记录的日期为当前日期
        await AsyncStorage.setItem('lastRecordedDate', currentDate);
        console.log('已更新存储的日期为:', currentDate);
        
        // 强制重新加载任务显示更新后的状态
        await loadTasks();
      } else {
        console.log('日期未变更，无需执行重置操作');
      }
    } catch (error) {
      console.error('日期重置检查失败:', error);
    }
  };

  const autoTransferTomorrowTasks = async () => {
    try {
      console.log('开始自动转换明日任务');
      
      // 从AsyncStorage获取任务
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (!tasksJson) {
        console.log('没有找到任务数据');
        return;
      }
      
      const allTasks = JSON.parse(tasksJson);
      console.log('获取到的所有任务数量:', allTasks.length);
      
      // 识别明日任务
      const tomorrowTasks = allTasks.filter(task => task.isTomorrow === true);
      console.log('找到的明日任务数量:', tomorrowTasks.length);
      
      if (tomorrowTasks.length === 0) {
        console.log('没有明日任务需要转换');
        return;
      }
      
      // 更新所有明日任务为普通任务
      console.log('开始将明日任务转换为普通任务...');
      const updatedTasks = allTasks.map(task => {
        if (task.isTomorrow === true) {
          console.log(`将任务转换为今日任务: "${task.text}"`);
          return { ...task, isTomorrow: false };
        }
        return task;
      });
      
      // 保存更新后的任务列表
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      console.log('已将明日任务转换为普通任务并保存到AsyncStorage');
      
      // 更新本地状态以反映变化
      setTasks(updatedTasks);
    } catch (error) {
      console.error('自动转换明日任务失败:', error);
    }
  };
  
  // 检查和重置AsyncStorage中的日期(用于测试)
  const resetStoredDate = async () => {
    try {
      // 清除存储的日期，强制下次检查时执行重置
      await AsyncStorage.removeItem('lastRecordedDate');
      console.log('已清除存储的日期，下次将执行日期重置操作');
      alert('已重置日期记录，请重启应用');
    } catch (error) {
      console.error('重置日期失败:', error);
    }
  };

  // 手动触发明日任务转换的函数(用于测试)
  const manualTransferTomorrowTasks = async () => {
    try {
      await autoTransferTomorrowTasks();
      // 重新加载任务以更新界面
      await loadTasks();
      alert('已手动执行明日任务转换');
    } catch (error) {
      console.error('手动转换任务失败:', error);
      alert('转换失败: ' + error.message);
    }
  };

  // 检查存储中的所有数据(用于调试)
  const checkAllStorageData = async () => {
    try {
      console.log('------------ 存储数据检查 ------------');
      const lastDate = await AsyncStorage.getItem('lastRecordedDate');
      console.log('存储的最后日期:', lastDate);
      
      const tasksJson = await AsyncStorage.getItem('tasks');
      if (tasksJson) {
        const tasks = JSON.parse(tasksJson);
        console.log('存储的任务数量:', tasks.length);
        console.log('明日任务数量:', tasks.filter(t => t.isTomorrow === true).length);
        console.log('普通任务数量:', tasks.filter(t => !t.isTomorrow).length);
      } else {
        console.log('没有存储任何任务');
      }
      console.log('------------------------------------');
      
      alert(`存储检查:\n日期: ${lastDate || '未设置'}\n任务总数: ${tasksJson ? JSON.parse(tasksJson).length : 0}`);
    } catch (error) {
      console.error('存储检查失败:', error);
    }
  };

  // 组件挂载和获得焦点时执行
  useEffect(() => {
    console.log('SummaryScreen组件已挂载');
    
    // 立即执行日期检查和任务加载
    const initializeScreen = async () => {
      await loadTasks();
      await checkDailyReset();
    };
    
    initializeScreen();
    
    const focusListener = navigation.addListener('focus', () => {
      console.log('SummaryScreen获得焦点');
      initializeScreen();
    });
    
    return () => {
      focusListener();
      console.log('SummaryScreen组件已卸载');
    };
  }, [navigation]);

  // 界面渲染部分
  return (
    <View style={styles.container}>
      <Text style={styles.title}>摘要</Text>
      
      {isLoading ? (
        <Text style={{color: '#fff', textAlign: 'center'}}>加载中...</Text>
      ) : (
        <ScrollView>
          <Text style={styles.sectionTitle}>待处理任务</Text>
          {tasks.filter(task => !task.completed && !task.isTomorrow).map((task, index) => (
            <TouchableOpacity key={index} style={styles.taskItem}>
              <Text style={styles.taskText}>{task.text}</Text>
            </TouchableOpacity>
          ))}
          
          {tasks.filter(task => task.isTomorrow).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>明日任务</Text>
              {tasks.filter(task => task.isTomorrow).map((task, index) => (
                <TouchableOpacity key={index} style={styles.tomorrowTaskItem}>
                  <View style={styles.tomorrowIndicator} />
                  <Text style={styles.taskText}>{task.text}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          
          <Text style={styles.sectionTitle}>明日计划</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('TaskScreen', { isTomorrow: true })}
          >
            <Text style={styles.addButtonText}>+ 添加明日任务</Text>
          </TouchableOpacity>
          
          {tasks.filter(task => task.isTomorrow).length === 0 && (
            <Text style={styles.emptyText}>明日暂无任务</Text>
          )}
          
          {/* 调试工具区域 */}
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>调试工具</Text>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={manualTransferTomorrowTasks}
            >
              <Text style={styles.debugButtonText}>手动转换明日任务</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={resetStoredDate}
            >
              <Text style={styles.debugButtonText}>重置存储的日期</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={checkAllStorageData}
            >
              <Text style={styles.debugButtonText}>检查存储数据</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  taskItem: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 8,
    marginVertical: 6,
  },
  tomorrowTaskItem: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 8,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tomorrowIndicator: {
    width: 3,
    height: 20,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  taskText: {
    color: '#fff',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  debugSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  debugTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#ff0',
    fontSize: 14,
  },
});

export default SummaryScreen; 