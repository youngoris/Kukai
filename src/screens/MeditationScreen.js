/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
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
  AppState,
  Switch,
  ScrollView,
} from "react-native";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import storageService from "../services/StorageService";
import { goBackToHome } from "../navigation/NavigationUtils";
import CustomHeader from "../components/CustomHeader";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import speechService, { MEDITATION_SCRIPTS } from "../services/SpeechService";

// Ignore specific warnings
LogBox.ignoreLogs(["Animated: `useNativeDriver`"]);

// Audio configuration
const AUDIO_CONFIG = {
  CROSSFADE_DURATION: 2500, // Milliseconds for crossfade
  FADE_IN_DURATION: 1500,   // Milliseconds for initial fade-in
  DEFAULT_VOLUME: 0.5,      // Default background sound volume
};

const { width } = Dimensions.get("window");
const TIMER_SIZE = width * 0.8;

// Audio session configuration for seamless playback
const configureAudioSession = async () => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true, 
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
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

// Define guided meditation types
const guidedMeditationTypes = [
  { id: "dailyFocus", label: "Daily Focus", icon: "calendar-today" },
  { id: "quickFocus", label: "Quick Focus", icon: "timer" },
  { id: "stressRelief", label: "Stress Relief", icon: "self-improvement" },
  { id: "bedtime", label: "Bedtime", icon: "bedtime" },
];

// Define quick duration options
const durationOptions = [
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
];

// Check if running on web platform
const isWeb = Platform.OS === 'web';

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

  // State variables
  const [customDuration, setCustomDuration] = useState(10); // Default custom duration
  const [selectedSoundTheme, setSelectedSoundTheme] = useState("silence"); // Default set to silent
  const [keepScreenAwake, setKeepScreenAwake] = useState(true); // Default to true until settings are loaded
  const appState = useRef(AppState.currentState);

  // Guided meditation state
  const [isGuidedMeditation, setIsGuidedMeditation] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const promptTimerRef = useRef(null);
  const promptFadeAnim = useRef(new Animated.Value(0)).current;

  // Track app background state
  const APP_IS_BACKGROUNDED = useRef(false);

  // State variables for screen transitions
  const [showScreen, setShowScreen] = useState('setup'); // 'setup', 'meditation', 'completion'
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Function to set prompt with animation
  const setPromptWithAnimation = (text) => {
    console.log(`Setting prompt with animation: ${text ? text.substring(0, 20) + '...' : 'empty'}`);
    
    // If we're clearing the text and there's no current text, do nothing
    if (!text && !currentPrompt) {
      return;
    }
    
    // If there's a current prompt, fade it out first
    if (currentPrompt) {
      // Reset animation value to 1 before starting fade out
      promptFadeAnim.setValue(1);
      
      // Fade out animation with spring for more natural feel
      Animated.timing(promptFadeAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // After fade out completes, set the new text and fade in
        setCurrentPrompt(text);
        
        if (text) {
          // Reset to 0 before fading in
          promptFadeAnim.setValue(0);
          
          // Fade in with spring for more natural feel
          Animated.timing(promptFadeAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      });
    } else if (text) {
      // No current prompt but we have new text, set and fade in
      setCurrentPrompt(text);
      promptFadeAnim.setValue(0);
      
      Animated.timing(promptFadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // No text and no current prompt, just reset
      setCurrentPrompt("");
    }
  };
  
  // Add state for guided meditation type
  const [guidedMeditationType, setGuidedMeditationType] = useState("dailyFocus");

  // Get safe area insets
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 0, bottom: 0, left: 0, right: 0 };
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Load settings from StorageService when screen focuses
  useFocusEffect(
    useCallback(() => {
      const loadMeditationSettings = async () => {
        try {
          console.log('Loading user meditation settings from storage...');
          
          // Load saved settings
          const settingsJson = await storageService.getItem('userSettings');
          if (!settingsJson) {
            console.log('No saved settings found - using defaults');
            // Use safe defaults
            setIsGuidedMeditation(false); // Default closed voice guidance
            setGuidedMeditationType('dailyFocus');
            setSelectedSoundTheme('rain');
            setCustomDuration(10);
            setKeepScreenAwake(true);
            return;
          }
          
          // Parse settings if needed
          const settings = typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
          
          console.log('Loaded settings from storage:', 
            JSON.stringify({
              meditationDuration: settings.meditationDuration,
              soundTheme: settings.selectedSoundTheme,
              voiceGuidanceEnabled: settings.voiceGuidanceEnabled,
              defaultGuidanceType: settings.defaultGuidanceType
            })
          );
          
          // Key: Strictly apply voice guidance settings according to user preferences
          // Important: If voiceGuidanceEnabled is explicitly set to false in settings, it must remain off
          if (settings.voiceGuidanceEnabled !== undefined) {
            console.log(`Setting voice guidance to user preference: ${settings.voiceGuidanceEnabled}`);
            setIsGuidedMeditation(settings.voiceGuidanceEnabled);
          } else {
            console.log('No voice guidance preference found, defaulting to off');
            setIsGuidedMeditation(false);
          }
          
          // Apply other settings
          if (settings.defaultGuidanceType) {
            setGuidedMeditationType(settings.defaultGuidanceType);
          }
          
          if (settings.selectedSoundTheme) {
            setSelectedSoundTheme(settings.selectedSoundTheme);
          }
          
          if (settings.meditationDuration) {
            setCustomDuration(settings.meditationDuration);
          }
          
          if (settings.keepScreenAwake !== undefined) {
            setKeepScreenAwake(settings.keepScreenAwake);
          }
          
          // Apply theme settings
          if (settings.appTheme) {
            setAppTheme(settings.appTheme);
          }
          
          console.log(`Final meditation settings applied:
            - Voice guidance: ${settings.voiceGuidanceEnabled !== undefined ? settings.voiceGuidanceEnabled : false}
            - Guidance type: ${settings.defaultGuidanceType || 'dailyFocus'}
            - Sound theme: ${settings.selectedSoundTheme || 'rain'}
            - Duration: ${settings.meditationDuration || 10}m`
          );
        } catch (error) {
          console.error('Error loading meditation settings:', error);
          // Use default values on error and ensure voice guidance is off
          setIsGuidedMeditation(false);
        }
      };

      // Force reload settings every time this screen gains focus
      loadMeditationSettings();
    }, []),
  );

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isMeditating) {
          Alert.alert(
            "End Meditation",
            "Are you sure you want to end your current session? This will end the meditation permanently.",
            [
              { text: "Continue", style: "cancel" },
              {
                text: "End Session",
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
      if (typeof releaseAllAudioResources === 'function') {
        releaseAllAudioResources();
      }
    };
  }, [releaseAllAudioResources]);

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App moving to background
        console.log('App moving to background - ensuring meditation continues');
        
        // Reconfigure audio to ensure playback continues in background
        if (isMeditating) {
          // Configure audio session for background playback
          Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            interruptionModeIOS: 1,
            interruptionModeAndroid: 1,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false
          }).catch(err => console.log('Audio config error:', err));
        }
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground
        console.log('App returning to foreground');
        
        // Ensure audio session is still properly configured
        if (isMeditating) {
          configureAudioSession();
        }
      }
      
      // Save current state
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, [isMeditating]);

  // Function to release all audio resources
  const releaseAllAudioResources = useCallback(async () => {
    // First clear and cleanup timers
    try {
      if (crossfadeTimerRef.current) {
        clearTimeout(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
    } catch (error) {
      console.error("Error clearing crossfade timer:", error);
    }

    // Safely handle primary sound reference
    try {
      const primary = primarySoundRef.current;
      if (primary) {
        try {
          const status = await primary.getStatusAsync();
          if (status && status.isLoaded) {
            if (status.isPlaying) {
              await primary.pauseAsync().catch(() => {});
            }
            await primary.unloadAsync().catch(() => {});
          }
        } catch (e) {
          // Ignore errors and continue processing
        }
      }
    } catch (error) {
      console.error("Error handling primary sound:", error);
    } finally {
      primarySoundRef.current = null;
    }
    
    // Safely handle secondary sound reference
    try {
      const secondary = secondarySoundRef.current;
      if (secondary) {
        try {
          const status = await secondary.getStatusAsync();
          if (status && status.isLoaded) {
            if (status.isPlaying) {
              await secondary.pauseAsync().catch(() => {});
            }
            await secondary.unloadAsync().catch(() => {});
          }
        } catch (e) {
          // Ignore errors and continue processing
        }
      }
    } catch (error) {
      console.error("Error handling secondary sound:", error);
    } finally {
      secondarySoundRef.current = null;
    }

    // Reset other audio state variables
    audioPositionRef.current = 0;
    audioDurationRef.current = 0;
  }, []);

  // Load meditation completion sound
  useEffect(() => {
    const loadSound = async () => {
      try {
        // Load notification sound using online URL method which is more reliable
        const { sound: completionSound } = await Audio.Sound.createAsync(
          {
            uri: "https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3",
          },
          { volume: 0.7 }
        );
        
        setSound(completionSound);
        console.log("Meditation completion sound loaded successfully");
      } catch (error) {
        console.log("Unable to preload sound effect:", error);
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
        audioDurationRef.current = theme.source.duration;

        // Load primary sound instance with lower initial volume for fade-in
        const initialVolume = 0.1; // Start with lower volume for fade-in effect
        
        const { sound: primarySound, status: primaryStatus } =
          await Audio.Sound.createAsync(
            theme.source,
            {
              volume: initialVolume, // Start with lower volume
              progressUpdateIntervalMillis: 100,
            },
            onPlaybackStatusUpdate,
          );
        primarySoundRef.current = primarySound;

        // Load secondary sound instance (for crossfading)
        const { sound: secondarySound } = await Audio.Sound.createAsync(
          theme.source,
          { volume: 0, progressUpdateIntervalMillis: 100 },
          // Ensure secondary sound instance also receives callbacks
          onPlaybackStatusUpdate,
        );
        secondarySoundRef.current = secondarySound;

        // Explicitly set playback status callback to ensure monitoring works
        await primarySound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

        // Store duration for timing calculations
        audioDurationRef.current = primaryStatus.durationMillis;

        // Start playback
        await primarySound.playAsync();
        console.log(
          `Started playing ${theme.label} background sound (${primaryStatus.durationMillis}ms duration)`,
        );
        
        // Implement fade-in effect
        const fadeSteps = 8;
        const fadeStepDuration = AUDIO_CONFIG.FADE_IN_DURATION / fadeSteps;
        
        for (let i = 1; i <= fadeSteps; i++) {
          setTimeout(async () => {
            if (primarySoundRef.current && isMeditating) {
              // Gradually increase volume from initialVolume to DEFAULT_VOLUME
              const volume = initialVolume + (AUDIO_CONFIG.DEFAULT_VOLUME - initialVolume) * (i / fadeSteps);
              await primarySoundRef.current.setVolumeAsync(volume);
            }
          }, i * fadeStepDuration);
        }
      } catch (error) {
        console.error("Error initializing seamless audio:", error);
      }
    };

    initializeSeamlessAudio();

    return () => {
      if (typeof releaseAllAudioResources === 'function') {
        releaseAllAudioResources();
      }
    };
  }, [isMeditating, selectedSoundTheme, releaseAllAudioResources]);

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
      if (currentTime - statusLogTimeRef.current > 10000) {
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
            // Count the number of crossfades
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
                // Make sure meditation is still ongoing
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

                    // Make sure the new primary sound instance continues to receive playback status updates
                    await primarySoundRef.current.setOnPlaybackStatusUpdate(
                      onPlaybackStatusUpdate,
                    );

                    // Stop the previous primary (now secondary) and reset
                    await secondarySoundRef.current.stopAsync();
                    await secondarySoundRef.current.setVolumeAsync(0);

                    // Reset crossfade timer
                    crossfadeTimerRef.current = null;

                    // Reset status log time to ensure immediate logging of next cycle
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
            // Reset crossfade timer
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

  // Handle countdown phase
  useEffect(() => {
    if (isCountingDown) {
      countdownTimer.current = setInterval(() => {
        setCountdown((prevCount) => {
          const newCount = prevCount - 1;
          
          // When countdown reaches 0, start the meditation
          if (newCount <= 0) {
            clearInterval(countdownTimer.current);
            
            // Set up meditation state
            const durationInSeconds = customDuration * 60;
            setRemainingTime(durationInSeconds);
            setTotalTime(durationInSeconds);
            
            // Record start time
            meditationStartTime.current = Date.now();
            setSessionStartTime(new Date());
            
            // Switch screen state
            setIsCountingDown(false);
            setIsMeditating(true);
            
            // Keep screen awake if enabled
            if (keepScreenAwake) {
              activateKeepAwake();
            }
            
            // Start animation
            startBreathingAnimation();
            
            return 0;
          }
          
          return newCount;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
    };
  }, [isCountingDown, startBreathingAnimation, customDuration, keepScreenAwake, isGuidedMeditation, guidedMeditationType]);

  // Meditation timer
  useEffect(() => {
    if (isMeditating && remainingTime > 0) {
      meditationTimer.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          const newTime = prevTime - 1;
          // Update progress
          setProgress(1 - newTime / totalTime);
          
          // If time is up, end meditation
          if (newTime <= 0) {
            // Clear interval first to prevent any further updates
            if (meditationTimer.current) {
              clearInterval(meditationTimer.current);
              meditationTimer.current = null;
            }
            
            // Call handleMeditationComplete after a brief delay to allow state update
            setTimeout(() => {
              handleMeditationComplete(selectedDuration || customDuration);
            }, 100);
            
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (meditationTimer.current) {
        clearInterval(meditationTimer.current);
        meditationTimer.current = null;
      }
    };
  }, [isMeditating, totalTime, selectedDuration, customDuration, handleMeditationComplete]);

  // Manage screen wake lock based on meditation state and user preference
  useEffect(() => {
    const manageScreenWakeLock = async () => {
      try {
        if (isMeditating && keepScreenAwake) {
          // Activate screen wake lock with tag
          await activateKeepAwake('MeditationScreen');
          console.log('Screen keep awake activated for meditation');
          
          // Set additional screen timeout protection
          if (Platform.OS === 'android') {
            // On Android, we need additional protection against system power saving
            console.log('Additional Android wake lock protection enabled');
          }
        } else {
          // Deactivate screen wake lock
          await deactivateKeepAwake();
          console.log('Screen keep awake deactivated for meditation');
        }
      } catch (error) {
        console.error('Error managing screen wake lock:', error);
      }
    };
    
    manageScreenWakeLock();
    
    // Clean up on component unmount
    return () => {
      try {
        deactivateKeepAwake();
        console.log('Screen keep awake deactivated on cleanup');
      } catch (error) {
        console.error('Error deactivating screen wake lock:', error);
      }
    };
  }, [isMeditating, keepScreenAwake]);
  
  // Update app background state tracker
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      APP_IS_BACKGROUNDED.current = nextAppState.match(/inactive|background/);
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize speech service when component loads
  useEffect(() => {
    const initializeSpeech = async () => {
      await speechService.initialize();
    };
    
    initializeSpeech();
    
    return () => {
      // Clean up speech service when component unmounts
      speechService.stopPlayback();
    };
  }, []);

  // Update guided meditation type selection
  const renderGuidedMeditationTypeSelector = () => {
    if (!isGuidedMeditation || isMeditating) return null;
    
    return (
      <View style={styles.guidedMeditationTypeContainer}>
        <Text style={[styles.sectionTitle, { color: isLightTheme ? COLORS.dark : COLORS.light }]}>
          Meditation Focus
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.guidedMeditationTypeList}
        >
          {guidedMeditationTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.guidedMeditationTypeButton,
                guidedMeditationType === type.id && styles.guidedMeditationTypeButtonActive,
                { backgroundColor: isLightTheme ? COLORS.lighterGray : COLORS.darkGray }
              ]}
              onPress={() => setGuidedMeditationType(type.id)}
            >
              <MaterialIcons 
                name={type.icon} 
                size={24} 
                color={guidedMeditationType === type.id 
                  ? (isLightTheme ? COLORS.primary : COLORS.secondaryLight) 
                  : (isLightTheme ? COLORS.darkGray : COLORS.lightGray)} 
              />
              <Text style={[
                styles.guidedMeditationTypeText,
                guidedMeditationType === type.id && styles.guidedMeditationTypeTextActive,
                { color: isLightTheme ? COLORS.darkestGray : COLORS.lightestGray }
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Effect to manage guided meditation prompts when meditation starts
  useEffect(() => {
    if (isMeditating && isGuidedMeditation) {
      // Schedule guided meditation prompts when meditation starts
      manageGuidedMeditationPrompts(totalTime);
    }
  }, [isMeditating, isGuidedMeditation, guidedMeditationType, totalTime]);

  /**
   * Set up and schedule meditation guidance prompts
   * @param {number} totalSeconds - Total meditation duration in seconds
   */
  const manageGuidedMeditationPrompts = (totalSeconds) => {
    if (!isGuidedMeditation) return;
    
    try {
      // First make sure any previous prompts are stopped
      speechService.cancelAllPrompts();
      speechService.stopPlayback();
      
      // Add a small delay before starting new prompts to avoid audio conflicts
      setTimeout(() => {
        // Use the guidance type from UI state
        const scriptType = guidedMeditationType || 'dailyFocus';
        console.log(`Setting up meditation guidance prompts: type=${scriptType}, duration=${totalSeconds} seconds`);
        
        // Get meditation script
        const scriptPrompts = speechService.getMeditationScript(scriptType);
        
        if (!scriptPrompts || scriptPrompts.length === 0) {
          console.log(`Could not get prompts for type ${scriptType}`);
          return;
        }
        
        // Adjust prompts to match total duration
        const adjustedPrompts = speechService.adjustPromptsForDuration(scriptPrompts, totalSeconds);
        console.log(`Got ${adjustedPrompts.length} meditation prompts`);
        
        // Show first prompt after a short delay
        const firstPrompt = adjustedPrompts[0]?.text;
        if (firstPrompt) {
          // Small additional delay before first prompt
          setTimeout(() => {
            // Use animation function to properly fade in the text
            setPromptWithAnimation(firstPrompt);
            speechService.speak(firstPrompt);
            
            // Clear prompt after 10 seconds with proper fade out
            setTimeout(() => {
              setPromptWithAnimation("");
            }, 10000);
          }, 500);
        }
        
        // Use speech service to schedule remaining prompts, skipping the first one
        const remainingPrompts = adjustedPrompts.slice(1);
        
        speechService.scheduleGuidedMeditationPrompts(
          remainingPrompts, 
          totalSeconds, 
          (promptText) => {
            console.log(`Playing prompt: ${promptText.substring(0, 30)}...`);
            // Use animation function for smooth transitions
            setPromptWithAnimation(promptText);
            
            // Clear prompt after 10 seconds with proper fade out
            setTimeout(() => {
              setPromptWithAnimation("");
            }, 10000);
          }
        );
      }, 200);
    } catch (error) {
      console.error('Error setting up meditation guidance prompts:', error);
    }
  };

  // Function to start meditation with selected duration
  const startMeditation = () => {
    try {
      console.log(`Starting meditation session - Duration: ${customDuration}m, Sound: ${selectedSoundTheme}, Voice: ${isGuidedMeditation ? 'Enabled' : 'Disabled'}`);
      
      // Start with 5-second countdown
      setCountdown(5);
      setIsCountingDown(true);
      
      // Set selected duration
      setSelectedDuration(customDuration);
      
      // Set up remaining time and total time after countdown completes
      // This is now handled in the countdown useEffect

    } catch (error) {
      console.error('Error starting meditation:', error);
      Alert.alert('Error', 'There was a problem starting the meditation session.');
    }
  };

  // Function to handle quick duration selection
  const selectQuickDuration = (minutes) => {
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
      if (sound) {
        // Ensure playback starts from the beginning
        await sound.setPositionAsync(0);
        
        // Play the sound
        await sound.playAsync();
      }
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  }, [sound]);

  // Save meditation session to storage
  const saveMeditationSession = useCallback(
    async (durationInMinutes) => {
      try {
        console.log(`Saving meditation session: ${durationInMinutes}m, theme: ${selectedSoundTheme}, guided: ${isGuidedMeditation}`);
        
        // Create session object
        const session = {
          id: Date.now().toString(),
          duration: durationInMinutes,  // in minutes
          timestamp: new Date().toISOString(),
          theme: selectedSoundTheme,
          isGuided: isGuidedMeditation
        };
        
        // Get existing sessions or initialize empty array
        const sessionsJson = await storageService.getItem("meditation_sessions");
        let sessions = [];
        
        if (sessionsJson) {
          sessions = typeof sessionsJson === 'string' ? JSON.parse(sessionsJson) : sessionsJson;
        }
        
        // Add new session
        sessions.push(session);
        
        // Save updated sessions
        await storageService.setItem("meditation_sessions", sessions);
      } catch (error) {
        console.error("Error saving meditation session:", error);
      }
    },
    [selectedSoundTheme, isGuidedMeditation],
  );

  // End meditation
  const endMeditation = useCallback(
    (callback, resetDuration = true) => {
      // First stop all timers
      if (meditationTimer.current) {
        clearInterval(meditationTimer.current);
        meditationTimer.current = null;
      }
      
      if (promptTimerRef.current) {
        clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }

      // Ensure all voice prompts and playback are completely stopped
      try {
        // Cancel all scheduled voice prompts
        speechService.cancelAllPrompts();
        // Immediately stop any currently playing voice
        speechService.stopPlayback();
        // Clear current prompt (with animation effect)
        setPromptWithAnimation("");
      } catch (speechError) {
        console.error("Error stopping speech playback:", speechError);
      }

      // Safely handle audio resources with delay
      setTimeout(() => {
        releaseAllAudioResources();
      }, 200);

      // Reset animation values
      breatheAnim.setValue(1);
      pulseAnim.setValue(0);
      promptFadeAnim.setValue(0);

      // Reset UI state
      setIsMeditating(false);
      
      // Only reset these states if not showing completion screen
      if (resetDuration) {
        setIsMeditationComplete(false);
        setSelectedDuration(null);
        setProgress(0);
        setRemainingTime(0);
      }
      
      // Deactivate screen wake lock if it was active
      try {
        deactivateKeepAwake();
      } catch (error) {
        console.error('Error deactivating screen wake lock:', error);
      }
      
      // Execute callback if provided with delay
      setTimeout(() => {
        if (callback && typeof callback === "function") {
          callback();
        }
      }, 300);
    },
    [breatheAnim, pulseAnim, promptFadeAnim, releaseAllAudioResources]
  );

  // Add a new state for showing task redirection button
  const [showTaskRedirect, setShowTaskRedirect] = useState(false);

  // Function to navigate to task screen
  const navigateToTasks = useCallback(() => {
    navigation.navigate('Tasks');
  }, [navigation]);
  
  // Function to navigate to journal screen
  const navigateToJournal = useCallback(() => {
    navigation.navigate('Journal');
  }, [navigation]);

  // Function to complete meditation and prepare completion screen
  const completeMeditation = useCallback(async () => {
    console.log("Running completeMeditation function");
    // Always show task redirection button after meditation
    setShowTaskRedirect(true);
  }, []);
  
  // Handle meditation completion
  const handleMeditationComplete = useCallback(
    async (duration) => {
      console.log(`Meditation completed: ${duration} minutes`);
      
      // Stop background music first, then play completion sound
      // Stop any playing background sounds but don't release resources yet
      if (primarySoundRef.current) {
        try {
          const status = await primarySoundRef.current.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await primarySoundRef.current.stopAsync();
          }
        } catch (error) {
          console.error("Error stopping sound:", error);
        }
      }
      
      // Play completion sound
      await playCompletionSound();
      
      // Vibrate device (if not on web)
      if (!isWeb) {
        Vibration.vibrate([0, 500, 200, 500]);
      }
      
      // Update UI state
      setIsMeditating(false);
      setIsMeditationComplete(true);
      
      // Call completeMeditation to set up the completion screen
      completeMeditation();
      
      // Save meditation to history
      try {
        // Get existing history
        const historyString = await storageService.getItem("meditationHistory");
        let history = [];
        
        if (historyString) {
          try {
            history = JSON.parse(historyString);
          } catch (parseError) {
            console.log("Error parsing history, initializing new history array", parseError);
            history = [];
          }
        }
        
        // Add new session with properly formatted date
        const newSession = {
          date: new Date().toISOString(),
          duration: duration,
          soundTheme: selectedSoundTheme,
        };
        
        history.push(newSession);
        
        // Save updated history with proper JSON formatting
        await storageService.setItem("meditationHistory", JSON.stringify(history));
        console.log("Meditation session saved to history");
      } catch (error) {
        console.error("Error saving meditation history:", error);
      }
    },
    [playCompletionSound, isWeb, selectedSoundTheme, completeMeditation]
  );

  // Navigation handler - with confirmation if needed
  const goBack = useCallback(() => {
    if (isMeditating || isCountingDown) {
      Alert.alert(
        "End Meditation",
        "Are you sure you want to end your current session? This will end the meditation permanently.",
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

  // Add startBreathingAnimation function
  const startBreathingAnimation = useCallback(() => {
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

    // Start animation
    breathAnimation.start();
  }, [breatheAnim]);

  // Add statusLogTimeRef variable
  const audioLoopCountRef = useRef(0);
  const statusLogTimeRef = useRef(0);

  return (
    <View style={[
      styles.container, 
      isLightTheme && styles.lightContainer,
      { paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : (insets?.top || 0) }
    ]}>
      {!isLightTheme && <RNStatusBar barStyle="light-content" />}
      {isLightTheme && <RNStatusBar barStyle="dark-content" />}

      {!isMeditating && !isCountingDown && !isMeditationComplete && (
        <>
          <View style={styles.headerContainer}>
            <CustomHeader 
              title="MEDITATION"
              onBackPress={() => goBackToHome(navigation)}
              showBottomBorder={false}
            />
          </View>
          <View style={styles.selectionContent}>
            <View style={styles.scrollContent}>
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
                    {customDuration} minute{customDuration !== 1 ? "s" : ""}
                  </Text>

                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={60}
                    value={customDuration}
                    onValueChange={(value) => setCustomDuration(Math.round(value))}
                    step={1}
                    minimumTrackTintColor={COLORS.text.primary}
                    maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
                    thumbTintColor={COLORS.text.primary}
                  />

                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>1 min</Text>
                    <Text style={styles.sliderLabel}>60 min</Text>
                  </View>
                </View>
              </View>

              <View style={styles.soundSection}>
                <Text style={styles.sectionTitle}>Background Sound</Text>

                <View style={styles.soundThemeContainer}>
                  {soundThemes.map((theme) => (
                    <TouchableOpacity
                      key={theme.id}
                      style={[
                        styles.soundThemeButton,
                        selectedSoundTheme === theme.id &&
                          styles.soundThemeButtonSelected,
                      ]}
                      onPress={() => {
                        setSelectedSoundTheme(theme.id);
                        console.log("Selected sound theme:", theme.id);
                      }}
                    >
                      <Ionicons
                        name={theme.icon}
                        size={22}
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
                      >
                        {theme.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Guided Meditation Toggle */}
              
              <View style={styles.guidedMeditationContainer}>
                <View style={styles.guidedMeditationTextContainer}>
                  <MaterialCommunityIcons
                    name="meditation"
                    size={24}
                    color={COLORS.text.secondary}
                    style={styles.guidedMeditationIcon}
                  />
                  <View>
                    <Text style={styles.guidedMeditationTitle}>
                      Guided Meditation
                    </Text>
                    <Text style={styles.guidedMeditationSubtitle}>
                      AI voice prompts will guide your practice
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isGuidedMeditation}
                  onValueChange={setIsGuidedMeditation}
                  trackColor={{ false: "#222", true: "#444" }}
                  thumbColor={isGuidedMeditation ? COLORS.text.primary : "#888"}
                />
              </View>
            
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.startButton} onPress={startMeditation}>
                <Text style={styles.startButtonText}>Begin Meditation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
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
            {selectedDuration !== 1 ? "s" : ""} of mindfulness
          </Text>
          
          <Text style={styles.completionSubtext}>
            Take a moment to notice how you feel right now. Your mindfulness practice helps build focus and clarity.
          </Text>

          <View style={styles.navigationButtonsContainer}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => navigation.navigate("Tasks")}
            >
              <MaterialIcons name="assignment" size={24} color={COLORS.background} />
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
              <MaterialIcons name="home" size={24} color={COLORS.text.secondary} />
              <Text style={styles.homeButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isMeditating && !isMeditationComplete && (
        <View style={styles.meditationContainer}>
          {/* Guided meditation toggle switch */}
          <View style={styles.guidedSwitchContainer}>
            <MaterialCommunityIcons
              name="meditation"
              size={16}
              color={COLORS.text.primary}
            />
            <Text style={styles.guidedSwitchText}>Guided</Text>
            <Switch
              value={isGuidedMeditation}
              onValueChange={(value) => {
                setIsGuidedMeditation(value);
                // Reset prompt when turning off guided mode
                if (!value) {
                  setPromptWithAnimation("");
                }
              }}
              trackColor={{ false: "rgba(255, 255, 255, 0.1)", true: "rgba(255, 255, 255, 0.3)" }}
              thumbColor={isGuidedMeditation ? COLORS.text.primary : "#888"}
              style={styles.guidedSwitch}
            />
          </View>
          
          {/* Meditation prompt container - shows either guided prompts or "Breathe and relax" */}
          {(isGuidedMeditation && currentPrompt) || (!isGuidedMeditation) ? (
            <Animated.View 
              style={[
                styles.promptContainer,
                { 
                  opacity: isGuidedMeditation ? promptFadeAnim : 1,
                  backgroundColor: isGuidedMeditation ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)',
                  // Only display the container when prompt text exists
                  display: (isGuidedMeditation && !currentPrompt) ? 'none' : 'flex'
                }
              ]}
            >
              {isGuidedMeditation ? (
                // Show guided meditation prompt when available
                currentPrompt && <Text style={styles.promptText}>{currentPrompt}</Text>
              ) : (
                // Show "Breathe and relax" when not in guided mode
                <Text style={styles.promptText}>Breathe and relax...</Text>
              )}
            </Animated.View>
          ) : null}
          
          {/* Timer circle */}
          <View style={styles.timerCircleContainer}>
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
              />
            </Animated.View>
          </View>

          {/* Session info */}
          <View style={styles.sessionInfoContainer}>
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
          </View>

          {/* End meditation button */}
          <TouchableOpacity
            style={styles.endMeditationButton}
            onPress={() => {
              Alert.alert(
                "End Meditation",
                "Are you sure you want to end your current session? This will end the meditation permanently.",
                [
                  {
                    text: "Continue",
                    style: "cancel",
                  },
                  {
                    text: "End Session",
                    onPress: () => {
                      // Safely call endMeditation
                      try {
                        endMeditation(() => {
                          // Ensure navigation happens after state updates
                          setTimeout(() => {
                            goBackToHome(navigation);
                          }, 100);
                        });
                      } catch (error) {
                        console.error("Error ending meditation:", error);
                        // If failed, at least try to reset UI state
                        setIsMeditating(false);
                        goBackToHome(navigation);
                      }
                    },
                    style: "destructive",
                  },
                ],
              );
            }}
          >
            <MaterialIcons name="close" size={20} color={COLORS.text.primary} />
            <Text style={styles.endMeditationText}>Cancel</Text>
          </TouchableOpacity>

          {/* Add guided meditation type selection */}
          {renderGuidedMeditationTypeSelector()}
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
  headerContainer: {
    paddingTop: SPACING.s,
    marginBottom: SPACING.s,
  },
  selectionContent: {
    flex: 1,
    alignItems: "center",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  scrollContent: {
    flex: 1,
    width: "100%",
    paddingTop: SPACING.xs,
  },
  durationSection: {
    width: "100%",
    marginTop: SPACING.s,
    marginBottom: SPACING.l,
  },
  soundSection: {
    width: "100%",
    marginTop: SPACING.s,
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.m,
    fontWeight: "500",
  },
  quickDurationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },
  quickDurationButton: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: LAYOUT.borderRadius.m,
    paddingVertical: SPACING.xs,
    paddingHorizontal: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    flex: 1,
    marginHorizontal: 3,
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
  customContainer: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: LAYOUT.borderRadius.l,
    padding: SPACING.m,
    alignItems: "center",
  },
  customDurationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: "600",
    marginBottom: SPACING.m,
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: SPACING.xs,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
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
  },
  soundThemeButton: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: LAYOUT.borderRadius.m,
    padding: SPACING.s,
    marginBottom: SPACING.s,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    width: "23%", 
    aspectRatio: 1,
  },
  soundThemeButtonSelected: {
    backgroundColor: COLORS.text.primary,
    borderColor: COLORS.text.primary,
  },
  soundThemeText: {
    color: COLORS.text.secondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  soundThemeTextSelected: {
    color: COLORS.background,
  },

  
  guidedMeditationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: LAYOUT.borderRadius.l,
    padding: SPACING.m,
    width: '100%',
  },
    guidedMeditationTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  guidedMeditationIcon: {
    marginRight: SPACING.m,
  },
  guidedMeditationTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: '500',
  },
  guidedMeditationSubtitle: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
    paddingRight: 50,
  },
  
  buttonContainer: {
    width: "100%",
    paddingVertical: SPACING.s,
    marginTop: SPACING.s,
    marginBottom: SPACING.l,
    
  },
  startButton: {
    backgroundColor: COLORS.text.primary,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xl,
    borderRadius: LAYOUT.borderRadius.m,
    width: "100%",
    alignItems: "center",
  },
  startButtonText: {
    color: COLORS.background,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
  },
  countdownContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    color: COLORS.text.primary,
    fontSize: 96,
    fontWeight: "200",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    marginBottom: SPACING.m,
  },
  countdownSubtext: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    marginTop: SPACING.s,
  },
  meditationContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
    paddingTop: SPACING.xl,
  },
  guidedSwitchContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    borderRadius: LAYOUT.borderRadius.l,
    zIndex: 20,
    top: SPACING.xl,
    left: '50%',
    transform: [{ translateX: -70 }],
  },
  guidedSwitchText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.s,
    marginLeft: SPACING.xs,
    marginRight: SPACING.s,
    fontWeight: '500',
  },
  guidedSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  promptContainer: {
    position: 'absolute',
    top: SPACING.xl + 60,
    left: '4%',
    right: '4%',
    padding: SPACING.m,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: LAYOUT.borderRadius.l,
    alignItems: 'center',
    justifyContent: 'center',
    width: '92%',
    zIndex: 15,
    minHeight: 80,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  promptText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: "400",
    paddingVertical: SPACING.xs,
  },
  timerCircleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -TIMER_SIZE/2 }, { translateY: -TIMER_SIZE/2 }],
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    color: COLORS.text.primary,
    fontSize: 36,
    fontWeight: "200",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  sessionInfoContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
    bottom: 120,
    paddingHorizontal: SPACING.l,
    zIndex: 5,
  },
  durationText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  soundIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.m,
    borderRadius: LAYOUT.borderRadius.l,
    marginBottom: SPACING.m,
  },
  soundIndicatorText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
    marginLeft: SPACING.xs,
  },
  endMeditationButton: {
    position: "absolute",
    bottom: 50,
    left: '50%',
    transform: [{ translateX: -60 }],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: LAYOUT.borderRadius.m,
    borderWidth: 1,
    borderColor: "#444",
    width: 120,
    ...SHADOWS.small,
    zIndex: 30,
  },
  endMeditationText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: "500",
    marginLeft: SPACING.xs,
  },
  completionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
    backgroundColor: COLORS.background,
  },
  completionTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: "bold",
    marginVertical: SPACING.m,
  },
  completionText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.m,
    textAlign: "center",
  },
  completionSubtext: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    marginVertical: SPACING.l,
    textAlign: "center",
    lineHeight: FONT_SIZE.m * 1.5,
    maxWidth: "90%",
  },
  navigationButtonsContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: SPACING.l,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.m,
    borderRadius: LAYOUT.borderRadius.m,
    width: "100%",
    backgroundColor: COLORS.text.primary,
    marginBottom: SPACING.m,
    ...SHADOWS.medium,
  },
  continueButtonText: {
    color: COLORS.background,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
    marginLeft: SPACING.s,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.m,
    borderRadius: LAYOUT.borderRadius.m,
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.text.secondary,
    backgroundColor: "transparent",
  },
  homeButtonText: {
    color: COLORS.text.secondary,
    fontWeight: "600",
    fontSize: FONT_SIZE.m,
    marginLeft: SPACING.s,
  },
});

export default MeditationScreen;
