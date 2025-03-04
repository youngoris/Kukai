import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Animated, 
  Easing,
  Dimensions,
  SafeAreaView,
  LogBox,
  Vibration,
  StatusBar,
  Platform,
  Alert,
  BackHandler,
  Image,
  FlatList
} from 'react-native';
import { AntDesign, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Progress from 'react-native-progress';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { SPACING, FONT_SIZE, FONT_FAMILY, COLORS, LAYOUT, SHADOWS } from './constants/DesignSystem';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ignore specific warnings
LogBox.ignoreLogs(['Animated: `useNativeDriver`']);

const { width } = Dimensions.get('window');
const TIMER_SIZE = width * 0.8;

// Define sound themes
const soundThemes = [
  { id: 'silence', label: 'Silence', icon: 'volume-mute', source: null },
  { id: 'whitenoise', label: 'Bright', icon: 'sunny', source: require('./assets/whitenoise.m4a') },
  { id: 'brownnoise', label: 'Dark', icon: 'moon', source: require('./assets/brownnoise.m4a') },
  { id: 'rain', label: 'Rain', icon: 'rainy', source: require('./assets/rain.m4a') },
  { id: 'forest', label: 'Forest', icon: 'leaf', source: require('./assets/forest.m4a') },
  { id: 'ocean', label: 'Ocean', icon: 'water', source: require('./assets/ocean.m4a') },
  { id: 'fire', label: 'Fire', icon: 'flame', source: require('./assets/fire.m4a') },
  { id: 'plane', label: 'Plane', icon: 'airplane', source: require('./assets/plane.m4a') }
];

// Define quick duration options
const durationOptions = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' }
];

const MeditationScreen = ({ navigation }) => {
  // Session state
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [isMeditating, setIsMeditating] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fluidProgressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  
  // References
  const [sound, setSound] = useState();
  const [backgroundSound, setBackgroundSound] = useState();
  const meditationTimer = useRef(null);
  const countdownTimer = useRef(null);
  const meditationStartTime = useRef(0);
  const animationFrameId = useRef(null);
  
  // New state variables
  const [customDuration, setCustomDuration] = useState(10); // Default custom duration
  const [selectedSoundTheme, setSelectedSoundTheme] = useState('silence'); // 默认设置为静音
  
  // Load settings from AsyncStorage when screen focuses
  useFocusEffect(
    useCallback(() => {
      const loadMeditationSettings = async () => {
        try {
          // 使用userSettings作为存储键名以匹配SettingsScreen.js
          const settingsData = await AsyncStorage.getItem('userSettings');
          if (settingsData) {
            const parsedSettings = JSON.parse(settingsData);
            console.log('Loaded meditation settings:', parsedSettings);
            
            // Update meditation duration from settings
            if (parsedSettings.meditationDuration) {
              console.log('Setting meditation duration to:', parsedSettings.meditationDuration);
              setCustomDuration(parsedSettings.meditationDuration);
            }
            
            // Update sound theme from settings
            if (parsedSettings.selectedSoundTheme) {
              console.log('Setting sound theme to:', parsedSettings.selectedSoundTheme);
              setSelectedSoundTheme(parsedSettings.selectedSoundTheme);
            }
          } else {
            console.log('No settings data found');
          }
        } catch (error) {
          console.error('Error loading meditation settings:', error);
        }
      };
      
      loadMeditationSettings();
      return () => {};
    }, [navigation])
  );
  
  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isMeditating) {
          // Show confirmation dialog when trying to exit during meditation
          Alert.alert(
            "End Meditation",
            "Are you sure you want to end your current meditation session?",
            [
              { text: "Continue", style: "cancel" },
              { 
                text: "End Session", 
                onPress: () => endMeditation(() => navigation.navigate('Home')),
                style: "destructive"
              }
            ]
          );
          return true;
        }
        
        // Allow normal back navigation if not meditating
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [isMeditating, navigation])
  );
  
  // Clean up animation frames
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, []);
  
  // Preload sound effects
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3' }, 
          { volume: 0.7 }
        );
        setSound(sound);
      } catch (error) {
        console.log('Unable to preload sound effect', error);
      }
    };
    
    loadSound();
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);
  
  // Play background sound when meditation starts
  useEffect(() => {
    const playBackgroundSound = async () => {
      try {
        // Unload previous sound if any
        if (backgroundSound) {
          await backgroundSound.unloadAsync();
        }
        
        // Don't load sound for silence option
        if (selectedSoundTheme === 'silence' || !isMeditating) return;
        
        // Find the selected sound theme
        const theme = soundThemes.find(theme => theme.id === selectedSoundTheme);
        if (!theme || !theme.source) return;
        
        // Create and play the sound from local asset
        const { sound: newSound } = await Audio.Sound.createAsync(
          theme.source,
          { volume: 0.5, isLooping: true }
        );
        
        setBackgroundSound(newSound);
        await newSound.playAsync();
      } catch (error) {
        console.log('Error playing background sound:', error);
      }
    };
    
    playBackgroundSound();
    
    return () => {
      // Clean up background sound when component unmounts
      if (backgroundSound) {
        backgroundSound.unloadAsync();
      }
    };
  }, [isMeditating, selectedSoundTheme]);
  
  // Breathing animation effect
  useEffect(() => {
    if (isMeditating) {
      // Create looping breath animation
      const breathAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.05,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      );
      
      // Create pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false
          })
        ])
      );
      
      breathAnimation.start();
      pulseAnimation.start();
    
    return () => {
        breathAnimation.stop();
        pulseAnimation.stop();
        // Reset animation values
      breatheAnim.setValue(1);
      pulseAnim.setValue(0);
    };
    }
  }, [isMeditating, breatheAnim, pulseAnim]);
  
  // Smooth progress animation
  useEffect(() => {
    if (isMeditating && totalTime > 0) {
      // Calculate correct progress value (0 to 1)
      const targetProgress = (totalTime - remainingTime) / totalTime;
      
      // Use a consistent animation duration for smoother experience
      const animationDuration = 950; // Just under 1 second for smoother transitions
      
      Animated.timing(progressAnim, {
        toValue: targetProgress,
        duration: animationDuration,
        easing: Easing.linear,
        useNativeDriver: false
      }).start();
      
      // Calculate fluid height - using square root for more natural visual effect
      const fluidHeight = Math.sqrt(targetProgress);
      
      Animated.timing(fluidProgressAnim, {
        toValue: fluidHeight,
        duration: animationDuration,
        easing: Easing.cubic, // More natural cubic easing
        useNativeDriver: false
      }).start();
    }
  }, [remainingTime, isMeditating, totalTime, progressAnim, fluidProgressAnim]);
  
  // Countdown timer
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      countdownTimer.current = setInterval(() => {
        setCountdown(prevCount => prevCount - 1);
      }, 1000);
    } else if (isCountingDown && countdown === 0) {
      // Countdown finished, start meditation
      setIsCountingDown(false);
      setIsMeditating(true);
      meditationStartTime.current = Date.now();
    }
    
    return () => {
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    };
  }, [isCountingDown, countdown]);
  
  // Meditation timer
  useEffect(() => {
    if (isMeditating && remainingTime > 0) {
      meditationTimer.current = setInterval(() => {
        setRemainingTime(prevTime => {
          const newTime = prevTime - 1;
          // Update progress
          setProgress(1 - (newTime / totalTime));
          return newTime;
        });
      }, 1000);
    } else if (isMeditating && remainingTime === 0) {
      // Meditation complete
      Vibration.vibrate(500); // Vibration notification
      
      // Handle meditation completion
      handleMeditationComplete(selectedDuration);
    }
    
    return () => {
      if (meditationTimer.current) {
        clearInterval(meditationTimer.current);
        meditationTimer.current = null;
      }
    };
  }, [isMeditating, remainingTime, totalTime, selectedDuration]);
  
  // Function to start meditation with selected duration
  const startMeditation = () => {
    console.log('Starting meditation with duration:', customDuration);
    setSelectedDuration(customDuration);
    setRemainingTime(customDuration * 60);
    setTotalTime(customDuration * 60);
    setIsCountingDown(true);
  };
  
  // Function to handle quick duration selection
  const selectQuickDuration = (minutes) => {
    console.log('Selected quick duration:', minutes);
    setCustomDuration(minutes);
  };
  
  // Format time helper (mm:ss)
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);
  
  // End meditation and clean up
  const endMeditation = useCallback((callback) => {
    // Stop timers
    if (meditationTimer.current) {
      clearInterval(meditationTimer.current);
      meditationTimer.current = null;
    }
    
    // Stop background sound
    if (backgroundSound) {
      backgroundSound.stopAsync();
    }
    
    // Reset animation values
    breatheAnim.setValue(1);
    pulseAnim.setValue(0);
    
    // Reset state
    setIsMeditating(false);
    setSelectedDuration(null);
    setProgress(0);
    setRemainingTime(0);
    
    // Execute callback if provided
    if (typeof callback === 'function') {
      callback();
    }
  }, [breatheAnim, pulseAnim, backgroundSound]);
  
  // Handle meditation complete
  const handleMeditationComplete = useCallback((durationInMinutes) => {
    console.log('Meditation completed, duration:', durationInMinutes);
    
    // Save meditation session data
    saveMeditationSession(durationInMinutes);
    
    // Play completion sound
    playCompletionSound();
    
    // Show completion message
    Alert.alert(
      "Meditation Complete",
      "You've completed " + durationInMinutes + " minutes of meditation",
      [{ text: "Continue", onPress: () => navigation.navigate('Task') }]
    );
  }, [navigation]);
  
  // Save meditation session to storage
  const saveMeditationSession = useCallback(async (durationInMinutes) => {
    try {
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Create new session object
      const newSession = {
        date: today,
        duration: durationInMinutes,
        soundTheme: selectedSoundTheme,
        timestamp: new Date().toISOString()
      };
      
      // Load existing meditation sessions
      let sessions = [];
      const savedSessions = await AsyncStorage.getItem('meditationSessions');
      if (savedSessions) {
        sessions = JSON.parse(savedSessions);
      }
      
      // Add new session and save back to storage
      sessions.push(newSession);
      await AsyncStorage.setItem('meditationSessions', JSON.stringify(sessions));
      
      // Also update completed tasks for today
      const completedTasksKey = `completed_${today}`;
      let completedTasks = { meditation: true };
      
      const savedTasks = await AsyncStorage.getItem(completedTasksKey);
      if (savedTasks) {
        completedTasks = { ...JSON.parse(savedTasks), meditation: true };
      }
      
      await AsyncStorage.setItem(completedTasksKey, JSON.stringify(completedTasks));
      
      console.log('Meditation session saved successfully');
    } catch (error) {
      console.log('Error saving meditation session:', error);
    }
  }, [selectedSoundTheme]);
  
  // Play completion sound
  const playCompletionSound = useCallback(async () => {
    try {
      if (sound) {
        await sound.replayAsync();
      }
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  }, [sound]);
  
  // Navigation handler - with confirmation if needed
  const goBack = useCallback(() => {
    if (isMeditating || isCountingDown) {
      Alert.alert(
        "End Meditation",
        "Are you sure you want to end your current session?",
        [
          { text: "Continue", style: "cancel" },
          { 
            text: "End Session", 
            onPress: () => {
              endMeditation();
              navigation.navigate('Home');
            },
            style: "destructive"
          }
        ]
      );
    } else {
      navigation.navigate('Home');
    }
  }, [isMeditating, isCountingDown, navigation, endMeditation]);
  
  return (
    <SafeAreaView style={styles.container}>
      {!isMeditating && !isCountingDown && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Text style={styles.backButton}>←</Text>
      </TouchableOpacity>
          <Text style={styles.headerText}>MEDITATION</Text>
          <View style={styles.headerSpacer} />
        </View>
      )}
      
      {!selectedDuration && (
        <View style={styles.selectionContent}>
          {/* Duration Selection */}
          <View style={styles.durationSection}>
            <Text style={styles.sectionTitle}>Duration</Text>
            
            <View style={styles.quickDurationContainer}>
              {durationOptions.map((option) => (
            <TouchableOpacity 
                  key={option.value}
                  style={[
                    styles.quickDurationButton,
                    customDuration === option.value && styles.quickDurationButtonSelected
                  ]}
                  onPress={() => selectQuickDuration(option.value)}
                >
                  <Text 
                    style={[
                      styles.quickDurationText,
                      customDuration === option.value && styles.quickDurationTextSelected
                    ]}
                  >
                    {option.label}
                  </Text>
            </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.customContainer}>
              <Text style={styles.customDurationText}>{customDuration} min</Text>
              
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={60}
                step={1}
                value={customDuration}
                onValueChange={(value) => setCustomDuration(value)}
                minimumTrackTintColor={COLORS.text.primary}
                maximumTrackTintColor="#444"
                thumbTintColor={COLORS.text.primary}
              />
              
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1 min</Text>
                <Text style={styles.sliderLabel}>60 min</Text>
              </View>
            </View>
          </View>
          
          {/* Sound Selection */}
          <View style={styles.soundSection}>
            <Text style={styles.sectionTitle}>Background Sound</Text>
            <View style={styles.soundThemeContainer}>
              {soundThemes.map((theme) => (
            <TouchableOpacity 
                  key={theme.id}
                  style={[
                    styles.soundThemeButton,
                    selectedSoundTheme === theme.id && styles.soundThemeButtonSelected
                  ]}
                  onPress={() => setSelectedSoundTheme(theme.id)}
                >
                  <Ionicons 
                    name={theme.icon} 
                    size={24} 
                    color={selectedSoundTheme === theme.id ? COLORS.background : COLORS.text.secondary} 
                  />
                  <Text 
                    style={[
                      styles.soundThemeText,
                      selectedSoundTheme === theme.id && styles.soundThemeTextSelected
                    ]}
                    numberOfLines={1}
                  >
                    {theme.label}
                  </Text>
            </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Start Button */}
          <TouchableOpacity 
            style={styles.startButton}
            onPress={startMeditation}
          >
            <Text style={styles.startButtonText}>BEGIN</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {isCountingDown && (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{countdown}</Text>
          <Text style={styles.countdownSubtext}>Prepare to meditate...</Text>
        </View>
      )}
      
      {isMeditating && (
        <View style={styles.meditationContainer}>
          <Progress.Circle
            size={200}
            thickness={6}
            color={COLORS.text.primary}
            unfilledColor="rgba(255, 255, 255, 0.2)"
            borderWidth={0}
            progress={progress}
            formatText={() => formatTime(remainingTime)}
            showsText={true}
            textStyle={styles.progressText}
            style={styles.progressCircle}
          />
          
          <Text style={styles.durationText}>
            {selectedDuration} minute{selectedDuration !== 1 ? 's' : ''} session
          </Text>
          
          {selectedSoundTheme !== 'silence' && (
            <View style={styles.soundIndicator}>
              <Ionicons 
                name={soundThemes.find(t => t.id === selectedSoundTheme)?.icon || 'volume-medium'} 
                size={16} 
                color={COLORS.text.secondary} 
              />
              <Text style={styles.soundIndicatorText}>
                {soundThemes.find(t => t.id === selectedSoundTheme)?.label || 'Sound'}
            </Text>
          </View>
          )}
          
          <Text style={styles.meditationSubtext}>
            Breathe and relax...
          </Text>
          
          <TouchableOpacity 
            style={styles.endMeditationButton} 
            onPress={() => {
              Alert.alert(
                "End Meditation",
                "Are you sure you want to end your current meditation session?",
                [
                  {
                    text: "Continue",
                    style: "cancel"
                  },
                  { 
                    text: "End Session", 
                    onPress: () => endMeditation(() => navigation.navigate('Home')),
                    style: "destructive"
                  }
                ]
              );
            }}
          >
            <MaterialIcons name="close" size={20} color={COLORS.text.primary} />
            <Text style={styles.endMeditationText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 0,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.m,
    width: '100%',
    position: 'absolute',
    top: SPACING.xl,
    left: 0,
    zIndex: 10,
  },
  backButton: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 24,
  },
  headerText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  selectionContent: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.l,
  },
  durationSection: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  soundSection: {
    width: '100%',
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginBottom: SPACING.m,
    fontWeight: '400',
  },
  quickDurationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
  },
  quickDurationButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: LAYOUT.borderRadius.m,
    paddingVertical: SPACING.m,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    flex: 1,
    marginHorizontal: 4,
    aspectRatio: 1.5,
  },
  quickDurationButtonSelected: {
    backgroundColor: COLORS.text.primary,
    borderColor: COLORS.text.primary,
  },
  quickDurationText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    fontWeight: '500',
  },
  quickDurationTextSelected: {
    color: COLORS.background,
  },
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: COLORS.text.primary,
    fontSize: 80,
    fontWeight: '200',
  },
  countdownSubtext: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginTop: SPACING.l,
  },
  meditationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
  },
  progressCircle: {
    marginBottom: SPACING.xl,
  },
  progressText: {
    color: COLORS.text.primary,
    fontSize: 36,
    fontWeight: '200',
  },
  durationText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.s,
  },
  soundIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    borderRadius: LAYOUT.borderRadius.l,
    marginBottom: SPACING.l,
  },
  soundIndicatorText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
    marginLeft: SPACING.xs,
  },
  meditationSubtext: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginTop: SPACING.xl,
  },
  endMeditationButton: {
    position: 'absolute',
    bottom: SPACING.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: LAYOUT.borderRadius.m,
    borderWidth: 1,
    borderColor: '#444',
    ...SHADOWS.small,
  },
  endMeditationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  customContainer: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: LAYOUT.borderRadius.l,
    padding: SPACING.l,
    alignItems: 'center',
  },
  customDurationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    marginBottom: SPACING.l,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.xs,
  },
  sliderLabel: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.xs,
  },
  soundThemeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: SPACING.xs,
  },
  soundThemeButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: LAYOUT.borderRadius.m,
    padding: SPACING.s,
    marginBottom: SPACING.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    width: '22%',
    aspectRatio: 1,
  },
  soundThemeButtonSelected: {
    backgroundColor: COLORS.text.primary,
    borderColor: COLORS.text.primary,
  },
  soundThemeText: {
    color: COLORS.text.secondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  soundThemeTextSelected: {
    color: COLORS.background,
  },
  startButton: {
    backgroundColor: COLORS.text.primary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius.m,
    marginTop: SPACING.m,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.background,
    fontWeight: '600',
    fontSize: FONT_SIZE.m,
  },
});

export default MeditationScreen; 