/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useEffect, useRef } from "react";
import { StatusBar, Platform, LogBox } from "react-native";
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
  // Add other warnings you want to suppress
]);

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

  // Initialize database with error handling
  useEffect(() => {
    const initializeDatabase = async () => {
      const result = await withErrorHandling(async () => {
        console.log("Initializing database...");
        
        // Make sure database service is properly instantiated
        if (!databaseService) {
          throw new Error("Database service is undefined");
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
          throw new Error(`Database initialization failed: ${dbResult.error || 'Unknown error'}`);
        }
      }, { operation: 'Database initialization' });
      
      if (!result.success) {
        console.error("Database initialization error:", result.error);
        // App can continue - we'll handle database errors at the component level
      }
    };

    initializeDatabase();
  }, []);

  // Hide splash screen when fonts are loaded
  useEffect(() => {
    const hideSplash = async () => {
      const result = await withErrorHandling(async () => {
        if (fontsLoaded) {
          await SplashScreen.hideAsync();
        }
      }, { operation: 'Hide splash screen', silent: true });
      
      // Non-critical error, can continue
    };

    hideSplash();
  }, [fontsLoaded]);

  // Initialize Google Drive service with error handling
  useEffect(() => {
    const initializeGoogleDrive = async () => {
      const result = await withErrorHandling(async () => {
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
      }, { operation: 'Google Drive initialization' });
      
      if (!result.success) {
        // Continue without Google Drive integration
        console.log("Continuing without Google Drive integration");
      }
    };

    initializeGoogleDrive();
  }, []);

  // Initialize notification service with error handling
  useEffect(() => {
    const initializeNotifications = async () => {
      const result = await withErrorHandling(async () => {
        const initialized = await notificationService.initialize();
        if (initialized) {
          console.log("Notification system initialized successfully");
        } else {
          console.log(
            "Notification system initialization failed, permissions may have been denied",
          );
        }
        return initialized;
      }, { operation: 'Notification initialization' });
      
      if (!result.success) {
        // Continue without notifications
        console.log("Continuing without notifications");
      }
    };
    
    initializeNotifications();

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
