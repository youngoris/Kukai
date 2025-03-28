import storageService from "./storage/StorageService";
import * as FileSystem from "expo-file-system";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@env";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { Platform } from "react-native";

// Ensure WebBrowser can complete the authentication session
WebBrowser.maybeCompleteAuthSession();

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

// Print environment variables, for debugging
console.log("GoogleDriveService - Environment variable check:");
console.log("GOOGLE_IOS_CLIENT_ID:", GOOGLE_IOS_CLIENT_ID ? "Set" : "Not set");
console.log("GOOGLE_ANDROID_CLIENT_ID:", GOOGLE_ANDROID_CLIENT_ID ? "Set" : "Not set");
console.log("GOOGLE_WEB_CLIENT_ID:", GOOGLE_WEB_CLIENT_ID ? "Set" : "Not set");
console.log("Running in Expo Go:", isExpoGo ? "Yes" : "No");
console.log("Platform:", Platform.OS);

// Google API Configuration
const GOOGLE_API_CONFIG = {
  // Use environment variables for client IDs
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
  ],
};

// Storage keys
const STORAGE_KEYS = {
  AUTH_STATE: "google_drive_auth_state",
  SYNC_STATE: "google_drive_sync_state",
  LAST_SYNC: "google_drive_last_sync",
};

// Backup folder name
const BACKUP_FOLDER_NAME = "KukaiAppBackups";

// Get the redirect URI
const getRedirectUri = () => {
  if (isExpoGo) {
    return AuthSession.makeRedirectUri({
      useProxy: true,
      scheme: "kukai"
    });
  }
  
  // For standalone apps
  const scheme = "com.andre.kukai";
  if (Platform.OS === 'ios') {
    return AuthSession.makeRedirectUri({
      scheme,
      path: "oauth2redirect"
    });
  } else {
    return AuthSession.makeRedirectUri({
      scheme,
      path: "oauth2redirect"
    });
  }
};

class GoogleDriveService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.backupFolderId = null;
  }

  // Initialize service
  async initialize() {
    try {
      console.log("GoogleDriveService.initialize: Starting initialization");
      await this.loadAuthState();
      
      if (this.accessToken && this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const isAuthenticated = !!this.accessToken;
      console.log("GoogleDriveService.initialize: Authentication status:", isAuthenticated);
      return isAuthenticated;
    } catch (error) {
      console.error("Failed to initialize Google Drive service:", error);
      return false;
    }
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.accessToken && !this.isTokenExpired();
  }

  // Check if token is expired
  isTokenExpired() {
    return this.expiresAt ? Date.now() >= this.expiresAt : true;
  }

  // Load authentication state from storage
  async loadAuthState() {
    try {
      const authStateJson = await storageService.getItem(STORAGE_KEYS.AUTH_STATE);
      if (authStateJson) {
        const authState = JSON.parse(authStateJson);
        this.accessToken = authState.accessToken;
        this.refreshToken = authState.refreshToken;
        this.expiresAt = authState.expiresAt;
      }
    } catch (error) {
      console.error("Failed to load auth state:", error);
    }
  }

  // Save authentication state to storage
  async saveAuthState() {
    try {
      const authState = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
      };
      await storageService.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
    } catch (error) {
      console.error("Failed to save auth state:", error);
    }
  }

  // Perform Google authentication
  async authenticate() {
    try {
      console.log("Starting authentication process");

      // Get platform-specific client ID
      const clientId = Platform.select({
        ios: GOOGLE_API_CONFIG.iosClientId,
        android: GOOGLE_ANDROID_CLIENT_ID,
        default: GOOGLE_WEB_CLIENT_ID,
      });

      if (!clientId) {
        throw new Error(`Missing client ID for platform: ${Platform.OS}`);
      }

      console.log("Using client ID type:", Platform.OS);
      console.log("Client ID:", clientId.substring(0, 10) + "...");

      // Get the appropriate redirect URI
      const redirectUri = getRedirectUri();
      console.log("Using redirect URI:", redirectUri);

      // Create discovery document
      const discovery = {
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
      };

      // Create authentication request with platform specific config
      const authRequest = new AuthSession.AuthRequest({
        clientId,
        scopes: GOOGLE_API_CONFIG.scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true, // Enable PKCE for both platforms
        extraParams: {
          access_type: "offline",
          prompt: "consent",
        }
      });

      console.log("Starting authentication flow");
      
      // Start authentication flow with increased timeout
      const result = await Promise.race([
        authRequest.promptAsync(discovery),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Authentication timeout")), 60000) // Increase timeout to 60 seconds
        ),
      ]);

      console.log("Authentication result:", JSON.stringify(result, null, 2));

      if (result.type === "success" && result.params) {
        // Exchange authorization code for tokens
        const tokenResult = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code: result.params.code,
            client_id: clientId,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: authRequest.codeVerifier || "",
          }).toString(),
        });

        const tokenData = await tokenResult.json();
        console.log("Token exchange result:", tokenData.access_token ? "Success" : "Failed");

        if (tokenData.access_token) {
          this.accessToken = tokenData.access_token;
          this.refreshToken = tokenData.refresh_token;
          this.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;

          await this.saveAuthState();
          await this.ensureBackupFolderExists();
          return true;
        } else {
          console.error("Token exchange failed:", tokenData);
          throw new Error(tokenData.error || "Failed to exchange authorization code for tokens");
        }
      } else if (result.type === "error") {
        console.error("Authentication error:", result.error);
        throw new Error(result.error || "Authentication failed");
      } else if (result.type === "dismiss") {
        console.log("User cancelled authentication");
        throw new Error("Authentication cancelled by user");
      }

      return false;
    } catch (error) {
      console.error("Authentication failed:", error);
      throw error;
    }
  }

  // Rest of the existing methods...
  async refreshAccessToken() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: GOOGLE_API_CONFIG.webClientId,
          refresh_token: this.refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        this.accessToken = tokenData.access_token;
        this.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
        await this.saveAuthState();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return false;
    }
  }

  async signOut() {
    try {
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      this.backupFolderId = null;
      await storageService.removeItem(STORAGE_KEYS.AUTH_STATE);
      return true;
    } catch (error) {
      console.error("Sign out failed:", error);
      return false;
    }
  }
}

// Create singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService; 