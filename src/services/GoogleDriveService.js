import storageService from "./storage/StorageService";
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
        // Configure Google Sign-In
        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID,
          iosClientId: GOOGLE_IOS_CLIENT_ID, // Only needed for iOS
          offlineAccess: true, // Request refresh token to access Google API
          scopes: [
            "https://www.googleapis.com/auth/drive.file",       // 文件权限
            "https://www.googleapis.com/auth/drive.appdata",    // 应用数据
            "https://www.googleapis.com/auth/drive.metadata.readonly", // 元数据只读权限
            "https://www.googleapis.com/auth/drive.readonly",   // 只读权限 (用于列出文件)
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
          console.log("Silent sign in failed, token may be invalid", error);
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

  // Check Google Play Services
  async hasPlayServices() {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      return true;
    } catch (error) {
      console.error("Play Services check failed:", error);
      
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.error("Play Services not available or outdated");
      }
      
      throw error;
    }
  }
  
  // Silent sign-in, try to refresh existing login state
  async silentSignIn() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      this.handleSuccessfulAuth(userInfo);
      return true;
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_REQUIRED) {
        // User needs to sign in again
        console.log("Silent sign in failed, user needs to sign in again");
      }
      throw error;
    }
  }

  // Perform Google authentication
  async authenticate() {
    try {
      console.log("Starting authentication process");
      
      // Check Play Services (only needed for Android)
      if (Platform.OS === 'android') {
        await this.hasPlayServices();
      }
      
      // Try to sign in
      const userInfo = await GoogleSignin.signIn();
      console.log("Google sign in success");
      
      // If Google API access is needed, get access token
      if (Platform.OS !== 'web') {
        await this.getAccessToken();
      }
      
      this.handleSuccessfulAuth(userInfo);
      return true;
    } catch (error) {
      console.error("Authentication failed:", error);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled login
        console.log("User cancelled the login flow");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Sign in already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Android: play services not available or outdated
        console.log("Play services not available or outdated");
      }
      
      throw error;
    }
  }
  
  // Get access token
  async getAccessToken() {
    try {
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      
      // Access tokens typically last for 1 hour, but set to 50 minutes to be safe
      this.expiresAt = Date.now() + (50 * 60 * 1000);
      
      await this.saveAuthState();
      return this.accessToken;
    } catch (error) {
      console.error("Failed to get access token:", error);
      throw error;
    }
  }
  
  // Handle successful authentication result
  handleSuccessfulAuth(userInfo) {
    // Save user information
    this.user = userInfo.user;
    
    // Access token and expiry time are handled in getAccessToken
    // Save authentication state here
    this.saveAuthState();
    
    // Ensure backup folder exists
    this.ensureBackupFolderExists();
  }

  // Sign out
  async signOut() {
    try {
      // Call Google Sign-In sign out
      await GoogleSignin.signOut();
      
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
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
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
        await this.getAccessToken();
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
      throw error;
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
        await this.authenticate();
      }
      
      console.log("Getting backup folder...");
      const folderId = await this.ensureBackupFolderExists();
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
        throw new Error(`Failed to create upload session: ${errorText}`);
      }
      
      // Get upload URL
      const uploadSessionUrl = sessionResponse.headers.get('Location');
      if (!uploadSessionUrl) {
        throw new Error("Failed to get upload URL");
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
        throw new Error(`Failed to upload file content: ${errorText}`);
      }
      
      const responseData = await uploadContentResponse.json();
      console.log("Backup created successfully:", responseData);
      
      // Update last sync time
      await storageService.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      
      return responseData;
    } catch (error) {
      console.error("Failed to create backup, detailed error:", error);
      // Ensure meaningful error message is thrown
      throw new Error(`Failed to create backup: ${error.message || 'Unknown error'}`);
    }
  }
  
  // Get backup list
  async listBackups() {
    try {
      // Ensure logged in with backup folder
      if (!this.isAuthenticated()) {
        await this.authenticate();
      }
      
      const folderId = await this.ensureBackupFolderExists();
      
      console.log("Getting backups from folder ID:", folderId);
      
      // 修复查询格式，严格按照Google Drive API文档标准
      // 注意：单引号需要包围folder ID，整个查询不需要额外引号
      // 参考: https://developers.google.com/drive/api/v3/reference/files/list
      
      // 构建查询并使用URL参数而非直接编码在URL中
      const params = new URLSearchParams({
        q: `parents='${folderId}' and trashed=false`,
        fields: 'files(id,name,createdTime,modifiedTime,size)',
        orderBy: 'modifiedTime desc'
      });
      
      const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
      
      console.log("Query params:", params.toString());
      console.log("Sending request to:", url);
      
      // 尝试不同的查询格式以防当前格式不起作用
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
        
        // 尝试第二种查询格式
        console.log("Trying alternative query format...");
        
        const alternativeParams = new URLSearchParams({
          q: `'${folderId}' in parents`,
          fields: 'files(id,name,createdTime,modifiedTime,size)',
          orderBy: 'modifiedTime desc'
        });
        
        const alternativeUrl = `https://www.googleapis.com/drive/v3/files?${alternativeParams.toString()}`;
        console.log("Trying alternative URL:", alternativeUrl);
        
        response = await fetch(alternativeUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
        });
        
        responseText = await response.text();
        console.log("Alternative API response:", responseText);
      }
      
      // Parse JSON from the response text
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response JSON:", e);
        throw new Error("Invalid response format from Google Drive API");
      }
      
      if (!response.ok) {
        console.error("API error response:", data);
        throw new Error(`List backups failed: ${JSON.stringify(data)}`);
      }
      
      console.log("Backup list retrieved successfully, count:", data.files ? data.files.length : 0);
      if (data.files && data.files.length > 0) {
        console.log("First backup file:", data.files[0]);
      }
      
      return data.files || [];
    } catch (error) {
      console.error("Failed to list backups:", error);
      throw error;
    }
  }
  
  // Download backup
  async downloadBackup(fileId) {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        await this.authenticate();
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
        throw new Error(`Download failed: ${errorText}`);
      }
      
      // 获取响应文本
      const responseText = await response.text();
      console.log("Downloaded backup data (first 100 chars):", responseText.substring(0, 100));
      
      // 尝试解析为JSON
      try {
        const backupData = JSON.parse(responseText);
        return backupData;
      } catch (parseError) {
        console.error("Failed to parse backup data:", parseError);
        throw new Error(`Failed to parse backup data: ${parseError.message}`);
      }
    } catch (error) {
      console.error("Failed to download backup:", error);
      throw error;
    }
  }
  
  // Delete backup
  async deleteBackup(fileId) {
    try {
      // Ensure logged in
      if (!this.isAuthenticated()) {
        await this.authenticate();
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
        throw new Error(`Delete failed: ${errorText}`);
      }
      
      return true;
    } catch (error) {
      console.error("Failed to delete backup:", error);
      throw error;
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
    return this.listBackups();
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
      
      // 实际恢复数据逻辑
      let restoredItems = 0;
      
      // 处理描述和时间戳
      const description = backupData.description || "";
      const timestamp = backupData.timestamp || new Date().toISOString();
      
      // 检查数据结构并适应不同格式
      let dataToRestore = backupData;
      
      // 检查备份格式
      if (backupData.data) {
        console.log("Found 'data' property in backup, using it for restoration");
        dataToRestore = backupData.data;
      }
      
      console.log("Data to restore structure:", Object.keys(dataToRestore));
      
      // 根据数据类型恢复不同的数据集
      const possibleDataKeys = ['meditations', 'tasks', 'journal', 'settings'];
      
      for (const key of possibleDataKeys) {
        if (dataToRestore[key]) {
          console.log(`Restoring ${key} data`);
          try {
            // 确保数据是有效的JSON格式
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
      
      // 恢复其他可能存在的数据项
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
      // 确保已登录
      if (!this.isAuthenticated()) {
        await this.authenticate();
      }
      
      console.log("Getting shared drives list...");
      
      // 构建API参数
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
      
      // 获取完整响应文本进行调试
      const responseText = await response.text();
      console.log("Raw shared drives API response:", responseText);
      
      // 解析JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse shared drives response:", e);
        throw new Error("Invalid response format from Google Drive API");
      }
      
      if (!response.ok) {
        console.error("Shared drives API error:", data);
        throw new Error(`Get shared drives failed: ${JSON.stringify(data)}`);
      }
      
      console.log("Shared drives retrieved successfully:", data.drives ? data.drives.length : 0);
      
      return data.drives || [];
    } catch (error) {
      console.error("Failed to get shared drives:", error);
      // 如果是权限错误，可能用户没有共享驱动器访问权限，返回空数组
      if (error.message && error.message.includes("403")) {
        console.log("User may not have access to shared drives (403 error)");
        return [];
      }
      throw error;
    }
  }

  // Get specific shared drive
  async getSharedDrive(driveId) {
    try {
      // 确保已登录
      if (!this.isAuthenticated()) {
        await this.authenticate();
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
        throw new Error(`Get shared drive failed: ${errorText}`);
      }
      
      const driveData = await response.json();
      return driveData;
    } catch (error) {
      console.error("Failed to get shared drive:", error);
      throw error;
    }
  }

}

// create a singleton instance
const googleDriveService = new GoogleDriveService();
export default googleDriveService; 