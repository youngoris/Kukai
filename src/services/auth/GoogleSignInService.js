import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@env";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

// Storage keys
const STORAGE_KEYS = {
  AUTH_STATE: "google_auth_state",
};

class GoogleSignInService {
  constructor() {
    this.accessToken = null;
    this.user = null;
    this.expiresAt = null;
    this.isInitialized = false;
  }

  // Initialize service
  async initialize() {
    try {
      console.log("GoogleSignInService.initialize: Starting initialization");
      
      if (!this.isInitialized) {
        // Configure Google Sign-In
        console.log("Configuring Google Sign-In with:", {
          iosClientId: GOOGLE_IOS_CLIENT_ID ? GOOGLE_IOS_CLIENT_ID.substring(0, 15) + '...' : 'Not set',
          webClientId: GOOGLE_WEB_CLIENT_ID ? GOOGLE_WEB_CLIENT_ID.substring(0, 15) + '...' : 'Not set',
          androidClientId: GOOGLE_ANDROID_CLIENT_ID ? GOOGLE_ANDROID_CLIENT_ID.substring(0, 15) + '...' : 'Not set',
        });
        
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID, // Only needed for iOS
          offlineAccess: true, // Request refresh token to access Google API
          scopes: [
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
          ],
        });
        
        this.isInitialized = true;
      }
      
      const isSignedIn = await GoogleSignin.isSignedIn();
      
      if (isSignedIn) {
        try {
          await this.silentSignIn();
        } catch (error) {
          console.log("Silent sign in failed, token may be invalid", error.message || error);
          // Clear expired token
          this.accessToken = null;
          this.user = null;
          this.expiresAt = null;
        }
      }
      
      return isSignedIn;
    } catch (error) {
      console.log("Failed to initialize Google Sign-in service:", error.message || "Unknown error");
      return false;
    }
  }

  // Silent sign-in, try to refresh existing login state
  async silentSignIn() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      this.user = userInfo.user;
      return true;
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_REQUIRED) {
        console.log("Silent sign in failed, user needs to sign in again");
      } else if (error.code === statusCodes.NETWORK_ERROR) {
        console.log("Network error during silent sign in");
      }
      
      console.log("Silent sign in failed:", error.message || "Unknown error");
      return false;
    }
  }

  // Perform Google authentication
  async signIn() {
    try {
      console.log("Starting Google sign-in process");
      
      // Check Play Services (only needed for Android)
      if (Platform.OS === 'android') {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        } catch (error) {
          console.log("Play Services check failed:", error.message || "Unknown error");
          return false;
        }
      }
      
      // Try to sign in
      const userInfo = await GoogleSignin.signIn();
      console.log("Google sign in success");
      
      // Save user information
      this.user = userInfo.user;
      
      return {
        success: true,
        user: userInfo.user
      };
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("User cancelled the login flow");
        return { success: false, error: "cancelled" };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Sign in already in progress");
        return { success: false, error: "in_progress" };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log("Play services not available or outdated");
        return { success: false, error: "play_services_unavailable" };
      }
      
      console.log("Sign in error:", error.message || "Unknown error");
      return { 
        success: false, 
        error: "sign_in_failed",
        message: error.message
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      await GoogleSignin.signOut();
      this.user = null;
      this.accessToken = null;
      this.expiresAt = null;
      return true;
    } catch (error) {
      console.log("Sign out failed:", error.message || "Unknown error");
      return false;
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser ? currentUser.user : null;
    } catch (error) {
      console.log("Failed to get current user:", error.message || "Unknown error");
      return null;
    }
  }

  // Check if user is signed in
  async isSignedIn() {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      console.log("Failed to check sign in status:", error.message || "Unknown error");
      return false;
    }
  }

  // Get tokens (access token and ID token)
  async getTokens() {
    try {
      return await GoogleSignin.getTokens();
    } catch (error) {
      console.log("Failed to get tokens:", error.message || "Unknown error");
      return null;
    }
  }
}

// Create a singleton instance
const googleSignInService = new GoogleSignInService();
export default googleSignInService; 