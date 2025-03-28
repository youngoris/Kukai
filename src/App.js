/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useEffect, useRef } from "react";
import { StatusBar, Platform } from "react-native";
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
import { AppProvider } from './context/AppContext';
import AppNavigator from './navigation/AppNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';

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

  // Initialize database
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log("Initializing database...");
        
        // Make sure database service is properly instantiated
        if (!databaseService) {
          console.error("Database service is undefined");
          return;
        }
        
        // Initialize database
        const dbResult = await databaseService.initialize();
        
        if (dbResult.success) {
          console.log("Database initialized successfully");
          console.log(`Database schema version: ${dbResult.dbVersion || 'unknown'}`);
          
          // Initialize backup service
          await databaseBackupService.initialize();
          
          // Initialize database indexes for query optimization
          await databaseQueryOptimizer.ensureIndexes();
          
          // Check for automatic backup
          const backupResult = await databaseBackupService.checkAutomaticBackup();
          if (backupResult.performed) {
            console.log("Automatic backup completed:", backupResult.result.name);
          }
          
        } else {
          console.error("Database initialization failed:", dbResult.error);
          
          // Attempt to recover from initialization failure
          // This might happen if a migration failed
          if (dbResult.error && dbResult.error.includes('migration')) {
            console.log("Attempting to recover from migration failure...");
            // In a production app, you might want to show a dialog to the user here
            // For now, we'll just log the error
          }
        }
      } catch (error) {
        console.error("Failed to initialize database:", error);
      }
    };

    initializeDatabase();
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
      StatusBar.setBarStyle('light-content');
    }
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppProvider>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="auto" />
              <AppNavigator />
            </NavigationContainer>
          </AppProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
