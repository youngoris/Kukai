/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useEffect, useRef, useState } from "react";
import { StatusBar, Platform, LogBox, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import "react-native-gesture-handler";
import {
  useFonts,
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from "@expo-google-fonts/roboto";
import * as SplashScreen from "expo-splash-screen";
import { AppProvider } from './context/AppContext';
import AppNavigator from './navigation/AppNavigator';
import { ErrorBoundary, setupGlobalErrorHandler } from './components/ErrorBoundary';
import { errorLogger } from './services/errorLogger';
import { ErrorProvider } from './context/ErrorContext';
import { withErrorHandling } from './utils/errorHandlingUtils';

// Import services
import googleDriveService from "./services/GoogleDriveService";
import notificationService from "./services/NotificationService";
import { 
  databaseService, 
  databaseBackupService, 
  databaseQueryOptimizer,
} from "./services";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignore errors */
});

// Set up global error handler for uncaught JS exceptions
setupGlobalErrorHandler();

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'ViewPropTypes will be removed from React Native',
  'AsyncStorage has been extracted from react-native',
  'Require cycle',
  // Add other warnings you want to suppress
]);

// Main application component
export default function App() {
  // Add initialization state tracking
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState(null);
  
  // Load fonts
  const [fontsLoaded] = useFonts({
    Roboto_300Light,
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  // Create navigation reference
  const navigationRef = useRef(null);

  // Handle all initialization in a centralized manner
  useEffect(() => {
    async function prepareApp() {
      try {
        // 1. Initialize database (as core functionality)
        console.log("Initializing database...");
        if (databaseService) {
          const dbResult = await databaseService.initialize();
          if (!dbResult.success) {
            console.warn("DB initialization warning:", dbResult.error);
          }
        }

        // 2. Hide splash screen when fonts are loaded
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }

        // 3. Non-critical service initialization - using delayed loading
        setTimeout(() => {
          // Background initialization of other services
          Promise.all([
            initBackupService(),
            initGoogleDrive(),
            initNotifications()
          ]).catch(err => console.warn("Background services init error:", err));
        }, 3000);

        // Application ready
        setIsReady(true);
      } catch (error) {
        console.error("App initialization error:", error);
        setInitError(error.message);
        // Try to hide splash screen and display error UI
        if (fontsLoaded) {
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    prepareApp();
  }, [fontsLoaded]);

  // Background initialization functions
  const initBackupService = async () => {
    try {
      await databaseBackupService.initialize();
      await databaseQueryOptimizer.ensureIndexes();
      const backupResult = await databaseBackupService.checkAutomaticBackup();
      if (backupResult.performed) {
        console.log("Auto backup completed:", backupResult.result.name);
      }
    } catch (error) {
      console.warn("Backup service init error:", error);
    }
  };

  const initGoogleDrive = async () => {
    try {
      console.log("Initializing Google Drive service...");
      
      // First check and ensure environment configuration is correct
      await googleDriveService.ensureProperSetup();
      
      const initialized = await googleDriveService.initialize();
      if (initialized) {
        await googleDriveService.checkAndPerformAutoSync();
      }
    } catch (error) {
      console.warn("Google Drive init error:", error);
    }
  };

  const initNotifications = async () => {
    try {
      await notificationService.initialize();
    } catch (error) {
      console.warn("Notification init error:", error);
    }
  };

  // Set status bar for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setBarStyle('light-content');
    }
  }, []);

  // Set navigation reference
  useEffect(() => {
    if (navigationRef.current) {
      notificationService.setNavigationRef(navigationRef.current);
    }
  }, [navigationRef.current]);

  // Create custom safe area metrics with reduced bottom inset
  const customSafeAreaMetrics = initialWindowMetrics 
    ? {
        ...initialWindowMetrics,
        insets: {
          ...initialWindowMetrics.insets,
          bottom: Math.max(initialWindowMetrics.insets.bottom / 2, 5), // Reduce bottom inset by half, but keep at least 5px
        }
      } 
    : undefined;

  // Render loading or error state
  if (!fontsLoaded || !isReady) {
    return null; // Keep splash screen
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 16, marginBottom: 10 }}>
          There was a problem starting the application. Please restart the app or contact support.
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider
          initialMetrics={customSafeAreaMetrics}
        >
          <ErrorProvider>
            <AppProvider>
              <NavigationContainer 
                ref={navigationRef}
                onStateChange={(state) => {
                  // Track navigation state changes for error context
                  const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
                  if (currentRouteName) {
                    // Store current route for error context
                    global.currentScreen = currentRouteName;
                  }
                }}
              >
                <StatusBar style="auto" />
                <AppNavigator />
              </NavigationContainer>
            </AppProvider>
          </ErrorProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
