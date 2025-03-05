import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';
import MeditationScreen from './MeditationScreen';
import TaskScreen from './TaskScreen';
import FocusScreen from './FocusScreen';
import SummaryScreen from './SummaryScreen';
import JournalScreen from './JournalScreen';
import SettingsScreen from './SettingsScreen';
import { useFonts, Roboto_300Light, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import AppLoading from 'expo-app-loading';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import JournalEditScreen from './JournalEditScreen';
import { MaterialIcons } from '@expo/vector-icons';
import googleDriveService from './services/GoogleDriveService';
import notificationService from './services/NotificationService';
import { WEATHER_API, CACHE, ERROR_TYPES, STORAGE_KEYS } from './constants/Config';
import useWeather from './utils/useWeather'; // 导入天气Hook
import NotificationHistoryScreen from './NotificationHistoryScreen';

const { width, height } = Dimensions.get('window');
const Stack = createStackNavigator();

// Define screen order
const SCREEN_ORDER = [
  'Meditation',
  'Task',
  'Focus',
  'Summary',
  'Journal'
];

// Navigation helper functions
const getNextScreen = (currentScreen) => {
  const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
  if (currentIndex < SCREEN_ORDER.length - 1) {
    return SCREEN_ORDER[currentIndex + 1];
  }
  return null;
};

const getPreviousScreen = (currentScreen) => {
  const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
  if (currentIndex > 0) {
    return SCREEN_ORDER[currentIndex - 1];
  }
  return null;
};

// Quote database
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
  
  // 添加一个标记，用于识别是首次加载还是返回
  const isFirstLoad = useRef(true);
  const previousTimeOfDay = useRef(timeOfDay);
  
  // 使用自定义Hook获取天气数据
  const { 
    weather, 
    temperature, 
    location, 
    isLoading: isLoadingWeather, 
    error: weatherError,
    getWeatherIcon,
    getErrorIcon
  } = useWeather();
  
  // 在HomeScreen组件中添加一个ref来跟踪是否是初始加载
  const isInitialMount = useRef(true);
  
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
  
  // 设置名言 - 更新动画效果为直接淡入
  useEffect(() => {
    // 根据时间选择名言类别
    const quoteList = quotes[timeOfDay];
    // 随机选择一条名言
    const randomIndex = Math.floor(Math.random() * quoteList.length);
    
    // 首次加载时直接设置不做动画
    if (isFirstLoad.current) {
      setQuote(quoteList[randomIndex]);
      fadeAnim.setValue(1); // 直接设置为可见
      isFirstLoad.current = false;
    } 
    else if (previousTimeOfDay.current !== timeOfDay) {
      // 时段变化时更新引用 - 直接更新而不是先淡出再淡入
      
      // 立即将旧引用隐藏并更新内容
      fadeAnim.setValue(0);
      setQuote(quoteList[randomIndex]);
      
      // 直接淡入新引用
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800, // 使用略短的时间
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic), // 使用更平滑的缓动函数
      }).start();
    }
    
    // 更新前一个时段引用
    previousTimeOfDay.current = timeOfDay;
  }, [timeOfDay]);
  
  // 将 useFocusEffect 添加到组件中
  useFocusEffect(
    useCallback(() => {
      // 从其他屏幕返回时，只有在需要时才刷新引用
      if (!isFirstLoad.current && fadeAnim._value < 1) {
        // 如果由于某种原因引用是不可见的，确保它变为可见
        fadeAnim.setValue(1);
      }
      
      return () => {
        // 此处可以放置清理代码（如果需要）
      };
    }, [])
  );
  
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
        navigation.navigate('Task');
        break;
      case 'focus':
        navigation.navigate('Focus');
        break;
      case 'summary':
        navigation.navigate('Summary');
        break;
      case 'journal':
        navigation.navigate('Journal');
        break;
      case 'settings':
        navigation.navigate('Settings');
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
    
    // 只使用透明度来区分状态，不使用颜色
    return {
      opacity: isHighlighted ? 1 : isCompleted ? 0.4 : 0.6,
      color: '#fff' // 所有菜单项都使用白色
    };
  };
  
  // 修改天气错误显示逻辑
  const getWeatherErrorIcon = () => {
    if (!weatherError) return 'weather-cloudy-alert';
    
    const errorIcon = getErrorIcon();
    // 如果错误图标不是以'weather-'开头，则添加前缀
    return errorIcon.startsWith('weather-') ? errorIcon : `weather-${errorIcon}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部日期 */}
      <View style={styles.headerContainer}>
        <Text style={styles.dateText}>{formatDate()}</Text>
        
        {/* Weather display */}
        {isLoadingWeather ? (
          <View style={styles.weatherContainer}>
            <Text style={styles.weatherText}>...</Text>
          </View>
        ) : weatherError ? (
          <View style={styles.weatherContainer}>
            <MaterialCommunityIcons 
              name={getWeatherErrorIcon()}
              size={22}
              color="#ff6b6b"
              style={styles.weatherIcon}
            />
            <Text style={[styles.weatherText, {color: '#ff6b6b'}]}>--°C</Text>
          </View>
        ) : weather && (
          <View style={styles.weatherContainer}>
            <MaterialCommunityIcons 
              name={`weather-${getWeatherIcon(weather.icon)}`}
              size={22}
              color="#fff"
              style={styles.weatherIcon}
            />
            <Text style={styles.weatherText}>
              {temperature}°C
            </Text>
          </View>
        )}
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
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialIcons name="settings" size={18} color="#888" />
          <Text style={styles.settingsText}>SETTINGS</Text>
        </TouchableOpacity>
      </View>
      
      <StatusBar style="light" />
    </SafeAreaView>
  );
};

// 自定义导航容器组件
const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        cardStyle: { backgroundColor: '#000' },
        animationEnabled: true,
        gestureEnabled: route.name !== 'Home' && route.name !== 'Settings',
        gestureDirection: route.name === 'Home' ? 'horizontal-inverted' : 'horizontal',
        gestureResponseDistance: {
          horizontal: width * 0.5,
        },
        cardStyleInterpolator: ({ current, layouts, next }) => {
          // 检查是否是返回到 Home 屏幕的导航
          const isGoingHome = next?.route?.name === 'Home' || route.name === 'Home';
          
          // 如果是返回到 Home，使用相反的动画方向
          if (isGoingHome) {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          }
          
          // 默认从右向左的动画
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      })}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Meditation" component={MeditationScreen} />
      <Stack.Screen name="Task" component={TaskScreen} />
      <Stack.Screen name="Focus" component={FocusScreen} />
      <Stack.Screen name="Summary" component={SummaryScreen} />
      <Stack.Screen name="Journal" component={JournalScreen} />
      <Stack.Screen name="JournalEdit" component={JournalEditScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NotificationHistory" component={NotificationHistoryScreen} />
    </Stack.Navigator>
  );
};

// 主应用组件
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    Roboto_300Light,
    Roboto_400Regular, 
    Roboto_500Medium,
    Roboto_700Bold
  });
  
  // Initialize Google Drive service
  useEffect(() => {
    const initializeGoogleDrive = async () => {
      try {
        console.log('Initializing Google Drive service...');
        const initialized = await googleDriveService.initialize();
        console.log('Google Drive service initialized:', initialized);
        
        // If initialized, check if auto sync is needed
        if (initialized) {
          const syncPerformed = await googleDriveService.checkAndPerformAutoSync();
          console.log('Auto sync check performed:', syncPerformed);
        }
      } catch (error) {
        console.error('Failed to initialize Google Drive service:', error);
      }
    };
    
    initializeGoogleDrive();
  }, []);

  // 创建导航引用
  const navigationRef = useRef(null);
  
  // 初始化通知服务
  useEffect(() => {
    notificationService.initialize().then(initialized => {
      if (initialized) {
        console.log('Notification system initialized successfully');
      } else {
        console.log('Notification system initialization failed, permissions may have been denied');
      }
    });
    
    // 清理通知监听器
    return () => {
      notificationService.cleanup();
    };
  }, []);
  
  // 设置导航引用
  useEffect(() => {
    if (navigationRef.current) {
      notificationService.setNavigationRef(navigationRef.current);
    }
  }, [navigationRef.current]);

  // Wait for fonts to load
  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <>
      <StatusBar hidden={true} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
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
  weatherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  weatherIcon: {
    marginRight: 5,
  },
  weatherText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
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
    fontSize: 40,
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
});
