import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@env";

/**
 * Initialize Google Sign-in properly, especially for iOS.
 * Call this in your app's entry point before using Google Sign-in.
 */
export const initializeGoogleSignIn = () => {
  try {
    console.log('Initializing Google Sign-in...');
    
    // Ensure client IDs are properly set
    const clientIds = {
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    };
    
    console.log('Google Sign-in client IDs:', {
      ios: clientIds.iosClientId ? clientIds.iosClientId.substring(0, 10) + '...' : 'Not set',
      web: clientIds.webClientId ? clientIds.webClientId.substring(0, 10) + '...' : 'Not set',
      android: clientIds.androidClientId ? clientIds.androidClientId.substring(0, 10) + '...' : 'Not set',
    });
    
    // Format iOS client ID if needed
    if (Platform.OS === 'ios' && clientIds.iosClientId) {
      const formattedIosClientId = clientIds.iosClientId.includes('.apps.googleusercontent.com')
        ? clientIds.iosClientId
        : `${clientIds.iosClientId}.apps.googleusercontent.com`;
      
      clientIds.iosClientId = formattedIosClientId;
      console.log('Using formatted iOS client ID:', formattedIosClientId.substring(0, 10) + '...');
    }
    
    // Configure Google Sign-in
    GoogleSignin.configure({
      ...clientIds,
      offlineAccess: true,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });
    
    console.log('Google Sign-in initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Sign-in:', error);
    return false;
  }
};

// Make sure this module is imported in your App.js or index.js file 