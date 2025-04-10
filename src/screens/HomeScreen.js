/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import storageService from "../services/storage/StorageService";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useWeather from "../utils/useWeather";
import { navigateWithDirection } from "../navigation/NavigationUtils";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { ERROR_TYPES } from "../constants/Config";
import * as FileSystem from 'expo-file-system';
import { format } from 'date-fns';

// Quote database
const quotes = {
  morning: [
    "Start is half of success.",
    "Focus on the present, reap the future.",
    "Today's efforts are tomorrow's rewards.",
    "Every morning is a fresh opportunity.",
    "Eat that frog first thing in the morning.",
  ],
  day: [
    "One focused hour is worth two distracted ones.",
    "Small steps lead to big achievements.",
    "Stay focused, stay productive.",
    "Break it down, build it up.",
    "The key to productivity is not working harder, but smarter.",
  ],
  evening: [
    "Reflect on today, plan for tomorrow.",
    "Every day's effort is worth recording.",
    "Quiet your mind, listen to your inner voice.",
    "Today's reflection is tomorrow's wisdom.",
    "Review makes perfect.",
  ],
};

// Main screen component
const HomeScreen = ({ navigation }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeOfDay, setTimeOfDay] = useState("morning"); // 'morning', 'day', 'evening'
  const [quote, setQuote] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [completedTasks, setCompletedTasks] = useState({
    meditation: false,
    task: false,
    focus: false,
    summary: false,
    journal: false,
  });
  const [hasTakenPhotoToday, setHasTakenPhotoToday] = useState(false);
  const circleScaleAnim = useRef(new Animated.Value(1)).current;

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
    getErrorIcon,
    getWeatherErrorMessage,
    fetchWeather,
  } = useWeather();

  // Add a ref in HomeScreen component to track if it's initial load
  const isInitialMount = useRef(true);

  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults();
        // Apply any settings needed for HomeScreen
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  // Load completed tasks on component mount
  useEffect(() => {
    loadCompletedTasks();
  }, []);

  // Load completed tasks state
  const loadCompletedTasks = async () => {
    try {
      // Get today's date string as key
      const today = new Date().toISOString().split("T")[0];

      const savedTasks = await storageService.getItem("completedTasks");
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);

        // If it's a new day, reset all task states
        if (!parsedTasks[today]) {
          const newState = { ...parsedTasks, [today]: {} };
          setCompletedTasks(newState);
          await saveCompletedTasks(newState);
        } else {
          setCompletedTasks(parsedTasks);
        }
      } else {
        // Initialize with today's empty object
        const newState = { [today]: {} };
        setCompletedTasks(newState);
        await saveCompletedTasks(newState);
      }
    } catch (error) {
      console.error("Error loading completed tasks:", error);
    }
  };

  // Save completed tasks state
  const saveCompletedTasks = async (newState) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      await storageService.setItem("completedTasks", JSON.stringify(newState));
    } catch (error) {
      console.error("Error saving completed tasks:", error);
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
        newTimeOfDay = "morning";
      } else if (hours >= 12 && hours < 18) {
        newTimeOfDay = "day";
      } else {
        newTimeOfDay = "evening";
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
    } else if (previousTimeOfDay.current !== timeOfDay) {
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
    }, []),
  );

  // Format date
  const formatDate = () => {
    return currentTime.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Handle function access
  const handleFunctionAccess = (taskName) => {
    // Record function access status
    const today = new Date().toISOString().split("T")[0];
    const newCompletedTasks = { ...completedTasks };
    
    // Ensure today's date key exists
    if (!newCompletedTasks[today]) {
      newCompletedTasks[today] = {};
    }
    
    // Update specific task completion status
    newCompletedTasks[today][taskName] = true;
    setCompletedTasks(newCompletedTasks);
    saveCompletedTasks(newCompletedTasks);

    // Navigate to corresponding page
    switch (taskName) {
      case "meditation":
        navigateWithDirection(navigation, "Meditation");
        break;
      case "task":
        navigateWithDirection(navigation, "Task");
        break;
      case "focus":
        navigateWithDirection(navigation, "Focus");
        break;
      case "summary":
        navigateWithDirection(navigation, "Summary");
        break;
      case "journal":
        navigateWithDirection(navigation, "Journal");
        break;
      case "settings":
        navigateWithDirection(navigation, "Settings");
        break;
      default:
        console.log(`Accessing ${taskName} function`);
    }
  };

  // Get current highlighted function
  const getCurrentHighlightedFunction = () => {
    const hours = currentTime.getHours();
    const today = new Date().toISOString().split("T")[0];
    const todayTasks = completedTasks[today] || {};

    // Morning time (6:00-12:00)
    if (hours >= 6 && hours < 12) {
      if (!todayTasks.meditation) return "MEDITATION";
      if (!todayTasks.task) return "TASK";
      return "FOCUS";
    }

    // Day time (12:00-18:00)
    if (hours >= 12 && hours < 18) {
      return "FOCUS";
    }

    // Evening time (18:00-6:00)
    if (!todayTasks.summary) return "SUMMARY";
    return "JOURNAL";
  };

  // Get menu item style
  const getMenuItemStyle = (menuName) => {
    const normalizedMenuName = menuName.toLowerCase();
    const isHighlighted = getCurrentHighlightedFunction() === menuName;
    const isCompleted = completedTasks[normalizedMenuName];

    // Use opacity to distinguish state, not color
    return {
      opacity: isHighlighted ? 1 : isCompleted ? 0.4 : 0.6,
      color: "#fff", // All menu items use white
    };
  };

  // Modify weather error display logic
  const getWeatherErrorIcon = () => {
    if (!weatherError) return "weather-cloudy";

    // Get error icon without adding "weather-" prefix, as some icons may not be in the weather category
    const errorIcon = getErrorIcon();
    
    // Check if it's a location error, if so use question mark icon
    if (weatherError.type === ERROR_TYPES.LOCATION) {
      return "help-circle-outline";
    }
    
    // For other error types, use appropriate icon
    return errorIcon;
  };

  // Platform-independent color for weather error
  const weatherErrorColor = "#fff";

  // Function to retry weather fetch when error occurs
  const retryWeatherFetch = () => {
    if (fetchWeather) {
      fetchWeather(true); // Force refresh
    }
  };

  useEffect(() => {
    checkTodayPhoto();
  }, []);

  // Add page focus detection to ensure photo status is updated each time returning to the home page
  useFocusEffect(
    React.useCallback(() => {
      console.log('HomeScreen focused - checking today photo');
      checkTodayPhoto();
      return () => {};
    }, [])
  );

  const checkTodayPhoto = async () => {
    try {
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        try {
          await FileSystem.makeDirectoryAsync(photoDir);
          console.log('Created selfies directory successfully');
        } catch (dirError) {
          console.log(`Directory creation issue: ${dirError.message}`);
          // Still assume no photos since directory couldn't be created
        }
        setHasTakenPhotoToday(false);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      const today = format(new Date(), 'yyyy-MM-dd');
      const hasTodayPhoto = files.some(file => file.startsWith(today));
      setHasTakenPhotoToday(hasTodayPhoto);
    } catch (error) {
      console.error('Error checking today photo:', error);
      // Default to false if we encounter an error
      setHasTakenPhotoToday(false);
    }
  };

  const handleCirclePress = () => {
    // if has taken photo today, navigate to photo gallery
    if (hasTakenPhotoToday) {
      // if has taken photo today, navigate to photo gallery without animation
      navigation.navigate('PhotoGallery', {}, { animation: 'none' });
    } else {
      // if has not taken photo today, navigate to camera page with animation
      Animated.sequence([
        Animated.timing(circleScaleAnim, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]).start(() => {
        navigation.navigate('Camera', {}, { animation: 'none' });
        // Reset scale after navigation
        circleScaleAnim.setValue(1);
      });
    }
  };

  return (
    <View style={[
      styles.container, 
      { 
        // Use StatusBar height directly for Android top padding
        paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : insets.top,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
        paddingLeft: insets.left > 0 ? insets.left : 20,
        paddingRight: insets.right > 0 ? insets.right : 20,
      }
    ]}>
      {/* Top date */}
      <View style={styles.headerContainer}>
        <Text style={styles.dateText}>{formatDate()}</Text>

        {/* Weather display with enhanced error handling */}
        {isLoadingWeather ? (
          <View style={styles.weatherContainer}>
            <MaterialCommunityIcons
              name="weather-partly-cloudy"
              size={22}
              color="#aaa"
              style={[styles.weatherIcon, { opacity: 0.7 }]}
            />
            <Text style={[styles.weatherText, { color: "#aaa" }]}>...</Text>
          </View>
        ) : weatherError ? (
          <TouchableOpacity 
            style={styles.weatherContainer} 
            onPress={retryWeatherFetch}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={getWeatherErrorIcon()}
              size={22}
              color={weatherErrorColor}
              style={styles.weatherIcon}
            />
            <Text style={[styles.weatherText, { color: weatherErrorColor }]}>--°C</Text>
          </TouchableOpacity>
        ) : (
          weather && (
            <View style={styles.weatherContainer}>
              <MaterialCommunityIcons
                name={`weather-${getWeatherIcon(weather.icon)}`}
                size={22}
                color="#fff"
                style={styles.weatherIcon}
              />
              <Text style={styles.weatherText}>{temperature}°C</Text>
            </View>
          )
        )}
      </View>

      {/* Quote display */}
      <View style={{height: 100}}>
        <Animated.View style={[styles.quoteContainer, { opacity: fadeAnim }]}>
          <Text style={styles.quoteText}>"{quote}"</Text>
        </Animated.View>
      </View>

      {/* Main menu - Absolute positioning in screen center */}
      <View style={[styles.menuContainer]}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFunctionAccess("meditation")}
        >
          <Text style={[styles.menuText, getMenuItemStyle("MEDITATION")]}>
            MEDITATION
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFunctionAccess("task")}
        >
          <Text style={[styles.menuText, getMenuItemStyle("TASK")]}>TASK</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFunctionAccess("focus")}
        >
          <Text style={[styles.menuText, getMenuItemStyle("FOCUS")]}>
            FOCUS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFunctionAccess("summary")}
        >
          <Text style={[styles.menuText, getMenuItemStyle("SUMMARY")]}>
            SUMMARY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleFunctionAccess("journal")}
        >
          <Text style={[styles.menuText, getMenuItemStyle("JOURNAL")]}>
            JOURNAL
          </Text>
        </TouchableOpacity>
      </View>

      {/* White circle button between menu and settings */}
      <View style={[styles.circleButtonContainer, {
        bottom: insets.bottom > 0 ? insets.bottom + 95 : 100,
        left: insets.left,
        right: insets.right,
        zIndex: 20,
      }]}>
        <Animated.View style={[{
          transform: [{ scale: circleScaleAnim }],
        }]}>
          {Platform.OS === 'android' && !hasTakenPhotoToday && (
            <>
              <View style={styles.androidGlowOuter} />
              <View style={styles.androidGlowMiddle} />
              <View style={styles.androidGlowInner} />
            </>
          )}
          <TouchableOpacity
            style={[
              styles.circleButton,
              !hasTakenPhotoToday && styles.circleButtonHighlight
            ]}
            onPress={handleCirclePress}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          />
        </Animated.View>
      </View>

      {/* Settings button - Bottom center */}
      <View style={[styles.settingsContainer, {
        bottom: insets.bottom > 0 ? insets.bottom + 10 : 30,
        left: insets.left,
        right: insets.right,
        zIndex: 20,
      }]}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate("Settings")}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <MaterialIcons name="settings" size={18} color="#888" />
          <Text style={styles.settingsText}>SETTINGS</Text>
        </TouchableOpacity>
      </View>

      {/* Use StatusBar component to hide system status bar */}
      <StatusBar style="light" hidden={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    position: "relative",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Platform.OS === 'ios' ? 10 : 20,
    marginBottom: 30,
  },
  dateText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "300",
    letterSpacing: 1,
  },
  weatherContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  weatherIcon: {
    marginRight: 5,
  },
  weatherText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "400",
  },
  weatherErrorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "300",
  },
  quoteContainer: {
    alignItems: "center",
    width: "70%",
    alignSelf: "center",
  },
  quoteText: {
    fontSize: 18,
    color: "#aaa",
    fontWeight: "400",
    fontStyle: "italic",
    lineHeight: 24,
    textAlign: "center",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menuItem: {
    paddingVertical: 15,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
  },
  menuText: {
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    color: "#fff",
  },
  settingsContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: -5,
  },
  settingsText: {
    color: "#888",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
    letterSpacing: 1,
  },
  circleButtonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#555', 
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  circleButtonHighlight: {
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
      },
      android: {
        elevation: 6,
      }
    }),
  },
  androidGlowOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -22,
    left: -22,
    zIndex: -3,
  },
  androidGlowMiddle: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    top: -14,
    left: -14,
    zIndex: -2,
  },
  androidGlowInner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    top: -6,
    left: -6,
    zIndex: -1,
  },
});

export default HomeScreen;
