/**
 * ExpoGoCompatibility.js
 * 
 * This utility provides helpers to make the app work better in Expo Go environment,
 * especially for features that may not be fully compatible with Expo Go like
 * Google Sign-In and other native modules.
 */

import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

// 预先检测Expo Go环境，避免不必要的导入尝试
const isExpoGoEnv = Constants.appOwnership === 'expo' || 
                    (Constants.manifest && !!Constants.manifest.extra?.expoGo);

// 只在非Expo Go环境中尝试导入GoogleSignin
let GoogleSignin = null;
if (!isExpoGoEnv) {
  try {
    const GoogleSignInModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = GoogleSignInModule.GoogleSignin;
  } catch (e) {
    console.log('[ExpoGoCompatibility] Failed to import GoogleSignin:', e.message);
  }
}

/**
 * 模拟的GoogleSignin实现，在Expo Go环境中使用
 */
const MockGoogleSignin = {
  configure: (config) => {
    console.log('[ExpoGoCompatibility] Mock GoogleSignin.configure called with config:', config);
  },
  signIn: async () => {
    console.log('[ExpoGoCompatibility] Mock GoogleSignin.signIn called');
    return {
      user: {
        id: 'mock-user-id',
        name: 'Expo Go User',
        email: 'mock-user@expogoapp.com',
        photo: null
      },
      idToken: 'mock-id-token'
    };
  }
};

/**
 * Enhanced detection for Expo Go environment using multiple methods
 * @returns {Object} Object containing isExpoGo flag and the detection method used
 */
export const detectExpoGo = () => {
  // Primary detection method - Constants.appOwnership
  const isPrimaryExpoGo = Constants.appOwnership === 'expo';
  
  // Secondary detection - Check manifest for expo-specific fields
  const hasExpoManifest = !!Constants.manifest?.extra?.expoGo;
  
  // Tertiary detection - Check application name
  const appName = Application.applicationName || '';
  const isExpoAppName = appName.includes('Expo Go') || appName.includes('Expo Client');
  
  // Quaternary detection - Check if expo-dev-client is enabled
  const isExpoDevClient = Constants.executionEnvironment === 'storeClient';
  
  // Result with detection method for debugging
  return {
    isExpoGo: isPrimaryExpoGo || hasExpoManifest || isExpoAppName || isExpoDevClient,
    detectionMethod: isPrimaryExpoGo 
      ? 'appOwnership' 
      : hasExpoManifest 
        ? 'manifest' 
        : isExpoAppName 
          ? 'appName' 
          : isExpoDevClient
            ? 'devClient'
            : 'none'
  };
};

/**
 * Configure Google Sign-In in a way that's compatible with both Expo Go and regular builds
 * @param {Object} config Configuration object for Google Sign-In
 * @returns {Object} Result containing success status and environment info
 */
export const configureGoogleSignIn = (config) => {
  const { isExpoGo, detectionMethod } = detectExpoGo();
  
  try {
    if (isExpoGo) {
      // In Expo Go, we use mock implementation
      console.log('[ExpoGoCompatibility] Using mock GoogleSignin.configure in Expo Go');
      MockGoogleSignin.configure(config);
      
      return {
        success: true,
        isExpoGo,
        detectionMethod,
        message: 'Configured with Expo Go mock mode'
      };
    }
    
    // Check if GoogleSignin was successfully imported
    if (!GoogleSignin) {
      console.log('[ExpoGoCompatibility] GoogleSignin not available, using mock');
      MockGoogleSignin.configure(config);
      
      return {
        success: true,
        isExpoGo,
        detectionMethod,
        message: 'Configured with mock (GoogleSignin not available)'
      };
    }
    
    // Normal configuration for regular builds
    GoogleSignin.configure(config);
    
    return {
      success: true,
      isExpoGo,
      detectionMethod,
      message: 'Configured normally'
    };
  } catch (error) {
    console.error('[ExpoGoCompatibility] Error configuring Google Sign-In:', error);
    
    return {
      success: false,
      isExpoGo,
      detectionMethod,
      error: error.message || 'Unknown error',
      message: 'Failed to configure Google Sign-In'
    };
  }
};

/**
 * Safe wrapper for Google Sign-In that handles Expo Go environment gracefully
 * @returns {Promise<Object>} Promise that resolves to authentication result
 */
export const safeGoogleSignIn = async () => {
  const { isExpoGo } = detectExpoGo();
  
  try {
    if (isExpoGo || !GoogleSignin) {
      console.log('[ExpoGoCompatibility] Using mock sign-in for Expo Go');
      
      // Return mock data instead of attempting actual sign-in in Expo Go
      return {
        success: true,
        isMock: true,
        user: {
          id: 'mock-user-id',
          name: 'Expo Go User',
          email: 'mock-user@expogoapp.com',
          photo: null
        },
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        serverAuthCode: 'mock-auth-code'
      };
    }
    
    // Proceed with normal sign-in for regular builds
    const userInfo = await GoogleSignin.signIn();
    
    return {
      success: true,
      isMock: false,
      ...userInfo
    };
  } catch (error) {
    return {
      success: false,
      isMock: isExpoGo,
      error: error.message || 'Unknown error',
      errorCode: error.code
    };
  }
};

/**
 * Check if the device environment supports all required features 
 * @returns {Object} Object containing environment compatibility details
 */
export const checkEnvironmentCompatibility = () => {
  const { isExpoGo } = detectExpoGo();
  
  const compatibility = {
    isExpoGo,
    platform: Platform.OS,
    supportsNativeGoogleAuth: !isExpoGo,
    supportsNativeFacebookAuth: !isExpoGo,
    supportsDeepLinking: true, // Deep linking works in Expo Go
    supportsBackgroundTasks: !isExpoGo, // Background tasks may not work in Expo Go
    supportsNotifications: true, // Notifications generally work in Expo Go
    isDevBuild: __DEV__,
    recommendedAuthMethod: isExpoGo ? 'mock' : 'native'
  };
  
  return compatibility;
};

export default {
  detectExpoGo,
  configureGoogleSignIn,
  safeGoogleSignIn,
  checkEnvironmentCompatibility
}; 