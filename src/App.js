import React, { useEffect, useRef } from "react";
import { StatusBar, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-gesture-handler";
import {
  useFonts,
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";
import * as SplashScreen from "expo-splash-screen";

// Import services
import googleDriveService from "./services/GoogleDriveService";
import notificationService from "./services/NotificationService";

// Import navigation
import AppNavigator from "./navigation/AppNavigator";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignore errors */
});

// Main application component
export default function App() {
  // Load fonts
  const [fontsLoaded] = useFonts({
    Roboto_300Light,
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  // Create navigation reference
  const navigationRef = useRef(null);

  // Reset focus session state when app starts
  useEffect(() => {
    const resetFocusSessionState = async () => {
      try {
        // Remove the saved focus session state to reset timer on app restart
        await AsyncStorage.removeItem('focusSessionState');
        console.log('Focus session state reset on app restart');
      } catch (error) {
        console.error('Error resetting focus session state:', error);
      }
    };

    resetFocusSessionState();
  }, []);

  // Hide splash screen when fonts are loaded
  useEffect(() => {
    const hideSplash = async () => {
      if (fontsLoaded) {
        await SplashScreen.hideAsync();
      }
    };

    hideSplash();
  }, [fontsLoaded]);

  // Initialize Google Drive service
  useEffect(() => {
    const initializeGoogleDrive = async () => {
      try {
        console.log("Initializing Google Drive service...");

        // Print environment variables for debugging
        console.log(
          "GOOGLE_EXPO_CLIENT_ID:",
          process.env.GOOGLE_EXPO_CLIENT_ID ? "Set" : "Not set",
        );
        console.log(
          "GOOGLE_IOS_CLIENT_ID:",
          process.env.GOOGLE_IOS_CLIENT_ID ? "Set" : "Not set",
        );
        console.log(
          "GOOGLE_ANDROID_CLIENT_ID:",
          process.env.GOOGLE_ANDROID_CLIENT_ID ? "Set" : "Not set",
        );
        console.log(
          "GOOGLE_WEB_CLIENT_ID:",
          process.env.GOOGLE_WEB_CLIENT_ID ? "Set" : "Not set",
        );

        const initialized = await googleDriveService.initialize();
        console.log("Google Drive service initialized:", initialized);

        if (initialized) {
          const syncPerformed =
            await googleDriveService.checkAndPerformAutoSync();
          console.log("Auto sync check performed:", syncPerformed);
        }
      } catch (error) {
        console.error("Failed to initialize Google Drive service:", error);
      }
    };

    initializeGoogleDrive();
  }, []);

  // Initialize notification service
  useEffect(() => {
    notificationService.initialize().then((initialized) => {
      if (initialized) {
        console.log("Notification system initialized successfully");
      } else {
        console.log(
          "Notification system initialization failed, permissions may have been denied",
        );
      }
    });

    // Clean up notification listener
    return () => {
      notificationService.cleanup();
    };
  }, []);

  // Set navigation reference
  useEffect(() => {
    if (navigationRef.current) {
      notificationService.setNavigationRef(navigationRef.current);
    }
  }, [navigationRef.current]);

  // Set status bar for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent');
    }
  }, []);

  return (
    <>
      {Platform.OS === 'android' && <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef}>
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
