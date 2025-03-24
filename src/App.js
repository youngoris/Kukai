import React, { useEffect, useRef } from "react";
import { StatusBar, Platform } from "react-native";
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
import { AppProvider } from './context/AppContext';
import AppNavigator from './navigation/AppNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import services
import googleDriveService from "./services/GoogleDriveService";
import notificationService from "./services/NotificationService";
import { 
  databaseService, 
  databaseBackupService, 
  databaseQueryOptimizer 
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
        
        if (dbResult && dbResult.success) {
          console.log("Database initialized successfully");
          
          // Check if data migration is needed
          const migrationCompleted = await AsyncStorage.getItem('@dbMigrationCompleted');
          if (migrationCompleted !== 'true') {
            console.log("Starting data migration from AsyncStorage to SQLite...");
            const migrationResult = await databaseService.migrateFromAsyncStorage();
            if (migrationResult && migrationResult.success) {
              console.log("Data migration completed successfully");
              await AsyncStorage.setItem('@dbMigrationCompleted', 'true');
            } else {
              const errorMsg = migrationResult?.error || 'Unknown error during migration';
              console.error("Data migration failed:", errorMsg);
            }
          } else {
            console.log("Data migration already completed");
          }
          
          try {
            // Initialize database indexes for query optimization
            const indexResult = await databaseQueryOptimizer.ensureIndexes();
            if (indexResult.success) {
              console.log("Database indexes have been successfully configured");
            } else {
              // Still continue even if some indexes failed - this is not critical
              console.warn("Some database indexes could not be created, but app can still function");
            }
            
            // Check for automatic backup
            await databaseBackupService.checkAutomaticBackup();
          } catch (optimizationError) {
            // Log error but don't prevent app from running
            console.error("Error during post-initialization steps:", optimizationError);
            console.log("App will continue despite initialization errors");
          }
        } else {
          const errorMsg = dbResult?.error || 'Unknown error';
          console.error("Database initialization failed:", errorMsg);
        }
      } catch (error) {
        console.error("Failed to initialize database:", error?.message || error);
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

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="auto" />
            <AppNavigator />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
