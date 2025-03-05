import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
// import { zip, unzip } from 'react-native-zip-archive';

// Ensure WebBrowser can complete the authentication session
WebBrowser.maybeCompleteAuthSession();

// Google API Configuration
const GOOGLE_API_CONFIG = {
  // Replace with actual client IDs
  expoClientId: 'YOUR_EXPO_CLIENT_ID',
  iosClientId: 'YOUR_IOS_CLIENT_ID',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  webClientId: 'YOUR_WEB_CLIENT_ID',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata'
  ]
};

// Storage keys
const STORAGE_KEYS = {
  AUTH_STATE: 'google_drive_auth_state',
  SYNC_STATE: 'google_drive_sync_state',
  LAST_SYNC: 'google_drive_last_sync'
};

// Backup folder name
const BACKUP_FOLDER_NAME = 'KukaiAppBackups';

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
      // Try to load authentication state from storage
      await this.loadAuthState();
      
      // If token is expired, try to refresh it
      if (this.accessToken && this.isTokenExpired()) {
        await this.refreshAccessToken();
      }
      
      return !!this.accessToken;
    } catch (error) {
      console.error('Failed to initialize Google Drive service:', error);
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
      const authStateJson = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_STATE);
      if (authStateJson) {
        const authState = JSON.parse(authStateJson);
        this.accessToken = authState.accessToken;
        this.refreshToken = authState.refreshToken;
        this.expiresAt = authState.expiresAt;
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
    }
  }

  // Save authentication state to storage
  async saveAuthState() {
    try {
      const authState = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt
      };
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_STATE, JSON.stringify(authState));
    } catch (error) {
      console.error('Failed to save auth state:', error);
    }
  }

  // Perform Google authentication
  async authenticate() {
    try {
      // Generate random state to prevent CSRF attacks
      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString()
      );

      // Create authentication request
      const authRequest = new AuthSession.AuthRequest({
        clientId: GOOGLE_API_CONFIG.webClientId,
        scopes: GOOGLE_API_CONFIG.scopes,
        redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
        state
      });

      // Start authentication flow
      const result = await authRequest.promptAsync({
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        returnUrl: AuthSession.makeRedirectUri({ useProxy: true })
      });

      if (result.type === 'success') {
        // Set authentication information
        this.accessToken = result.params.access_token;
        this.refreshToken = result.params.refresh_token;
        
        // Calculate expiration time (usually 1 hour)
        const expiresIn = result.params.expires_in ? parseInt(result.params.expires_in) : 3600;
        this.expiresAt = Date.now() + expiresIn * 1000;
        
        // Save authentication state
        await this.saveAuthState();
        
        // Ensure backup folder exists
        await this.ensureBackupFolderExists();
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_API_CONFIG.webClientId,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        this.accessToken = tokenData.access_token;
        
        // Calculate new expiration time
        const expiresIn = tokenData.expires_in ? parseInt(tokenData.expires_in) : 3600;
        this.expiresAt = Date.now() + expiresIn * 1000;
        
        // Save updated authentication state
        await this.saveAuthState();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  // Sign out
  async signOut() {
    try {
      // Clear authentication state
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      this.backupFolderId = null;
      
      // Remove authentication state from storage
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
      
      return true;
    } catch (error) {
      console.error('Sign out failed:', error);
      return false;
    }
  }

  // Ensure backup folder exists
  async ensureBackupFolderExists() {
    try {
      // First check if folder ID is already cached
      if (this.backupFolderId) {
        // Verify folder still exists
        const folderExists = await this.checkFolderExists(this.backupFolderId);
        if (folderExists) {
          return this.backupFolderId;
        }
      }

      // Search if backup folder already exists
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const searchData = await searchResponse.json();

      // If folder found, use the first one
      if (searchData.files && searchData.files.length > 0) {
        this.backupFolderId = searchData.files[0].id;
        return this.backupFolderId;
      }

      // If not found, create new folder
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: BACKUP_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });

      const folderData = await createResponse.json();
      this.backupFolderId = folderData.id;
      
      return this.backupFolderId;
    } catch (error) {
      console.error('Failed to ensure backup folder exists:', error);
      throw error;
    }
  }

  // Check if folder exists
  async checkFolderExists(folderId) {
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Create backup and upload to Google Drive
  async createBackup(options = {}) {
    try {
      if (!this.isAuthenticated()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Not authenticated with Google Drive');
        }
      }

      // Ensure backup folder exists
      const folderId = await this.ensureBackupFolderExists();

      // Create local backup file
      const backupData = await this.generateBackupData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = options.name || `kukai_backup_${timestamp}`;
      const backupFileName = `${backupName}.json`;
      const backupFilePath = `${FileSystem.cacheDirectory}${backupFileName}`;

      // Write backup data to temporary file
      await FileSystem.writeAsStringAsync(backupFilePath, JSON.stringify(backupData));

      // Prepare metadata
      const metadata = {
        name: backupFileName,
        mimeType: 'application/json',
        parents: [folderId],
        description: options.description || `Kukai app backup created on ${new Date().toLocaleString()}`
      };

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(backupFilePath);

      // Create multipart request
      const boundary = 'kukai_backup_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      let requestBody = '';
      requestBody += delimiter;
      requestBody += 'Content-Type: application/json\r\n\r\n';
      requestBody += JSON.stringify(metadata);
      requestBody += delimiter;
      requestBody += 'Content-Type: application/json\r\n\r\n';
      requestBody += fileContent;
      requestBody += closeDelimiter;

      // Upload file to Google Drive
      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: requestBody,
        }
      );

      // Clean up temporary file
      await FileSystem.deleteAsync(backupFilePath, { idempotent: true });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);
      }

      const uploadResult = await uploadResponse.json();

      // Update last sync time
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      return {
        success: true,
        fileId: uploadResult.id,
        fileName: uploadResult.name,
        backupName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate backup data
  async generateBackupData() {
    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Exclude keys that don't need to be backed up
      const keysToBackup = allKeys.filter(key => 
        !key.startsWith('google_drive_') && 
        !key.startsWith('expo.') &&
        key !== 'backup_registry'
      );
      
      // Get all data
      const keyValuePairs = await AsyncStorage.multiGet(keysToBackup);
      
      // Create backup object
      const backupData = {
        version: '1.0',
        appVersion: '1.0.0', // Replace with actual version
        createdAt: new Date().toISOString(),
        data: {}
      };
      
      // Add data to backup object
      for (const [key, value] of keyValuePairs) {
        if (value) {
          try {
            // Try to parse JSON value
            backupData.data[key] = JSON.parse(value);
          } catch (e) {
            // If not JSON, save as string
            backupData.data[key] = value;
          }
        }
      }
      
      return backupData;
    } catch (error) {
      console.error('Failed to generate backup data:', error);
      throw error;
    }
  }

  // Get all backups
  async getBackups() {
    try {
      if (!this.isAuthenticated()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Not authenticated with Google Drive');
        }
      }

      // Ensure backup folder exists
      const folderId = await this.ensureBackupFolderExists();

      // Query all files in backup folder
      const query = `'${folderId}' in parents and trashed=false`;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,description,size)&orderBy=createdTime desc`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get backups: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      
      // Format backup list
      return data.files.map(file => ({
        id: file.id,
        name: file.name.replace('.json', ''),
        createdAt: file.createdTime,
        description: file.description || '',
        size: file.size ? parseInt(file.size) : 0
      }));
    } catch (error) {
      console.error('Failed to get backups:', error);
      return [];
    }
  }

  // Download and restore backup from Google Drive
  async restoreBackup(fileId) {
    try {
      if (!this.isAuthenticated()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Not authenticated with Google Drive');
        }
      }

      // Download backup file
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to download backup: ${errorData}`);
      }

      // Parse backup data
      const backupData = await response.json();
      
      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup data format');
      }

      // Restore data to AsyncStorage
      const entries = Object.entries(backupData.data);
      const restoreData = entries.map(([key, value]) => {
        // Convert objects to strings
        const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
        return [key, valueToStore];
      });

      // Set data in batch
      if (restoreData.length > 0) {
        await AsyncStorage.multiSet(restoreData);
      }

      // Update last sync time
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      return {
        success: true,
        restoredItems: restoreData.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete backup
  async deleteBackup(fileId) {
    try {
      if (!this.isAuthenticated()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          throw new Error('Not authenticated with Google Drive');
        }
      }

      // Delete file
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Delete backup failed:', error);
      return false;
    }
  }

  // Get last sync time
  async getLastSyncTime() {
    try {
      const lastSync = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return lastSync ? new Date(lastSync) : null;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  // Set auto sync
  async setAutoSync(enabled, frequency = 'daily') {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify({
        enabled,
        frequency,
        lastChecked: new Date().toISOString()
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to set auto sync:', error);
      return false;
    }
  }

  // Get auto sync settings
  async getAutoSyncSettings() {
    try {
      const syncStateJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_STATE);
      if (syncStateJson) {
        return JSON.parse(syncStateJson);
      }
      
      // Default settings
      return {
        enabled: false,
        frequency: 'daily',
        lastChecked: null
      };
    } catch (error) {
      console.error('Failed to get auto sync settings:', error);
      return {
        enabled: false,
        frequency: 'daily',
        lastChecked: null
      };
    }
  }

  // Check if auto sync is needed
  async checkAndPerformAutoSync() {
    try {
      // Get auto sync settings
      const syncSettings = await this.getAutoSyncSettings();
      
      if (!syncSettings.enabled) {
        return false; // Auto sync not enabled
      }
      
      // Check if authenticated
      if (!this.isAuthenticated()) {
        const refreshed = await this.refreshAccessToken();
        if (!refreshed) {
          return false; // Not authenticated
        }
      }
      
      // Check last check time
      const lastChecked = syncSettings.lastChecked ? new Date(syncSettings.lastChecked) : null;
      const now = new Date();
      
      if (!lastChecked) {
        // Never checked before, execute immediately
        await this.createBackup({ description: 'Auto backup' });
        
        // Update last check time
        syncSettings.lastChecked = now.toISOString();
        await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(syncSettings));
        
        return true;
      }
      
      // Check if sync is needed based on frequency
      let shouldSync = false;
      
      switch (syncSettings.frequency) {
        case 'daily':
          shouldSync = (now - lastChecked) > 24 * 60 * 60 * 1000;
          break;
        case 'weekly':
          shouldSync = (now - lastChecked) > 7 * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          shouldSync = (now - lastChecked) > 30 * 24 * 60 * 60 * 1000;
          break;
      }
      
      if (shouldSync) {
        await this.createBackup({ description: `Auto backup (${syncSettings.frequency})` });
        
        // Update last check time
        syncSettings.lastChecked = now.toISOString();
        await AsyncStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(syncSettings));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check auto sync:', error);
      return false;
    }
  }
}

// Create singleton instance
const googleDriveService = new GoogleDriveService();

export default googleDriveService; 