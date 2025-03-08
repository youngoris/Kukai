import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import useWeather from '../utils/useWeather';

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

// Main screen component
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
  
  // Add a flag to track if it's first load or return
  const isFirstLoad = useRef(true);
  const previousTimeOfDay = useRef(timeOfDay);
  
  // Use custom Hook to get weather data
  const { 
    weather, 
    temperature, 
    location, 
    isLoading: isLoadingWeather, 
    error: weatherError,
    getWeatherIcon,
    getErrorIcon
  } = useWeather();
  
  // Add a ref in HomeScreen component to track if it's initial load
  const isInitialMount = useRef(true);
  
  // Load completed tasks state
  const loadCompletedTasks = async () => {
    try {
      // Get today's date string as key
      const today = new Date().toISOString().split('T')[0];
      
      const savedTasks = await AsyncStorage.getItem('completedTasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        
        // If it's a new day, reset all task states
        if (!parsedTasks[today]) {
          const newState = { [today]: {} };
          setCompletedTasks(newState);
        } else {
          setCompletedTasks(parsedTasks);
        }
      } else {
        // Initialize with today's empty object
        const newState = { [today]: {} };
        setCompletedTasks(newState);
      }
    } catch (error) {
      console.error('Error loading completed tasks:', error);
    }
  };
  
  // Save completed tasks state
  const saveCompletedTasks = async (newState) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await AsyncStorage.setItem('completedTasks', JSON.stringify(newState));
    } catch (error) {
      console.error('Error saving completed tasks:', error);
    }
  };
  
  // Update time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Determine the time of day
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
  
  // Set quote - Update animation effect to direct fade in
  useEffect(() => {
    // Select quote based on time of day
    const quoteList = quotes[timeOfDay];
    // Randomly select a quote
    const randomIndex = Math.floor(Math.random() * quoteList.length);
    
    // First load directly set without animation
    if (isFirstLoad.current) {
      setQuote(quoteList[randomIndex]);
      fadeAnim.setValue(1); // Directly set to visible
      isFirstLoad.current = false;
    } 
    else if (previousTimeOfDay.current !== timeOfDay) {
      // Time change update reference - Directly update instead of fade out then fade in
      
      // Immediately hide old reference and update content
      fadeAnim.setValue(0);
      setQuote(quoteList[randomIndex]);
      
      // Directly fade in new reference
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800, // Use slightly shorter time
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic), // Use smoother easing function
      }).start();
    }
    
    // Update previous time reference
    previousTimeOfDay.current = timeOfDay;
  }, [timeOfDay]);
  
  // Add useFocusEffect to component
  useFocusEffect(
    useCallback(() => {
      // From other screens, refresh reference only when needed
      if (!isFirstLoad.current && fadeAnim._value < 1) {
        // If reference is invisible for some reason, ensure it becomes visible
        fadeAnim.setValue(1);
      }
      
      return () => {
        // Place cleanup code here (if needed)
      };
    }, [])
  );
  
  // Format date
  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Handle function access
  const handleFunctionAccess = (taskName) => {
    // Record function access status
    const newCompletedTasks = { ...completedTasks };
    newCompletedTasks[taskName] = true;
    setCompletedTasks(newCompletedTasks);
    saveCompletedTasks(newCompletedTasks);
    
    // Navigate to corresponding page
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
  
  // Get current highlighted function
  const getCurrentHighlightedFunction = () => {
    const hours = currentTime.getHours();
    
    // Morning time (6:00-12:00)
    if (hours >= 6 && hours < 12) {
      if (!completedTasks.meditation) return 'MEDITATION';
      if (!completedTasks.task) return 'TASK';
      return 'FOCUS';
    }
    
    // Day time (12:00-18:00)
    if (hours >= 12 && hours < 18) {
      return 'FOCUS';
    }
    
    // Evening time (18:00-6:00)
    if (!completedTasks.summary) return 'SUMMARY';
    return 'JOURNAL';
  };
  
  
  // Get menu item style
  const getMenuItemStyle = (menuName) => {
    const normalizedMenuName = menuName.toLowerCase();
    const isHighlighted = getCurrentHighlightedFunction() === menuName;
    const isCompleted = completedTasks[normalizedMenuName];
    
    // Use opacity to distinguish state, not color
    return {
      opacity: isHighlighted ? 1 : isCompleted ? 0.4 : 0.6,
      color: '#fff' // All menu items use white
    };
  };
  
  // Modify weather error display logic
  const getWeatherErrorIcon = () => {
    if (!weatherError) return 'weather-cloudy-alert';
    
    const errorIcon = getErrorIcon();
    // If error icon is not prefixed with 'weather-', add prefix
    return errorIcon.startsWith('weather-') ? errorIcon : `weather-${errorIcon}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top date */}
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
      
      {/* Quote display */}
      <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
        <Text style={styles.quoteText}>"{quote}"</Text>
      </Animated.View>
      
      {/* Main menu - Absolute positioning in screen center */}
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
      
      {/* Settings button - Bottom center */}
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

export default HomeScreen; 