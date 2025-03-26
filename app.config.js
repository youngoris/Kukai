import 'dotenv/config';

// 基础配置，从app.json复制
const baseConfig = {
  name: "kukai",
  slug: "kukai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  jsEngine: "hermes",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.andre.kukai",
    infoPlist: {
      NSHealthShareUsageDescription: "This app requires access to save your meditation sessions as mindfulness data",
      NSHealthUpdateUsageDescription: "This app requires access to save your meditation sessions as mindfulness data",
      NSLocationWhenInUseUsageDescription: "此应用需要访问您的位置以提供天气信息和地理位置相关服务",
      NSLocationAlwaysAndWhenInUseUsageDescription: "此应用需要访问您的位置以提供天气信息和地理位置相关功能",
      NSLocationAlwaysUsageDescription: "此应用需要访问您的位置以提供天气信息和地理位置相关功能",
      NSMicrophoneUsageDescription: "此应用需要使用麦克风来提供语音功能",
      NSSpeechRecognitionUsageDescription: "此应用需要使用语音识别功能"
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    package: "com.andre.kukai",
    softwareKeyboardLayoutMode: "pan",
    allowsNotchDisplay: true,
    permissions: [
      "INTERNET",
      "ACCESS_NETWORK_STATE",
      "RECORD_AUDIO"
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  androidStatusBar: {
    hidden: true,
    translucent: true,
    barStyle: "light-content"
  },
  plugins: [
    "expo-asset",
    "expo-sqlite"
  ],
  scheme: "kukai",
  extra: {
    eas: {
      projectId: "8ee33501-ec7b-4c56-a239-e273a87a6f87"
    },
    // 添加环境变量
    WEATHER_API_KEY: process.env.WEATHER_API_KEY,
    WEATHER_API_BASE_URL: process.env.WEATHER_API_BASE_URL,
    WEATHER_API_UNITS: process.env.WEATHER_API_UNITS,
    WEATHER_CACHE_DURATION_HOURS: process.env.WEATHER_CACHE_DURATION_HOURS,
    LOCATION_CHANGE_THRESHOLD_KM: process.env.LOCATION_CHANGE_THRESHOLD_KM,
    GOOGLE_EXPO_CLIENT_ID: process.env.GOOGLE_EXPO_CLIENT_ID,
    GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
    GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
    GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
    // Azure Speech服务配置
    AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY || "3Y8Qt08l6WRPyDvcvOdhS2ykUJoVXENnrHHVWsZfaOoCSXspOIWLJQQJ99BCAC3pKaRXJ3w3AAAYACOGitgl",
    AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION || "eastus",
    AZURE_SPEECH_ENDPOINT: process.env.AZURE_SPEECH_ENDPOINT || "https://eastus.api.cognitive.microsoft.com/"
  },
  owner: "andreho",
  runtimeVersion: "1.0.0",
  updates: {
    url: "https://u.expo.dev/8ee33501-ec7b-4c56-a239-e273a87a6f87"
  }
};

export default {
  expo: baseConfig
}; 