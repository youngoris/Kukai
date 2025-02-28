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
  AsyncStorage
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Progress from 'react-native-progress';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';

// Ignore specific warnings
LogBox.ignoreLogs(['Animated: `useNativeDriver`']);

const { width } = Dimensions.get('window');
const TIMER_SIZE = width * 0.8;

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
  const meditationTimer = useRef(null);
  const countdownTimer = useRef(null);
  const meditationStartTime = useRef(0);
  const animationFrameId = useRef(null);
  
  // New state variables
  const [customDuration, setCustomDuration] = useState(30); // Default custom duration
  
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
  
  // Modified function to handle duration selection
  const selectDuration = (minutes) => {
    setSelectedDuration(minutes);
    setRemainingTime(minutes * 60);
    setTotalTime(minutes * 60);
    setIsCountingDown(true);
  };
  
  // Function to start custom duration meditation
  const startCustomMeditation = () => {
    setSelectedDuration(customDuration);
    setRemainingTime(customDuration * 60);
    setTotalTime(customDuration * 60);
    setIsCountingDown(true);
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
  }, [breatheAnim, pulseAnim]);
  
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
  }, []);
  
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <AntDesign name="arrowleft" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      
      {!selectedDuration && (
        <View style={styles.selectionContainer}>
          <Text style={styles.headerText}>MEDITATION</Text>
          <Text style={styles.subText}>Qick Start</Text>
          
          <View style={styles.presetContainer}>
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.durationButton}
                onPress={() => selectDuration(3)}
              >
                <Text style={styles.buttonText}>3 min</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.durationButton}
                onPress={() => selectDuration(10)}
              >
                <Text style={styles.buttonText}>10 min</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.durationButton}
                onPress={() => selectDuration(20)}
              >
                <Text style={styles.buttonText}>20 min</Text>
              </TouchableOpacity>
            </View>
            
            {/* <View style={styles.divider} /> */}
            <View style={styles.customContainer}>
              <Text style={styles.customDurationText}>{customDuration} min</Text>
              
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={60}
                step={1}
                value={customDuration}
                onValueChange={(value) => setCustomDuration(value)}
                minimumTrackTintColor="#26de81"
                maximumTrackTintColor="#444"
                thumbTintColor="#fff"
              />
              
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1 min</Text>
                <Text style={styles.sliderLabel}>60 min</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.startCustomButton}
                onPress={() => startCustomMeditation()}
              >
                <Text style={styles.startButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
            
            {/* Test button for debugging
            <TouchableOpacity 
              style={[styles.durationButton, styles.testButton]}
              onPress={() => selectDuration(0.1)}
            >
              <Text style={styles.buttonText}>Test (6s)</Text>
            </TouchableOpacity> */}
          </View>
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
            color="#fff"
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
            <MaterialIcons name="close" size={20} color="#fff" />
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
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  selectionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  headerText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 40,
    letterSpacing: 2,
  },
  subText: {
    color: '#aaa',
    fontSize: 18,
    marginBottom: 40,
    fontWeight: '300',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  durationButton: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
    padding: 15,
    margin: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#222',
    marginTop: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '200',
  },
  countdownSubtext: {
    color: '#aaa',
    fontSize: 18,
    marginTop: 20,
  },
  meditationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircle: {
    marginBottom: 40,
  },
  progressText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '200',
  },
  durationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginBottom: 20,
  },
  meditationSubtext: {
    color: '#aaa',
    fontSize: 18,
    marginTop: 40,
  },
  endMeditationButton: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  endMeditationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  presetContainer: {
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 20,
    alignSelf: 'flex-start',
    marginLeft: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    width: '90%',
    marginVertical: 30,
  },
  customContainer: {
    width: '90%',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  customDurationText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  sliderLabel: {
    color: '#777',
    fontSize: 12,
  },
  startCustomButton: {
    backgroundColor: '#26de81',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MeditationScreen; 