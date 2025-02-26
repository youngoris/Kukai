import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Dimensions, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MeditationScreen from './MeditationScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';
import { MeditationProvider } from './contexts/MeditationContext';
import { useMeditation } from './contexts/MeditationContext';

const { width, height } = Dimensions.get('window');
const Stack = createStackNavigator();

// 名言数据库
const quotes = {
  morning: [
    "Start is half of success.",
    "Focus on the present, reap the future.",
    "Today's efforts are tomorrow's rewards.",
    "Every morning is a fresh opportunity.",
    "Eat that frog first thing in the morning."
  ],
  day: [
    "One focused hour is worth two distracted ones.",
    "Small steps lead to big achievements.",
    "Stay focused, stay productive.",
    "Break it down, build it up.",
    "The key to productivity is not working harder, but smarter."
  ],
  evening: [
    "Reflect on today, plan for tomorrow.",
    "Every day's effort is worth recording.",
    "Quiet your mind, listen to your inner voice.",
    "Today's reflection is tomorrow's wisdom.",
    "Review makes perfect."
  ]
};

// 主页面组件
const HomeScreen = ({ navigation }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeOfDay, setTimeOfDay] = useState('morning'); // 'morning', 'day', 'evening'
  const [quote, setQuote] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [completedTasks, setCompletedTasks] = useState({
    meditation: false,
    task: false,
    focus: false,
    summary: false,
    journal: false
  });
  
  // 获取冥想状态
  const { activeMeditation, formatTime } = useMeditation();
  
  // 加载已完成任务状态
  useEffect(() => {
    const loadCompletedTasks = async () => {
      try {
        // 获取今天的日期字符串作为键
        const today = new Date().toISOString().split('T')[0];
        const savedData = await AsyncStorage.getItem(`completed_${today}`);
        
        if (savedData) {
          setCompletedTasks(JSON.parse(savedData));
        } else {
          // 如果是新的一天，重置所有任务状态
          const resetState = {
            meditation: false,
            task: false,
            focus: false,
            summary: false,
            journal: false
          };
          setCompletedTasks(resetState);
          await AsyncStorage.setItem(`completed_${today}`, JSON.stringify(resetState));
        }
      } catch (error) {
        console.error('Error loading completed tasks:', error);
      }
    };
    
    loadCompletedTasks();
  }, []);
  
  // 保存已完成任务状态
  const saveCompletedTasks = async (newState) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem(`completed_${today}`, JSON.stringify(newState));
    } catch (error) {
      console.error('Error saving completed tasks:', error);
    }
  };
  
  // 更新时间
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // 判断一天中的时段
      const hours = now.getHours();
      let newTimeOfDay;
      
      if (hours >= 6 && hours < 12) {
        newTimeOfDay = 'morning';
      } else if (hours >= 12 && hours < 18) {
        newTimeOfDay = 'day';
      } else {
        newTimeOfDay = 'evening';
      }
      
      if (newTimeOfDay !== timeOfDay) {
        setTimeOfDay(newTimeOfDay);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeOfDay]);
  
  // 设置名言并添加淡入效果
  useEffect(() => {
    // 根据时间选择名言类别
    const quoteList = quotes[timeOfDay];
    // 随机选择一条名言
    const randomIndex = Math.floor(Math.random() * quoteList.length);
    
    // 先淡出
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      // 更新名言
      setQuote(quoteList[randomIndex]);
      
      // 再淡入
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    });
  }, [timeOfDay]);
  
  // 格式化日期
  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // 处理功能访问
  const handleFunctionAccess = (taskName) => {
    // 记录功能访问状态
    const newCompletedTasks = { ...completedTasks };
    newCompletedTasks[taskName] = true;
    setCompletedTasks(newCompletedTasks);
    saveCompletedTasks(newCompletedTasks);
    
    // 导航到相应页面
    switch(taskName) {
      case 'meditation':
        navigation.navigate('Meditation');
        break;
      case 'task':
        // 未来实现: navigation.navigate('Task');
        console.log('Accessing Task function');
        break;
      case 'focus':
        // 未来实现: navigation.navigate('Focus');
        console.log('Accessing Focus function');
        break;
      case 'summary':
        // 未来实现: navigation.navigate('Summary');
        console.log('Accessing Summary function');
        break;
      case 'journal':
        // 未来实现: navigation.navigate('Journal');
        console.log('Accessing Journal function');
        break;
      default:
        console.log(`Accessing ${taskName} function`);
    }
  };
  
  // 获取当前应该高亮的功能
  const getCurrentHighlightedFunction = () => {
    const hours = currentTime.getHours();
    
    // 早上时段 (6:00-12:00)
    if (hours >= 6 && hours < 12) {
      if (!completedTasks.meditation) return 'MEDITATION';
      if (!completedTasks.task) return 'TASK';
      return 'FOCUS';
    }
    
    // 白天时段 (12:00-18:00)
    if (hours >= 12 && hours < 18) {
      return 'FOCUS';
    }
    
    // 晚上时段 (18:00-6:00)
    if (!completedTasks.summary) return 'SUMMARY';
    return 'JOURNAL';
  };
  
  
  // 获取菜单项样式
  const getMenuItemStyle = (menuName) => {
    const normalizedMenuName = menuName.toLowerCase();
    const isHighlighted = getCurrentHighlightedFunction() === menuName;
    const isCompleted = completedTasks[normalizedMenuName];
    const isMeditating = normalizedMenuName === 'meditation' && activeMeditation;
    
    // 只使用透明度来区分状态，不使用颜色
    return {
      opacity: isHighlighted ? 1 : (isCompleted && !isMeditating) ? 0.4 : 0.6,
      color: '#fff' // 所有菜单项都使用白色
    };
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部日期 */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{formatDate()}</Text>
      </View>
      
      {/* 名言显示 */}
      <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
        <Text style={styles.quoteText}>"{quote}"</Text>
      </Animated.View>
      
      {/* 主菜单 - 绝对定位在屏幕中心 */}
      <View style={styles.menuContainer}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('meditation')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('MEDITATION')]}>
            MEDITATION
            {activeMeditation && (
              <Text style={styles.meditationTimer}>
                {" "}({formatTime(activeMeditation.remainingTime)})
              </Text>
            )}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('task')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('TASK')]}>
            TASK
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('focus')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('FOCUS')]}>
            FOCUS
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('summary')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('SUMMARY')]}>
            SUMMARY
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('journal')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('JOURNAL')]}>
            JOURNAL
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* 设置按钮 - 底部中央 */}
      <View style={styles.settingsContainer}>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => console.log('Settings pressed')}
        >
          <Text style={styles.settingsText}>SETTINGS</Text>
        </TouchableOpacity>
      </View>
      
      <StatusBar hidden={true} />
    </SafeAreaView>
  );
};

// 主应用组件
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MeditationProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#000' },
              animationEnabled: true,
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Meditation" component={MeditationScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </MeditationProvider>
      <StatusBar hidden={true} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  dateContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  dateText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '300',
    letterSpacing: 1,
  },
  quoteContainer: {
    alignItems: 'center',
    marginBottom: 40,
    width: '70%',
    alignSelf: 'center',
  },
  quoteText: {
    fontSize: 18,
    color: '#aaa',
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  menuItem: {
    paddingVertical: 15,
    marginVertical: 5,
    width: '100%',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    color: '#fff',
  },
  settingsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  settingsText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
    letterSpacing: 1,
  },
  meditationTimer: {
    fontSize: 20,
    fontWeight: '400',
    color: '#aaa',
  },
});
