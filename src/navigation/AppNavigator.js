import React, { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import storageService from '../services/storage/StorageService';

// Import screens
import OnboardingScreen from "../screens/OnboardingScreen";
import HomeScreen from "../screens/HomeScreen";
import MeditationScreen from "../screens/MeditationScreen";
import TaskScreen from "../screens/TaskScreen";
import FocusScreen from "../screens/FocusScreen";
import SummaryScreen from "../screens/SummaryScreen";
import JournalScreen from "../screens/JournalScreen";
import JournalEditScreen from "../screens/JournalEditScreen";
import SettingsScreen from "../screens/SettingsScreen";
import CameraScreen from "../screens/CameraScreen";
import PhotoGalleryScreen from "../screens/PhotoGalleryScreen";

// Debug screen components
console.log("OnboardingScreen:", !!OnboardingScreen);
console.log("HomeScreen:", !!HomeScreen);
console.log("MeditationScreen:", !!MeditationScreen);
console.log("TaskScreen:", !!TaskScreen);
console.log("FocusScreen:", !!FocusScreen);
console.log("SummaryScreen:", !!SummaryScreen);
console.log("JournalScreen:", !!JournalScreen);
console.log("JournalEditScreen:", !!JournalEditScreen);
console.log("SettingsScreen:", !!SettingsScreen);
console.log("CameraScreen:", !!CameraScreen);
console.log("PhotoGalleryScreen:", !!PhotoGalleryScreen);

const { width } = Dimensions.get("window");
const Stack = createNativeStackNavigator();

// Development mode flag - set to true to always show onboarding screen
const DEV_MODE = true; // Set to false when done with development

const AppNavigator = () => {
  // Add state to track initial route
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if onboarding has been completed when component mounts
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasCompletedOnboarding = await storageService.getItem('hasCompletedOnboarding');
        console.log("AppNavigator - Onboarding status:", hasCompletedOnboarding);
        if (hasCompletedOnboarding === 'true' && !DEV_MODE) {
          setInitialRoute('Home');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to Home screen on error
        if (!DEV_MODE) {
          setInitialRoute('Home');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    checkOnboardingStatus();
  }, []);
  
  // Show loading state
  if (isLoading) {
    return null; // Or return a loading indicator
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={({ route, navigation }) => {
        // Get the route params
        const params = route.params || {};
        // Check if we're navigating with a specific direction
        const fromBack = params.fromBack === true;
        const fromRight = params.fromRight === true;
        
        return {
          headerShown: false,
          contentStyle: { backgroundColor: "#000" },
          // Use default animation on Android for better stability
          animation: Platform.OS === 'android' ? undefined : (fromBack ? "slide_from_left" : "slide_from_right"),
          gestureEnabled: Platform.OS === 'ios' && route.name !== "Home" && route.name !== "Settings" && route.name !== "Onboarding",
          // Use default animation type on Android
          animationTypeForReplace: Platform.OS === 'android' ? 'pop' : 'push',
          // Add detachPreviousScreen option for Android
          detachPreviousScreen: Platform.OS === 'android' ? false : true,
        };
      }}
    >
      <Stack.Screen 
        name="Onboarding" 
        component={OnboardingScreen}
        options={{
          gestureEnabled: false
        }}
      />
      <Stack.Screen 
        name="Home" 
        component={HomeScreen} 
        options={({ route }) => ({
          // Home screen animation depends on the fromRight parameter
          animation: route.params?.fromRight ? "slide_from_right" : "slide_from_left"
        })}
      />
      <Stack.Screen 
        name="Meditation" 
        component={MeditationScreen} 
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
        name="JournalEdit" 
        component={JournalEditScreen} 
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen} 
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          animation: 'fade',
          gestureEnabled: false
        }}
      />
      <Stack.Screen 
        name="PhotoGallery" 
        component={PhotoGalleryScreen}
        options={{
          animation: 'fade'
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
