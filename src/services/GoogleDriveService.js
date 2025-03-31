import storageService from "./storage/StorageService";
import googleSignInService from "./auth/GoogleSignInService";
import * as FileSystem from "expo-file-system";
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
import * as Application from "expo-application";
import { Platform } from "react-native";

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

// Print environment variables, for debugging
console.log("GoogleDriveService - Environment variable check:");
console.log("GOOGLE_IOS_CLIENT_ID:", GOOGLE_IOS_CLIENT_ID ? "Set" : "Not set");
console.log("GOOGLE_ANDROID_CLIENT_ID:", GOOGLE_ANDROID_CLIENT_ID ? "Set" : "Not set");
console.log("GOOGLE_WEB_CLIENT_ID:", GOOGLE_WEB_CLIENT_ID ? "Set" : "Not set");
console.log("Running in Expo Go:", isExpoGo ? "Yes" : "No");
console.log("Platform:", Platform.OS);

// Storage keys
const STORAGE_KEYS = {
  AUTH_STATE: "google_drive_auth_state",
  SYNC_STATE: "google_drive_sync_state",
  LAST_SYNC: "google_drive_last_sync",
  AUTO_SYNC: "google_drive_auto_sync",
};

// Backup folder name
const BACKUP_FOLDER_NAME = "KukaiAppBackups";

class GoogleDriveService {
  constructor() {
    this.accessToken = null;
    this.user = null;
    this.expiresAt = null;
    this.backupFolderId = null;
    this.isInitialized = false;
  }

  // Initialize service
  async initialize() {
    try {
      console.log("GoogleDriveService.initialize: Starting initialization");
      
      if (!this.isInitialized) {
        // Use GoogleSignInService to configure Google Sign-In
        await googleSignInService.initialize();
        
        // Configure additional scopes for Google Drive
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID,
          offlineAccess: true,
          scopes: [
            "https://www.googleapis.com/auth/drive.file",       // File permissions
            "https://www.googleapis.com/auth/drive.appdata",    // Application data
            "https://www.googleapis.com/auth/drive.metadata.readonly", // Metadata read-only permissions
            "https://www.googleapis.com/auth/drive.readonly",   // Read-only permissions (for listing files)
          ],
        });
        
        this.isInitialized = true;
      }
      
      await this.loadAuthState();
      
      // If token exists but expired, try silent sign-in to refresh token
      if (this.accessToken && this.isTokenExpired()) {
        try {
          await this.silentSignIn();
        } catch (error) {
          console.log("Silent sign in failed, token may be invalid", error.message || error);
          // Clear expired token
          this.accessToken = null;
          this.user = null;
          this.expiresAt = null;
          await this.saveAuthState();
        }
      }
      
      const isAuthenticated = !!this.accessToken && !this.isTokenExpired();
      console.log("GoogleDriveService.initialize: Authentication status:", isAuthenticated);
      return isAuthenticated;
    } catch (error) {
      // Log without full error object to avoid noisy logs
      console.log("Failed to initialize Google Drive service:", error.message || "Unknown error");
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
        this.user = authState.user;
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
        user: this.user,
        expiresAt: this.expiresAt,
      };
      await storageService.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
    } catch (error) {
      console.error("Failed to save auth state:", error);
    }
  }
  
  // Silent sign-in, try to refresh existing login state
  async silentSignIn() {
    try {
      await googleSignInService.silentSignIn();
      await this.getAccessToken();
      return true;
    } catch (error) {
      console.log("Silent sign in failed:", error.message || "Unknown error");
      return false;
    }
  }

  // Perform Google authentication
  async authenticate() {
    try {
      console.log("Starting authentication process");
      
      // Use GoogleSignInService for authentication
      const signInResult = await googleSignInService.signIn();
      
      if (!signInResult.success) {
        console.log("Google sign-in failed:", signInResult.error);
        return false;
      }
      
      this.user = signInResult.user;
      
      // Get access token
      await this.getAccessToken();
      
      // If still no access token, authentication is incomplete
      if (!this.accessToken) {
        console.log("Failed to obtain access token after sign in");
        return false;
      }
      
      // Ensure backup folder exists
      this.ensureBackupFolderExists().catch(err => {
        console.log("Note: Failed to ensure backup folder exists:", err.message);
      });
      
      return true;
    } catch (error) {
      console.log("Authentication failed:", error.message || "Unknown error");
      return false;
    }
  }
  
  // Get access token
  async getAccessToken() {
    try {
      const tokens = await googleSignInService.getTokens();
      
      if (!tokens) {
        console.log("Failed to get tokens");
        return null;
      }
      
      this.accessToken = tokens.accessToken;
      
      // Access tokens typically expire in 1 hour, setting to 50 minutes for safety
      this.expiresAt = Date.now() + (50 * 60 * 1000);
      
      await this.saveAuthState();
      return this.accessToken;
    } catch (error) {
      console.log("Failed to get access token:", error.message || "Unknown error");
      return null;
    }
  }

  // Sign out
  async signOut() {
    try {
      // Use GoogleSignInService to sign out
      await googleSignInService.signOut();
      
      // Clear local state
      this.accessToken = null;
      this.user = null;
      this.expiresAt = null;
      this.backupFolderId = null;
      
      // Remove authentication state from storage
      await storageService.removeItem(STORAGE_KEYS.AUTH_STATE);
      return true;
    } catch (error) {
      console.error("Sign out failed:", error);
      return false;
    }
  }
  
  // Get current user
  async getCurrentUser() {
    return googleSignInService.getCurrentUser();
  }
  
  // Ensure backup folder exists
  async ensureBackupFolderExists() {
    try {
      // If backup folder ID already exists, return it
      if (this.backupFolderId) {
        return this.backupFolderId;
      }
      
      // Load backup folder ID from storage
      try {
        const syncState = await storageService.getItem(STORAGE_KEYS.SYNC_STATE);
        if (syncState) {
          const parsedState = JSON.parse(syncState);
          if (parsedState.backupFolderId) {
            this.backupFolderId = parsedState.backupFolderId;
            return this.backupFolderId;
          }
        }
      } catch (e) {
        console.log("No saved backup folder found");
      }
      
      // Check token validity
      if (!this.accessToken || this.isTokenExpired()) {
        try {
          await this.getAccessToken();
          
          // If still no access token after trying to get one, return gracefully
          if (!this.accessToken) {
            console.log("Unable to get access token, user may not be signed in");
            return null;
          }
        } catch (e) {
          console.error("Failed to get access token for backup folder:", e);
          return null;
        }
      }
      
      // Search for existing backup folder
      const query = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      
      const data = await response.json();
      
      // If folder is found, use the first result
      if (data.files && data.files.length > 0) {
        this.backupFolderId = data.files[0].id;
        console.log(`Found existing backup folder with ID: ${this.backupFolderId}`);
      } else {
        // Otherwise create a new folder
        const createResponse = await fetch(
          'https://www.googleapis.com/drive/v3/files',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: BACKUP_FOLDER_NAME,
              mimeType: 'application/vnd.google-apps.folder',
            }),
          }
        );
        
        const folder = await createResponse.json();
        this.backupFolderId = folder.id;
        console.log(`Created new backup folder with ID: ${this.backupFolderId}`);
      }
      
      // Save backup folder ID to storage
      await this.saveSyncState();
      
      return this.backupFolderId;
    } catch (error) {
      console.error("Failed to ensure backup folder exists:", error);
      // Return null instead of throwing to prevent UI errors
      return null;
    }
  }
  
  // Save sync state to storage
  async saveSyncState() {
    try {
      const syncState = {
        backupFolderId: this.backupFolderId,
      };
      await storageService.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(syncState));
    } catch (error) {
      console.error("Failed to save sync state:", error);
    }
  }
  
  // Create backup
  async createBackup(backupData, filename = null) {
    try {
      console.log("Starting backup creation...");
      
      // Ensure logged in with backup folder
      if (!this.isAuthenticated()) {
        console.log("Not authenticated, attempting to authenticate...");
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return { success: false, message: "Authentication cancelled or failed" };
        }
      }
      
      console.log("Getting backup folder...");
      const folderId = await this.ensureBackupFolderExists();
      if (!folderId) {
        return { success: false, message: "Could not access or create backup folder" };
      }
      console.log("Backup folder ID:", folderId);
      
      // If filename not specified, generate one with timestamp
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const appId = Platform.OS === 'ios' 
          ? Application.applicationId || 'kukai-app' 
          : Application.applicationId || 'kukai-app';
        filename = `${appId}_backup_${timestamp}.json`;
      }
      
      console.log("Backup filename:", filename);
      
      // Create temporary file
      const tempFilePath = `${FileSystem.cacheDirectory}temp_backup.json`;
      const jsonString = JSON.stringify(backupData);
      console.log("Writing to temporary file...");
      await FileSystem.writeAsStringAsync(tempFilePath, jsonString);
      
      console.log("Preparing to upload file...");
      
      // Use simplified method to upload file content
      const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
      if (!fileInfo.exists) {
        throw new Error("Failed to create temporary file");
      }
      
      // Build metadata
      const metadata = {
        name: filename,
        parents: [folderId],
        mimeType: 'application/json',
      };
      
      // Upload file - using simplified method
      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      
      // 1. Create upload session
      console.log("Creating upload session...");
      const sessionResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });
      
      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error("Failed to create upload session:", errorText);
        return { success: false, message: "Failed to create upload session" };
      }
      
      // Get upload URL
      const uploadSessionUrl = sessionResponse.headers.get('Location');
      if (!uploadSessionUrl) {
        return { success: false, message: "Failed to get upload URL" };
      }
      
      console.log("Uploading data to session...");
      
      // 2. Upload file content
      const fileContent = await FileSystem.readAsStringAsync(tempFilePath);
      const uploadContentResponse = await fetch(uploadSessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': fileContent.length.toString(),
        },
        body: fileContent,
      });
      
      // Delete temporary file
      console.log("Deleting temporary file...");
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      
      if (!uploadContentResponse.ok) {
        const errorText = await uploadContentResponse.text();
        console.error("Failed to upload file content:", errorText);
        return { success: false, message: "Failed to upload file content" };
      }
      
      const responseData = await uploadContentResponse.json();
      console.log("Backup created successfully:", responseData);
      
      // Update last sync time
      await storageService.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      
      return { success: true, data: responseData };
    } catch (error) {
      console.error("Failed to create backup, detailed error:", error);
      // Return error object instead of throwing
      return { success: false, message: error.message || 'Unknown error' };
    }
  }
  
  // Get backup list
  async listBackups() {
    try {
      // Ensure logged in with backup folder
      if (!this.isAuthenticated()) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return { success: false, message: "Authentication cancelled or failed", files: [] };
        }
      }
      
      const folderId = await this.ensureBackupFolderExists();
      if (!folderId) {
        return { success: false, message: "Could not access backup folder", files: [] };
      }
      
      console.log("Getting backups from folder ID:", folderId);
      
      // Fix query format, strictly following Google Drive API documentation standards
      // Note: Single quotes must surround the folder ID, and the entire query doesn't need additional quotes
      // Reference: https://developers.google.com/drive/api/v3/reference/files/list
      
      // Build query and use URL parameters instead of directly encoding in the URL
      const params = new URLSearchParams({
        q: `parents='${folderId}' and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime,size)',
        orderBy: 'modifiedTime desc'
      });
      
      const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
      
      console.log("Query params:", params.toString());
      console.log("Sending request to:", url);
      
      // Try different query formats in case the current format doesn't work
      let response;
      let responseText;
      
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
        });
        
        responseText = await response.text();
        console.log("Raw API response:", responseText);
      } catch (fetchError) {
        console.error("Fetch error:", fetchError);
        
        // Try second query format
        console.log("Trying alternative query format...");
        
        const alternativeParams = new URLSearchParams({
          q: `'${folderId}' in parents`,
          fields: 'files(id,name,createdTime,modifiedTime,size)',
          orderBy: 'modifiedTime desc'
        });
        
        const alternativeUrl = `https://www.googleapis.com/drive/v3/files?${alternativeParams.toString()}`;
        console.log("Trying alternative URL:", alternativeUrl);
        
        try {
          response = await fetch(alternativeUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Accept': 'application/json'
            },
          });
          
          responseText = await response.text();
          console.log("Alternative API response:", responseText);
        } catch (altFetchError) {
          console.error("Alternative fetch also failed:", altFetchError);
          return { success: false, message: "Network error when retrieving backups", files: [] };
        }
      }
      
      // Parse JSON from the response text
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response JSON:", e);
        return { success: false, message: "Invalid response format from Google Drive API", files: [] };
      }
      
      if (!response.ok) {
        console.error("API error response:", data);
        return { success: false, message: "Google Drive API error", files: [] };
      }
      
      console.log("Backup list retrieved successfully, count:", data.files ? data.files.length : 0);
      if (data.files && data.files.length > 0) {
        console.log("First backup file:", data.files[0]);
      }
      
      return data.files || [];
    } catch (error) {
      console.error("Failed to list backups:", error);
      return { success: false, message: error.message || "Unknown error when listing backups", files: [] };
    }
  }
  
  // Download backup
  async downloadBackup(fileId) {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return { success: false, message: "Authentication cancelled or failed" };
        }
      }
      
      console.log("Downloading backup with ID:", fileId);
      
      // Download file
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: 'application/json'
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Download failed response:", errorText);
        return { success: false, message: "Failed to download backup file" };
      }
      
      // Get response text
      const responseText = await response.text();
      console.log("Downloaded backup data (first 100 chars):", responseText.substring(0, 100));
      
      // Try to parse as JSON
      try {
        const backupData = JSON.parse(responseText);
        return backupData;
      } catch (parseError) {
        console.error("Failed to parse backup data:", parseError);
        return { success: false, message: "Failed to parse backup data" };
      }
    } catch (error) {
      console.error("Failed to download backup:", error);
      return { success: false, message: error.message || "Unknown error" };
    }
  }
  
  // Delete backup
  async deleteBackup(fileId) {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return false;
        }
      }
      
      // Delete file
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      
      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.error("Delete file failed:", errorText);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Failed to delete backup:", error);
      return false;
    }
  }
  
  // Get last sync time
  async getLastSyncTime() {
    try {
      const lastSync = await storageService.getItem(STORAGE_KEYS.LAST_SYNC);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error("Failed to get last sync time:", error);
      return null;
    }
  }

  // Get auto sync settings
  async getAutoSyncSettings() {
    try {
      const autoSyncJson = await storageService.getItem(STORAGE_KEYS.AUTO_SYNC);
      if (autoSyncJson) {
        return JSON.parse(autoSyncJson);
      }
      // Default settings
      return {
        enabled: false,
        frequency: 'daily', // 'daily', 'weekly', 'monthly'
        wifiOnly: true,
        lastAutoSync: null,
      };
    } catch (error) {
      console.error("Failed to get auto sync settings:", error);
      // Return default settings
      return {
        enabled: false,
        frequency: 'daily',
        wifiOnly: true,
        lastAutoSync: null,
      };
    }
  }
  
  // Set auto sync (enhanced version, supports frequency parameter)
  async setAutoSync(enabled, frequency = 'daily') {
    try {
      console.log("Setting auto sync, params:", { enabled, frequency });
      
      // Get existing settings
      const settings = await this.getAutoSyncSettings();
      
      // Ensure settings is an object
      const updatedSettings = typeof settings === 'object' && settings !== null 
        ? { ...settings } 
        : {
            enabled: false,
            frequency: 'daily',
            wifiOnly: true,
            lastAutoSync: null
          };
      
      // Update settings
      updatedSettings.enabled = Boolean(enabled);
      if (frequency) {
        updatedSettings.frequency = frequency;
      }
      
      // If enabled, update last sync time (if empty)
      if (updatedSettings.enabled && !updatedSettings.lastAutoSync) {
        updatedSettings.lastAutoSync = new Date().toISOString();
      }
      
      console.log("Saving auto sync settings:", updatedSettings);
      
      // Save settings
      await storageService.setItem(STORAGE_KEYS.AUTO_SYNC, JSON.stringify(updatedSettings));
      return true;
    } catch (error) {
      console.error("Failed to set auto sync:", error);
      throw error;
    }
  }
  
  // Perform auto sync
  async performAutoSync(appData) {
    try {
      // Get auto sync settings
      const settings = await this.getAutoSyncSettings();
      
      // If auto sync is not enabled, return
      if (!settings.enabled) {
        return {
          success: false,
          message: "Auto sync is disabled",
        };
      }
      
      // If WiFi only and not on WiFi, return
      if (settings.wifiOnly) {
        // Need to check network connection type
        // This is pseudo-code, actual implementation depends on your network detection method
        // const isWifi = await NetworkInfo.isWifi();
        // if (!isWifi) {
        //   return {
        //     success: false,
        //     message: "Auto sync is set to WiFi only, but device is not connected to WiFi",
        //   };
        // }
      }
      
      // Create backup
      const result = await this.createBackup(appData);
      
      // Update last auto sync time
      settings.lastAutoSync = new Date().toISOString();
      await this.setAutoSync(settings);
      
      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error("Auto sync failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Check if auto sync should be performed
  async shouldPerformAutoSync() {
    try {
      // Get auto sync settings
      const settings = await this.getAutoSyncSettings();
      
      // If auto sync is not enabled, return false
      if (!settings.enabled) {
        return false;
      }
      
      // If no last sync record, sync is needed
      if (!settings.lastAutoSync) {
        return true;
      }
      
      const lastSync = new Date(settings.lastAutoSync);
      const now = new Date();
      
      // Determine if sync is needed based on frequency
      switch (settings.frequency) {
        case 'daily':
          // If last sync was more than 24 hours ago
          return now - lastSync > 24 * 60 * 60 * 1000;
        case 'weekly':
          // If last sync was more than 7 days ago
          return now - lastSync > 7 * 24 * 60 * 60 * 1000;
        case 'monthly':
          // If last sync was more than 30 days ago
          return now - lastSync > 30 * 24 * 60 * 60 * 1000;
        default:
          return false;
      }
    } catch (error) {
      console.error("Error checking auto sync:", error);
      return false;
    }
  }

  // Get backup list (compatible with CloudBackupSection.js call)
  async getBackups() {
    // Call existing listBackups method to get backup list
    const result = await this.listBackups();
    
    // Handle both formats: if result is array (old format) or object with files (new format)
    if (Array.isArray(result)) {
      return result;
    } else if (result && result.success === false) {
      console.log("Failed to get backups:", result.message);
      return [];
    } else if (result && result.files) {
      return result.files;
    }
    
    return [];
  }
  
  // Restore backup
  async restoreBackup(fileId) {
    try {
      console.log("Starting backup restore...");
      
      // Ensure logged in
      if (!this.isAuthenticated()) {
        console.log("Not authenticated, attempting to authenticate...");
        await this.authenticate();
      }
      
      // Download backup data
      console.log("Downloading backup data...");
      const backupData = await this.downloadBackup(fileId);
      
      if (!backupData) {
        throw new Error("Unable to get backup data");
      }
      
      console.log("Backup data downloaded successfully, preparing to restore...");
      console.log("Backup data structure:", Object.keys(backupData));
      
      // Actual data restoration logic
      let restoredItems = 0;
      
      // Process description and timestamp
      const description = backupData.description || "";
      const timestamp = backupData.timestamp || new Date().toISOString();
      
      // Check data structure and adapt to different formats
      let dataToRestore = backupData;
      
      // Check backup format
      if (backupData.data) {
        console.log("Found 'data' property in backup, using it for restoration");
        dataToRestore = backupData.data;
      }
      
      console.log("Data to restore structure:", Object.keys(dataToRestore));
      
      // Restore different datasets based on data type
      const possibleDataKeys = ['meditations', 'tasks', 'journal', 'settings'];
      
      for (const key of possibleDataKeys) {
        if (dataToRestore[key]) {
          console.log(`Restoring ${key} data`);
          try {
            // Ensure data is in valid JSON format
            const dataValue = typeof dataToRestore[key] === 'string' 
              ? JSON.parse(dataToRestore[key]) 
              : dataToRestore[key];
            
            await storageService.setItem(key, JSON.stringify(dataValue));
            console.log(`Successfully restored ${key} data`);
            restoredItems++;
          } catch (e) {
            console.error(`Error restoring ${key} data:`, e);
          }
        }
      }
      
      // Restore other possible data items
      const otherDataKeys = Object.keys(dataToRestore).filter(key => 
        !possibleDataKeys.includes(key) && 
        !['description', 'timestamp'].includes(key) &&
        typeof dataToRestore[key] !== 'function'
      );
      
      for (const key of otherDataKeys) {
        try {
          console.log(`Restoring other data: ${key}`);
          const dataValue = typeof dataToRestore[key] === 'string' 
            ? JSON.parse(dataToRestore[key]) 
            : dataToRestore[key];
          
          await storageService.setItem(key, JSON.stringify(dataValue));
          console.log(`Successfully restored ${key} data`);
          restoredItems++;
        } catch (e) {
          console.error(`Error restoring ${key} data:`, e);
        }
      }
      
      console.log("Backup restored successfully:", {
        description,
        timestamp,
        restoredItems
      });
      
      return {
        success: true,
        restoredItems,
        message: "Backup restored successfully"
      };
    } catch (error) {
      console.error("Failed to restore backup:", error);
      return {
        success: false,
        error: error.message || "Unknown error"
      };
    }
  }
  
  // Check and perform auto sync
  async checkAndPerformAutoSync() {
    try {
      console.log("Checking if auto sync is needed...");
      
      // Check if auto sync should be performed
      const shouldSync = await this.shouldPerformAutoSync();
      
      if (!shouldSync) {
        console.log("Auto sync not needed at this time");
        return false;
      }
      
      console.log("Auto sync needed, preparing data...");
      
      // Get app data for backup
      // In actual app, need to get data from app state or storage
      const appData = {
        timestamp: new Date().toISOString(),
        autoSync: true,
        // Add other data to backup
      };
      
      // Perform auto sync
      const result = await this.performAutoSync(appData);
      
      console.log("Auto sync result:", result);
      
      return result.success;
    } catch (error) {
      console.error("Failed to check or perform auto sync:", error);
      return false;
    }
  }

  // Get shared drives list
  async getSharedDrives() {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return [];
        }
      }
      
      console.log("Getting shared drives list...");
      
      // Build API parameters
      const params = new URLSearchParams({
        pageSize: '10'
      });
      
      const url = `https://www.googleapis.com/drive/v3/drives?${params.toString()}`;
      
      console.log("Sending shared drives request to:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        },
      });
      
      // Get complete response text for debugging
      const responseText = await response.text();
      console.log("Raw shared drives API response:", responseText);
      
      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse shared drives response:", e);
        return [];
      }
      
      if (!response.ok) {
        console.error("Shared drives API error:", data);
        return [];
      }
      
      console.log("Shared drives retrieved successfully:", data.drives ? data.drives.length : 0);
      
      return data.drives || [];
    } catch (error) {
      console.error("Failed to get shared drives:", error);
      // If it's a permission error, the user may not have access to shared drives, return empty array
      return [];
    }
  }

  // Get specific shared drive
  async getSharedDrive(driveId) {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        const authenticated = await this.authenticate();
        if (!authenticated) {
          return null;
        }
      }
      
      console.log("Getting shared drive with ID:", driveId);
      
      const url = `https://www.googleapis.com/drive/v3/drives/${driveId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Get shared drive failed:", errorText);
        return null;
      }
      
      const driveData = await response.json();
      return driveData;
    } catch (error) {
      console.error("Failed to get shared drive:", error);
      return null;
    }
  }

  // Check and fix environment configuration to ensure Google login works properly
  static async ensureProperSetup() {
    try {
      console.log("GoogleDriveService: Checking environment configuration...");
      
      // Check Info.plist configuration (iOS)
      if (Platform.OS === 'ios') {
        // Can't directly check Info.plist here, but can provide logs
        console.log("iOS configuration tip: Ensure Info.plist URL types contains the correct Scheme");
        
        // Check if environment variables are properly set
        if (GOOGLE_IOS_CLIENT_ID) {
          console.log("iOS Client ID configured:", GOOGLE_IOS_CLIENT_ID.substring(0, 15) + '...');
        } else {
          console.warn("Warning: iOS Client ID not configured!");
        }
      }
      
      // Check Android configuration
      if (Platform.OS === 'android') {
        if (GOOGLE_ANDROID_CLIENT_ID) {
          console.log("Android Client ID configured:", GOOGLE_ANDROID_CLIENT_ID.substring(0, 15) + '...');
        } else {
          console.warn("Warning: Android Client ID not configured!");
        }
      }
      
      // Check Web Client ID (universal)
      if (GOOGLE_WEB_CLIENT_ID) {
        console.log("Web Client ID configured:", GOOGLE_WEB_CLIENT_ID.substring(0, 15) + '...');
      } else {
        console.warn("Warning: Web Client ID not configured!");
      }
      
      return true;
    } catch (error) {
      console.error("Error checking Google environment configuration:", error);
      return false;
    }
  }

}

// create a singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService; 