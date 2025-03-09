import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Platform,
  Alert,
  BackHandler,
  StatusBar as RNStatusBar,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Progress from "react-native-progress";
import { useFocusEffect } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import {
  SPACING,
  FONT_SIZE,
  COLORS,
  LAYOUT,
  SHADOWS,
} from "../constants/DesignSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { goBackToHome } from "../navigation/NavigationUtils";
import CustomHeader from "../components/CustomHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Ignore specific warnings
LogBox.ignoreLogs(["Animated: `useNativeDriver`"]);

// Check if running on web platform
const isWeb = Platform.OS === 'web';

// Audio configuration - Adjust these values to customize the audio experience
// CROSSFADE_DURATION: Controls how smooth the transition is between loops (in milliseconds)
// - Lower values (300-500ms): Quicker transitions but might be noticeable
// - Medium values (800-1200ms): Good balance between smoothness and responsiveness
// - Higher values (1500-3000ms): Very smooth transitions but uses more resources
const AUDIO_CONFIG = {
  CROSSFADE_DURATION: 2500, // Milliseconds for crossfade between audio loops
  DEFAULT_VOLUME: 0.5, // Default background sound volume
};

const { width } = Dimensions.get("window");
const TIMER_SIZE = width * 0.8;

// Audio session configuration for seamless playback
const configureAudioSession = async () => {
  // Skip audio configuration on web platform
  if (isWeb) {
    console.log("Audio session configuration skipped on web platform");
    return;
  }
  
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      // Use numeric constants instead of Audio enum values to avoid compatibility issues
      // 1 = INTERRUPTION_MODE_IOS_DO_NOT_MIX / INTERRUPTION_MODE_ANDROID_DO_NOT_MIX
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    console.log("Audio session configured for optimal meditation experience");
  } catch (error) {
    console.error("Failed to configure audio session:", error);
  }
};

// Define sound themes
const soundThemes = [
  { id: "silence", label: "Silence", icon: "volume-off", source: null },
  {
    id: "whitenoise",
    label: "Bright",
    icon: "sunny",
    source: require("../../assets/whitenoise.m4a"),
  },
  {
    id: "brownnoise",
    label: "Dark",
    icon: "moon",
    source: require("../../assets/brownnoise.m4a"),
  },
  {
    id: "rain",
    label: "Rain",
    icon: "rainy",
    source: require("../../assets/rain.m4a"),
  },
  {
    id: "forest",
    label: "Forest",
    icon: "leaf",
    source: require("../../assets/forest.m4a"),
  },
  {
    id: "ocean",
    label: "Ocean",
    icon: "water",
    source: require("../../assets/ocean.m4a"),
  },
  {
    id: "fire",
    label: "Fire",
    icon: "flame",
    source: require("../../assets/fire.m4a"),
  },
  {
    id: "plane",
    label: "Plane",
    icon: "airplane",
    source: require("../../assets/plane.m4a"),
  },
];

// Define quick duration options
const durationOptions = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
];

const MeditationScreen = ({ navigation }) => {
  // Session state
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [isMeditating, setIsMeditating] = useState(false);
  const [isMeditationComplete, setIsMeditationComplete] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [appTheme, setAppTheme] = useState('dark');

  // Define isLightTheme based on appTheme
  const isLightTheme = appTheme === 'light';

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

  // Audio session and seamless looping
  const audioSessionConfigured = useRef(false);
  const primarySoundRef = useRef(null);
  const secondarySoundRef = useRef(null);
  const crossfadeTimerRef = useRef(null);
  const audioPositionRef = useRef(0);
  const audioDurationRef = useRef(0);

  // New state variables
  const [customDuration, setCustomDuration] = useState(10); // Default custom duration
  const [selectedSoundTheme, setSelectedSoundTheme] = useState("silence"); // Default set to silent
  const [isAudioReleasing, setIsAudioReleasing] = useState(false); // Add state flag
  const audioLoopCountRef = useRef(0);
  const statusLogTimeRef = useRef(0);

  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Load settings from AsyncStorage when screen focuses
  useFocusEffect(
    useCallback(() => {
      const loadMeditationSettings = async () => {
        try {
          // Use getSettingsWithDefaults to get default settings
          const settings = await getSettingsWithDefaults(AsyncStorage);
          console.log("Loaded meditation settings:", settings);

          // Update meditation duration from settings
          if (settings.meditationDuration) {
            console.log(
              "Setting meditation duration to:",
              settings.meditationDuration,
            );
            setCustomDuration(settings.meditationDuration);
          }

          // Update sound theme from settings
          if (settings.selectedSoundTheme) {
            console.log(
              "Setting sound theme to:",
              settings.selectedSoundTheme,
            );
            setSelectedSoundTheme(settings.selectedSoundTheme);
          }
        } catch (error) {
          console.error("Error loading meditation settings:", error);
        }
      };

      loadMeditationSettings();
      return () => {};
    }, [navigation]),
  );

  // Load user settings including theme
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const userSettings = await AsyncStorage.getItem('userSettings');
        if (userSettings) {
          const settings = JSON.parse(userSettings);
          if (settings.appTheme) {
            setAppTheme(settings.appTheme);
          }
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isMeditating) {
          Alert.alert(
            "End Meditation",
            "Are you sure you want to end your meditation session?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "End",
                onPress: () => endMeditation(() => goBackToHome(navigation)),
                style: "destructive",
              },
            ]
          );
          return true;
        }
        return false;
      };

      BackHandler.addEventListener("hardwareBackPress", onBackPress);

      return () =>
        BackHandler.removeEventListener("hardwareBackPress", onBackPress);
    }, [isMeditating, navigation]),
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

  // Initialize audio session when component mounts
  useEffect(() => {
    const setupAudioSession = async () => {
      if (!audioSessionConfigured.current) {
        await configureAudioSession();
        audioSessionConfigured.current = true;
        console.log("Audio session initialized for meditation");
      }
    };

    setupAudioSession();

    return () => {
      // Clean up audio resources
      releaseAllAudioResources();
    };
  }, []);

  // Function to release all audio resources
  const releaseAllAudioResources = async () => {
    // Skip on web platform
    if (isWeb) {
      console.log("Audio resources release skipped on web platform");
      return;
    }
    
    try {
      // If already releasing, avoid duplicate execution
      if (isAudioReleasing) {
        console.log("[Audio Debug] Release already in progress, skipping");
        return;
      }
      
      setIsAudioReleasing(true);
      console.log(
        "[Audio Debug] Release called from:",
        new Error().stack.split("\n")[2],
      );
      // Clear any pending crossfade timers
      if (crossfadeTimerRef.current) {
        clearTimeout(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }

      // Unload primary sound
      if (primarySoundRef.current) {
        await primarySoundRef.current.unloadAsync();
        primarySoundRef.current = null;
      }

      // Unload secondary sound
      if (secondarySoundRef.current) {
        await secondarySoundRef.current.unloadAsync();
        secondarySoundRef.current = null;
      }

      // Unload completion sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Reset any other audio-related state
      audioPositionRef.current = 0;
      audioDurationRef.current = 0;

      console.log("[Audio Cleanup] All audio resources released");
      setIsAudioReleasing(false);
    } catch (error) {
      console.error("Error releasing audio resources:", error);
      setIsAudioReleasing(false);
    }
  };

  // Load meditation completion sound
  useEffect(() => {
    const loadSound = async () => {
      try {
        // Skip loading sound on web platform to prevent errors
        if (isWeb) {
          console.log("Sound loading skipped on web platform");
          return;
        }
        
        const { sound } = await Audio.Sound.createAsync(
          {
            uri: "https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3",
          },
          { volume: 0.7 },
        );
        setSound(sound);
      } catch (error) {
        console.log("Unable to preload sound effect", error);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Advanced seamless background sound playback
  useEffect(() => {
    const initializeSeamlessAudio = async () => {
      try {
        // Skip audio initialization on web platform
        if (isWeb) {
          console.log("Seamless audio initialization skipped on web platform");
          return;
        }
        
        // Don't load sounds if silent mode or not meditating
        if (selectedSoundTheme === "silence" || !isMeditating) {
          // Only release resources if we had resources loaded previously
          if (primarySoundRef.current || secondarySoundRef.current || sound) {
            await releaseAllAudioResources();
          }
          return;
        }

        // Find the selected sound theme
        const theme = soundThemes.find(
          (theme) => theme.id === selectedSoundTheme,
        );
        if (!theme || !theme.source) {
          console.log(
            `Error: Sound theme "${selectedSoundTheme}" not found or has no source`,
          );
          return;
        }

        console.log(`Loading sound theme: ${theme.label} (${theme.id})`);

        // Reset loop counter
        audioLoopCountRef.current = 0;

        // Load primary sound instance
        const { sound: primarySound, status: primaryStatus } =
          await Audio.Sound.createAsync(
            theme.source,
            {
              volume: AUDIO_CONFIG.DEFAULT_VOLUME,
              progressUpdateIntervalMillis: 100,
            },
            onPlaybackStatusUpdate,
          );
        primarySoundRef.current = primarySound;

        // Load secondary sound instance (for crossfading)
        const { sound: secondarySound } = await Audio.Sound.createAsync(
          theme.source,
          { volume: 0, progressUpdateIntervalMillis: 100 },
          // 确保次要音频实例也能接收回调，这样在交换后依然能保持监听
          onPlaybackStatusUpdate,
        );
        secondarySoundRef.current = secondarySound;

        // 明确设置播放状态回调，确保监听正常工作
        await primarySound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

        // Store duration for timing calculations
        audioDurationRef.current = primaryStatus.durationMillis;

        // Start playback
        await primarySound.playAsync();
        console.log(
          `Started playing ${theme.label} background sound (${primaryStatus.durationMillis}ms duration)`,
        );
      } catch (error) {
        console.error("Error initializing seamless audio:", error);
      }
    };

    initializeSeamlessAudio();

    return () => {
      releaseAllAudioResources();
    };
  }, [isMeditating, selectedSoundTheme]);

  // Monitor playback status and handle seamless looping
  const onPlaybackStatusUpdate = useCallback(
    async (status) => {
      if (!status.isLoaded) {
        console.log("Audio status: Not loaded");
        return;
      }

      if (!isMeditating) {
        return;
      }

      // Print playback status every 10 seconds to avoid excessive logging
      const currentTime = Date.now();
      if (
        statusLogTimeRef.current === 0 ||
        currentTime - statusLogTimeRef.current > 10000
      ) {
        console.log(
          `Audio position: ${status.positionMillis}/${audioDurationRef.current}ms, isPlaying: ${status.isPlaying}`,
        );
        statusLogTimeRef.current = currentTime;
      }

      // Track current position for crossfade timing
      audioPositionRef.current = status.positionMillis;

      // Handle seamless looping with crossfade
      if (
        status.isPlaying &&
        audioDurationRef.current > 0 &&
        status.positionMillis >
          audioDurationRef.current - AUDIO_CONFIG.CROSSFADE_DURATION - 100
      ) {
        // Start crossfade process if not already in progress
        if (
          !crossfadeTimerRef.current &&
          primarySoundRef.current &&
          secondarySoundRef.current
        ) {
          try {
            // 增加循环计数
            audioLoopCountRef.current += 1;
            console.log(
              `Starting crossfade for seamless loop #${audioLoopCountRef.current}`,
            );

            // Prepare secondary sound to start from beginning
            await secondarySoundRef.current.setPositionAsync(0);
            await secondarySoundRef.current.setVolumeAsync(0);
            await secondarySoundRef.current.playAsync();

            // Smoothly crossfade between the two instances
            const fadeSteps = 10;
            const fadeStepDuration =
              AUDIO_CONFIG.CROSSFADE_DURATION / fadeSteps;

            for (let i = 1; i <= fadeSteps; i++) {
              crossfadeTimerRef.current = setTimeout(async () => {
                // 确保冥想仍在进行，否则不继续交叉淡入淡出
                if (!isMeditating) {
                  if (crossfadeTimerRef.current) {
                    clearTimeout(crossfadeTimerRef.current);
                    crossfadeTimerRef.current = null;
                  }
                  return;
                }

                const primaryVolume =
                  AUDIO_CONFIG.DEFAULT_VOLUME * (1 - i / fadeSteps);
                const secondaryVolume =
                  AUDIO_CONFIG.DEFAULT_VOLUME * (i / fadeSteps);

                if (primarySoundRef.current && secondarySoundRef.current) {
                  await primarySoundRef.current.setVolumeAsync(primaryVolume);
                  await secondarySoundRef.current.setVolumeAsync(
                    secondaryVolume,
                  );

                  // When fully crossfaded, swap the sound instances
                  if (i === fadeSteps) {
                    const temp = primarySoundRef.current;
                    primarySoundRef.current = secondarySoundRef.current;
                    secondarySoundRef.current = temp;

                    // 重要修复：确保新的主音频实例继续接收播放状态更新
                    await primarySoundRef.current.setOnPlaybackStatusUpdate(
                      onPlaybackStatusUpdate,
                    );

                    // Stop the previous primary (now secondary) and reset
                    await secondarySoundRef.current.stopAsync();
                    await secondarySoundRef.current.setVolumeAsync(0);

                    // Reset crossfade timer
                    crossfadeTimerRef.current = null;

                    // 重置状态日志时间，确保下一个周期立即打印状态
                    statusLogTimeRef.current = 0;

                    console.log(
                      `Completed crossfade loop #${audioLoopCountRef.current}, continuing playback`,
                    );
                  }
                }
              }, i * fadeStepDuration);
            }
          } catch (error) {
            console.error("Error during crossfade:", error);
            // 发生错误时重置交叉淡入淡出定时器
            if (crossfadeTimerRef.current) {
              clearTimeout(crossfadeTimerRef.current);
              crossfadeTimerRef.current = null;
            }
          }
        }
      }
    },
    [isMeditating],
  );

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
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

      // Create pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
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
        useNativeDriver: false,
      }).start();

      // Calculate fluid height - using square root for more natural visual effect
      const fluidHeight = Math.sqrt(targetProgress);

      Animated.timing(fluidProgressAnim, {
        toValue: fluidHeight,
        duration: animationDuration,
        easing: Easing.cubic, // More natural cubic easing
        useNativeDriver: false,
      }).start();
    }
  }, [remainingTime, isMeditating, totalTime, progressAnim, fluidProgressAnim]);

  // Countdown timer
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      countdownTimer.current = setInterval(() => {
        setCountdown((prevCount) => prevCount - 1);
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
        setRemainingTime((prevTime) => {
          const newTime = prevTime - 1;
          // Update progress
          setProgress(1 - newTime / totalTime);
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
    console.log("Starting meditation with duration:", customDuration);
    setSelectedDuration(customDuration);
    setRemainingTime(customDuration * 60);
    setTotalTime(customDuration * 60);
    setIsCountingDown(true);
  };

  // Function to handle quick duration selection
  const selectQuickDuration = (minutes) => {
    console.log("Selected quick duration:", minutes);
    setCustomDuration(minutes);
  };

  // Format time helper (mm:ss)
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  // Play completion sound
  const playCompletionSound = useCallback(async () => {
    try {
      // Skip on web platform
      if (isWeb) {
        console.log("Completion sound playback skipped on web platform");
        return;
      }
      
      if (sound) {
        await sound.replayAsync();
      }
    } catch (error) {
      console.log("Error playing sound:", error);
    }
  }, [sound, isWeb]);

  // Save meditation session to storage
  const saveMeditationSession = useCallback(
    async (durationInMinutes) => {
      try {
        // Skip saving on web platform
        if (isWeb) {
          console.log("Saving meditation session skipped on web platform");
          return;
        }
        
        // Get current date in YYYY-MM-DD format
        const today = new Date().toISOString().split("T")[0];

        // Create new session object
        const newSession = {
          date: today,
          duration: durationInMinutes,
          soundTheme: selectedSoundTheme,
          timestamp: new Date().toISOString(),
        };

        // Get existing sessions or initialize empty array
        const sessionsJson = await AsyncStorage.getItem("meditation_sessions");
        let sessions = [];
        if (sessionsJson) {
          sessions = JSON.parse(sessionsJson);
        }

        // Add new session
        sessions.push(newSession);

        // Save updated sessions
        await AsyncStorage.setItem(
          "meditation_sessions",
          JSON.stringify(sessions),
        );

        console.log("Meditation session saved successfully");
      } catch (error) {
        console.error("Error saving meditation session:", error);
      }
    },
    [selectedSoundTheme, isWeb],
  );

  // End meditation
  const endMeditation = useCallback(
    (callback, resetDuration = true) => {
      console.log("Ending meditation session");

      // Stop meditation timer
      if (meditationTimer.current) {
        clearInterval(meditationTimer.current);
        meditationTimer.current = null;
      }

      // Release audio resources
      releaseAllAudioResources();

      // Log audio loops for debugging
      console.log(
        `Meditation ended after ${audioLoopCountRef.current} audio loops`,
      );

      // Reset animation values
      breatheAnim.setValue(1);
      pulseAnim.setValue(0);

      // Reset state
      setIsMeditating(false);

      // Only reset these if not showing completion screen
      if (resetDuration) {
        setIsMeditationComplete(false);
        setSelectedDuration(null);
        setProgress(0);
        setRemainingTime(0);
      }

      // Execute callback if provided
      if (callback) {
        callback();
      } else {
        goBackToHome(navigation);
      }
    },
    [breatheAnim, pulseAnim, releaseAllAudioResources],
  );

  // Handle meditation complete
  const handleMeditationComplete = useCallback(
    (durationInMinutes) => {
      console.log("Meditation completed, duration:", durationInMinutes);

      // Save meditation session data
      saveMeditationSession(durationInMinutes);

      // Stop meditation timers and background sounds, but keep duration for the completion screen
      endMeditation(null, false);

      // Play completion sound
      playCompletionSound();

      // Set meditation complete state instead of showing alert
      setIsMeditationComplete(true);
    },
    [endMeditation, saveMeditationSession, playCompletionSound],
  );

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
              goBackToHome(navigation);
            },
            style: "destructive",
          },
        ],
      );
    } else if (isMeditationComplete) {
      setIsMeditationComplete(false);
      setSelectedDuration(null);
      goBackToHome(navigation);
    } else {
      goBackToHome(navigation);
    }
  }, [
    isMeditating,
    isCountingDown,
    isMeditationComplete,
    navigation,
    endMeditation,
  ]);

  // Render Web compatibility message if on web platform
  if (isWeb) {
    return (
      <View style={[
        styles.container, 
        isLightTheme && styles.lightContainer,
        { 
          paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
        }
      ]}>
        <CustomHeader 
          title="MEDITATION"
          onBackPress={() => goBackToHome(navigation)}
          showBottomBorder={false}
        />
        
        <View style={[styles.contentContainer, {justifyContent: 'center', alignItems: 'center'}]}>
          <MaterialIcons name="web" size={64} color={COLORS.PRIMARY} />
          <Text style={[styles.title, {marginTop: 20}]}>
            Web Platform Notice
          </Text>
          <Text style={[styles.subtitle, {textAlign: 'center', marginHorizontal: 40, marginTop: 10}]}>
            The meditation experience is optimized for mobile devices.
            For the best experience, please use the Kukai app on iOS or Android.
          </Text>
          
          <View style={{marginTop: 40}}>
            <TouchableOpacity
              style={styles.webActionButton}
              onPress={() => goBackToHome(navigation)}
            >
              <Text style={styles.webActionButtonText}>Return to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      isLightTheme && styles.lightContainer,
      { 
        paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
      }
    ]}>
      {!isMeditating && !isCountingDown && (
        <CustomHeader 
          title="MEDITATION"
          onBackPress={() => goBackToHome(navigation)}
          showBottomBorder={false}
        />
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
                    customDuration === option.value &&
                      styles.quickDurationButtonSelected,
                  ]}
                  onPress={() => selectQuickDuration(option.value)}
                >
                  <Text
                    style={[
                      styles.quickDurationText,
                      customDuration === option.value &&
                        styles.quickDurationTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.customContainer}>
              <Text style={styles.customDurationText}>
                {customDuration} min
              </Text>

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

          {/* Sound themes */}
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Background Sounds</Text>
            <Text style={styles.settingSectionSubtitle}>
              Professional seamless looping audio
            </Text>
            <View style={styles.soundThemeContainer}>
              {soundThemes.map((theme) => (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.soundThemeButton,
                    selectedSoundTheme === theme.id &&
                      styles.soundThemeButtonSelected,
                  ]}
                  onPress={() => setSelectedSoundTheme(theme.id)}
                >
                  <Ionicons
                    name={theme.icon}
                    size={24}
                    color={
                      selectedSoundTheme === theme.id
                        ? COLORS.background
                        : COLORS.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.soundThemeText,
                      selectedSoundTheme === theme.id &&
                        styles.soundThemeTextSelected,
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

      {isMeditationComplete && (
        <View style={styles.completionContainer}>
          <Ionicons
            name="checkmark-circle"
            size={80}
            color={COLORS.text.primary}
          />
          <Text style={styles.completionTitle}>Meditation Complete</Text>
          <Text style={styles.completionText}>
            You've completed {selectedDuration} minute
            {selectedDuration !== 1 ? "s" : ""} of meditation
          </Text>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.navigate("Task")}
          >
            <Text style={styles.continueButtonText}>Continue to Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => {
              setIsMeditationComplete(false);
              setSelectedDuration(null);
              goBackToHome(navigation);
            }}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {isMeditating && !isMeditationComplete && (
        <View style={styles.meditationContainer}>
          {/* Timer circle */}
          <Animated.View
            style={[
              styles.timerCircle,
              {
                transform: [{ scale: breatheAnim }],
              },
            ]}
          >
            <Progress.Circle
              size={TIMER_SIZE}
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
          </Animated.View>

          <Text style={styles.durationText}>
            {selectedDuration} minute{selectedDuration !== 1 ? "s" : ""} session
          </Text>

          {selectedSoundTheme !== "silence" && (
            <View style={styles.soundIndicator}>
              <Ionicons
                name={
                  soundThemes.find((t) => t.id === selectedSoundTheme)?.icon ||
                  "volume-medium"
                }
                size={16}
                color={COLORS.text.secondary}
              />
              <Text style={styles.soundIndicatorText}>
                {soundThemes.find((t) => t.id === selectedSoundTheme)?.label ||
                  "Sound"}
              </Text>
            </View>
          )}

          <Text style={styles.meditationSubtext}>Breathe and relax...</Text>

          <TouchableOpacity
            style={styles.endMeditationButton}
            onPress={() => {
              Alert.alert(
                "End Meditation",
                "Are you sure you want to end your current meditation session?",
                [
                  {
                    text: "Continue",
                    style: "cancel",
                  },
                  {
                    text: "End Session",
                    onPress: () =>
                      endMeditation(() => goBackToHome(navigation)),
                    style: "destructive",
                  },
                ],
              );
            }}
          >
            <MaterialIcons name="close" size={20} color={COLORS.text.primary} />
            <Text style={styles.endMeditationText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    position: "relative",
  },
  lightContainer: {
    backgroundColor: "#fff",
  },
  selectionContent: {
    flex: 1,
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.l,
  },
  durationSection: {
    width: "100%",
    marginBottom: SPACING.xl,
    marginTop:  -40,
  },
  soundSection: {
    width: "100%",
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginBottom: SPACING.m,
    fontWeight: "400",
  },
  quickDurationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.l,
  },
  quickDurationButton: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: LAYOUT.borderRadius.m,
    paddingVertical: SPACING.m,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "500",
  },
  quickDurationTextSelected: {
    color: COLORS.background,
  },
  countdownContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    color: COLORS.text.primary,
    fontSize: 80,
    fontWeight: "200",
    fontFamily:
      Platform.OS === "ios"
        ? "Courier New" // iOS上更美观的等宽字体
        : "monospace",
  },
  countdownSubtext: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginTop: SPACING.l,
  },
  meditationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.l,
  },
  progressCircle: {
    marginBottom: SPACING.xl,
  },
  progressText: {
    color: COLORS.text.primary,
    fontSize: 36,
    fontWeight: "200",
    fontFamily:
      Platform.OS === "ios"
        ? "Courier New" // iOS上更美观的等宽字体
        : "monospace",
  },
  durationText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.s,
  },
  soundIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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
    position: "absolute",
    bottom: SPACING.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: LAYOUT.borderRadius.m,
    borderWidth: 1,
    borderColor: "#444",
    ...SHADOWS.small,
  },
  endMeditationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: "500",
    marginLeft: SPACING.xs,
  },
  customContainer: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: LAYOUT.borderRadius.l,
    padding: SPACING.l,
    alignItems: "center",
  },
  customDurationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: "600",
    marginBottom: SPACING.l,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: SPACING.xs,
  },
  sliderLabel: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.xs,
  },
  soundThemeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginTop: SPACING.xs,
  },
  soundThemeButton: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: LAYOUT.borderRadius.m,
    padding: SPACING.s,
    marginBottom: SPACING.m,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    width: "22%",
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
    textAlign: "center",
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
    width: "100%",
    alignItems: "center",
  },
  startButtonText: {
    color: COLORS.background,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
  },
  completionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
  },
  completionTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: "bold",
    marginBottom: SPACING.m,
  },
  completionText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.l,
  },
  continueButton: {
    backgroundColor: COLORS.text.primary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius.m,
    marginTop: SPACING.m,
    width: "100%",
    alignItems: "center",
  },
  continueButtonText: {
    color: COLORS.background,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
  },
  homeButton: {
    backgroundColor: "transparent",
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius.m,
    marginTop: SPACING.s,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.text.secondary,
  },
  homeButtonText: {
    color: COLORS.text.secondary,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
  },
  settingSection: {
    width: "100%",
    marginBottom: SPACING.m,
  },
  settingSectionTitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginBottom: SPACING.m,
    fontWeight: "400",
  },
  settingSectionSubtitle: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.m,
  },
  timerCircle: {
    marginBottom: SPACING.xl,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: "bold",
  },
  subtitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
  },
  webActionButton: {
    backgroundColor: COLORS.text.primary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius.m,
  },
  webActionButtonText: {
    color: COLORS.background,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
  },
});

export default MeditationScreen;
