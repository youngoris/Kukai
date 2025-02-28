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
  
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [location, setLocation] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  
  // 在HomeScreen组件中添加一个ref来跟踪是否是初始加载
  const isInitialMount = useRef(true);
  
  // 使用ref追踪坐标变化
  const previousCoords = useRef(null);
  
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
  
  // Add this function to map OpenWeather icon codes to MaterialCommunityIcons
  const getWeatherIcon = (iconCode) => {
    const weatherIcons = {
      '01d': 'weather-sunny',
      '01n': 'weather-night',
      '02d': 'weather-partly-cloudy',
      '02n': 'weather-night-partly-cloudy',
      '03d': 'weather-cloudy',
      '03n': 'weather-cloudy',
      '04d': 'weather-cloudy',
      '04n': 'weather-cloudy',
      '09d': 'weather-pouring',
      '09n': 'weather-pouring',
      '10d': 'weather-rainy',
      '10n': 'weather-rainy',
      '11d': 'weather-lightning',
      '11n': 'weather-lightning',
      '13d': 'weather-snowy',
      '13n': 'weather-snowy',
      '50d': 'weather-fog',
      '50n': 'weather-fog',
    };

    return weatherIcons[iconCode] || 'weather-cloudy';
  };
  
  // 修改天气获取功能
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setIsLoadingWeather(true);
        setWeatherError(null);
        
        // 获取位置权限
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setWeatherError('位置权限被拒绝');
          setIsLoadingWeather(false);
          console.log('位置权限被拒绝');
          return;
        }

        // 获取当前位置 - 添加超时和高精度选项
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          mayShowUserSettingsDialog: true
        });
        
        if (!location) {
          throw new Error('无法获取位置信息');
        }
        
        setLocation(location);
        console.log('位置获取成功:', location.coords.latitude, location.coords.longitude);

        // 使用OpenWeather API获取天气数据
        const apiKey = '847915028262f4981a07546eb43696ce';
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}&units=metric&appid=${apiKey}`;
        
        console.log('正在请求天气数据:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('天气API响应错误:', response.status, errorText);
          throw new Error(`天气数据获取失败: ${response.status}`);
        }
        
        const weatherData = await response.json();
        console.log('天气数据获取成功:', weatherData);
        setWeather(weatherData);

        // 保存天气数据到AsyncStorage
        if (weatherData) {
          await AsyncStorage.setItem('currentWeatherData', JSON.stringify({
            weather: weatherData.weather[0].main,
            temperature: Math.round(weatherData.main.temp),
            location: weatherData.name,
            timestamp: new Date().toISOString(),
            data: weatherData
          }));
        }
      } catch (error) {
        console.error('获取天气时出错:', error.message);
        setWeatherError(`无法获取天气: ${error.message}`);
      } finally {
        setIsLoadingWeather(false);
      }
    };

    // 检查坐标是否显著变化
    const hasLocationChanged = () => {
      if (!previousCoords.current || !location) return true;
      
      const distance = calculateDistance(
        previousCoords.current.latitude,
        previousCoords.current.longitude,
        location.coords.latitude,
        location.coords.longitude
      );
      
      // 仅当位置变化超过1公里时才更新
      return distance > 1;
    };
    
    if (hasLocationChanged()) {
      if (location) {
        previousCoords.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      }
      fetchWeather();
    }
    
    const weatherInterval = setInterval(fetchWeather, 1800000);
    return () => clearInterval(weatherInterval);
  }, [location]);
  
  // 辅助函数计算两点之间的距离（单位：公里）
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
              name="weather-cloudy-alert"
              size={22}
              color="#ff6b6b"
              style={styles.weatherIcon}
            />
            <Text style={[styles.weatherText, {color: '#ff6b6b'}]}>--°C</Text>
          </View>
        ) : weather && (
          <View style={styles.weatherContainer}>
            <MaterialCommunityIcons 
              name={getWeatherIcon(weather.weather[0].icon)}
              size={22}
              color="#fff"
              style={styles.weatherIcon}
            />
            <Text style={styles.weatherText}>
              {Math.round(weather.main.temp)}°C
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
    <NavigationContainer>
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
        <Stack.Screen 
          name="Meditation" 
          component={MeditationScreen} 
          options={{
            gestureEnabled: true,
          }}
        />
        <Stack.Screen 
          name="Task" 
          component={TaskScreen}
        />
        <Stack.Screen 
          name="Focus" 
          component={FocusScreen}
        />
        <Stack.Screen 
          name="Summary" 
          component={SummaryScreen}
        />
        <Stack.Screen 
          name="Journal" 
          component={JournalScreen}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{
            gestureEnabled: false, // 禁用设置页面的手势导航
          }}
        />
        <Stack.Screen 
          name="JournalEdit" 
          component={JournalEditScreen} 
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// 主应用组件
export default function App() {
  // 加载字体
  let [fontsLoaded] = useFonts({
    Roboto_300Light,
    Roboto_400Regular, 
    Roboto_500Medium,
    Roboto_700Bold
  });

  // 等待字体加载
  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <>
      <StatusBar hidden={true} />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppNavigator />
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
