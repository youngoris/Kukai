import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Platform,
  Image,
  FlatList,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import storageService from '../services/storage/StorageService';
import {
  SPACING,
  FONT_SIZE,
  COLORS,
  LAYOUT,
  SHADOWS,
} from '../constants/DesignSystem';

const { width } = Dimensions.get('window');

const OnboardingScreen = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  
  // Voice guidance setting
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(true);

  // 添加调试日志以确认组件正在渲染
  console.log("OnboardingScreen rendering");

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        // 尝试注释掉自动导航，先测试屏幕是否显示
        const hasCompletedOnboarding = await storageService.getItem('hasCompletedOnboarding');
        console.log("DEBUG - Onboarding status:", hasCompletedOnboarding);
        
        // 暂时注释掉自动导航逻辑，确保屏幕能显示
        // if (hasCompletedOnboarding === 'true') {
        //   // Navigate to Home screen immediately to avoid flicker
        //   navigation.replace('Home');
        // }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // 暂时移除错误处理中的导航
        // In case of error, still navigate to Home to prevent UX issues
        // navigation.replace('Home');
      }
    };
    
    // Check immediately after component mount
    checkOnboardingStatus();
  }, [navigation]);

  const pages = [
    {
      title: 'Welcome to Kukai',
      subtitle: 'Your journey to mindfulness and productivity begins here',
      icon: 'app',
      color: '#1A1A1A',
    },
    {
      title: 'Meditation',
      subtitle: 'Start your day with guided meditation sessions',
      icon: 'spa',
      color: '#1A1A1A',
    },
    {
      title: 'Task Management',
      subtitle: 'Organize and prioritize your daily tasks',
      icon: 'task',
      color: '#1A1A1A',
    },
    {
      title: 'Focus Timer',
      subtitle: 'Stay productive with the Pomodoro technique',
      icon: 'timer',
      color: '#1A1A1A',
    },
    {
      title: 'Journal',
      subtitle: 'Reflect on your day with guided journaling',
      icon: 'book',
      color: '#1A1A1A',
    },
    {
      title: 'Your Preferences',
      subtitle: 'Configure your meditation settings',
      icon: 'settings',
      color: '#1A1A1A',
      isSettings: true,
    },
  ];

  const markOnboardingComplete = async () => {
    try {
      // Use the explicit string value 'true' instead of boolean for consistent storage and retrieval
      await storageService.setItem('hasCompletedOnboarding', 'true');
      console.log('Onboarding marked as completed');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const saveUserSettings = async () => {
    try {
      // Get existing settings or create new object
      const existingSettingsRaw = await storageService.getItem('userSettings');
      let existingSettings = {};
      
      if (existingSettingsRaw) {
        try {
          existingSettings = typeof existingSettingsRaw === 'string' 
            ? JSON.parse(existingSettingsRaw) 
            : existingSettingsRaw;
        } catch (parseError) {
          console.error('Error parsing existing settings:', parseError);
          // Continue with empty settings object if parse fails
        }
      }
      
      // Update with new settings
      const updatedSettings = {
        ...existingSettings,
        voiceGuidanceEnabled,
      };
      
      // Save updated settings
      await storageService.setItem('userSettings', JSON.stringify(updatedSettings));
      console.log('User settings saved:', updatedSettings);
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  };

  const handleNext = async () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
      flatListRef.current?.scrollToIndex({
        index: currentPage + 1,
        animated: true,
      });
    } else {
      // Save user settings before completing onboarding
      await saveUserSettings();
      await markOnboardingComplete();
      // Navigate to Home with slide from right animation
      console.log("Onboarding completed - navigating to Home");
      navigation.replace('Home', { fromRight: true });
    }
  };

  const handleSkip = async () => {
    // Save default user settings
    await saveUserSettings();
    await markOnboardingComplete();
    // Navigate to Home with slide from right animation
    console.log("Onboarding skipped - navigating to Home");
    navigation.replace('Home', { fromRight: true });
  };

  const renderIcon = (iconName) => {
    if (iconName === 'app') {
      return (
        <View style={styles.appIconWrapper}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.appIcon}
            resizeMode="cover"
          />
        </View>
      );
    }
    return (
      <MaterialIcons
        name={iconName}
        size={80}
        color={COLORS.text.primary}
      />
    );
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentPage(viewableItems[0].index);
    }
  }).current;

  const renderItem = ({ item, index }) => {
    return (
      <View style={styles.page}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              transform: [
                {
                  scale: scrollX.interpolate({
                    inputRange: [
                      (index - 1) * width,
                      index * width,
                      (index + 1) * width,
                    ],
                    outputRange: [0.8, 1, 0.8],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          {renderIcon(item.icon)}
        </Animated.View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        {item.isSettings && (
          <View style={styles.settingsContainer}>
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Voice Guidance</Text>
                <Text style={styles.settingDescription}>
                  Enable spoken guidance during meditation
                </Text>
              </View>
              <Switch
                value={voiceGuidanceEnabled}
                onValueChange={(value) => setVoiceGuidanceEnabled(value)}
                trackColor={{ false: '#333', true: '#444' }}
                thumbColor={voiceGuidanceEnabled ? '#FFF' : '#888'}
                style={styles.settingSwitch}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  // Add reset functionality for testing
  const resetstorageService = async () => {
    try {
      await storageService.clear();
      console.log("Storage has been cleared");
      alert("Storage cleared");
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Reset button for testing */}
      <TouchableOpacity 
        style={[styles.skipButton, { left: 20, right: 'auto' }]} 
        onPress={resetstorageService}
      >
        <Text style={styles.skipText}>Reset</Text>
      </TouchableOpacity>

      {/* Page content using FlatList for horizontal scrolling */}
      <FlatList
        ref={flatListRef}
        data={pages}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Pagination dots */}
      <View style={styles.paginationContainer}>
        {pages.map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.paginationDot,
              {
                width: scrollX.interpolate({
                  inputRange: [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                  ],
                  outputRange: [8, 24, 8],
                  extrapolate: 'clamp'
                }),
                opacity: scrollX.interpolate({
                  inputRange: [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                  ],
                  outputRange: [0.3, 1, 0.3],
                  extrapolate: 'clamp'
                }),
              },
            ]}
          />
        ))}
      </View>

      {/* Next/Get Started button */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 1,
    padding: SPACING.s,
  },
  skipText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.m,
    fontWeight: '500',
  },
  page: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.m,
  },
  subtitle: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.l,
    textAlign: 'center',
    lineHeight: FONT_SIZE.l * 1.5,
    maxWidth: '80%',
    marginBottom: SPACING.xl,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text.primary,
    marginHorizontal: 4,
  },
  nextButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.m,
    width: '90%',
    alignSelf: 'center',
    borderRadius: 16,
    marginBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    ...SHADOWS.medium,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
    textAlign: 'center',
  },
  appIconWrapper: {
    width: '120%',
    height: '120%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  appIcon: {
    width: '100%',
    height: '100%',
  },
  settingsContainer: {
    width: '100%',
    marginTop: SPACING.m,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: SPACING.m,
    width: '100%',
  },
  settingContent: {
    flex: 1,
    paddingRight: SPACING.m,
  },
  settingLabel: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
  },
  settingSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
});

export default OnboardingScreen; 