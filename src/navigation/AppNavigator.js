import React, { useState, useEffect } from "react";
import { Dimensions } from "react-native";
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

const { width } = Dimensions.get("window");
const Stack = createNativeStackNavigator();

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
        if (hasCompletedOnboarding === 'true') {
          setInitialRoute('Home');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to Home screen on error
        setInitialRoute('Home');
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
        
        // Determine animation direction
        let animation = "slide_from_right"; // Default slide from right
        
        if (fromBack) {
          animation = "slide_from_left";
        } else if (fromRight) {
          animation = "slide_from_right";
        }
        
        return {
          headerShown: false,
          contentStyle: { backgroundColor: "#000" },
          // Use animation based on parameters
          animation: animation,
          gestureEnabled: route.name !== "Home" && route.name !== "Settings" && route.name !== "Onboarding",
          // This helps with the animation when replacing screens
          animationTypeForReplace: "push",
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
    </Stack.Navigator>
  );
};

export default AppNavigator;
