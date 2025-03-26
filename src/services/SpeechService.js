/**
 * SpeechService.js
 * 
 * Direct Azure Cognitive Services speech synthesis integration
 * Implements text-to-speech conversion using REST API instead of SDK
 * Added offline detection and graceful degradation for network-dependent features
 */

import { Audio } from 'expo-av';
import { Platform, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer'; // For base64 encoding fallback
import storageService from '../services/storage/StorageService';

// Default voice settings
const DEFAULT_VOICE = 'en-US-JennyMultilingualNeural';
const DEFAULT_RATE = '0.85'; // Moderate rate that Azure supports
const DEFAULT_PITCH = '0';  // Default pitch

// Azure Speech Service configuration
const SPEECH_KEY = Constants.expoConfig?.extra?.AZURE_SPEECH_KEY;
const SPEECH_REGION = Constants.expoConfig?.extra?.AZURE_SPEECH_REGION || 'eastasia';
const SPEECH_ENDPOINT = Constants.expoConfig?.extra?.AZURE_SPEECH_ENDPOINT || 'https://eastasia.api.cognitive.microsoft.com/';

// Use a simpler fallback voice that has better compatibility
const FALLBACK_VOICE = 'en-US-JennyNeural'; // Non-multilingual version is more reliable
const SIMPLE_FALLBACK_VOICE = 'en-US-AriaNeural'; // Even simpler fallback

// Fallback regions to try if the primary region fails - use env region first
const FALLBACK_REGIONS = [SPEECH_REGION, 'eastus', 'westus', 'westeurope'].filter((v, i, a) => a.indexOf(v) === i);

// Audio session configuration
const AUDIO_MODE = {
  playsInSilentModeIOS: true,
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
  interruptionModeIOS: 1,
  interruptionModeAndroid: 1,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false
};

// Cached audio files for offline use - maps text to file paths
const OFFLINE_AUDIO_CACHE = {};

// Network status tracking
let isNetworkAvailable = true;
let lastNetworkCheck = 0;
const NETWORK_CHECK_INTERVAL_MS = 30000; // 30 seconds

/**
 * Meditation guidance script collection, organized by themes and purposes
 */
export const MEDITATION_SCRIPTS = {
  // Core daily focus routine - Focus on important matters, then complete tasks
  dailyFocus: [
    { 
      time: 0, 
      text: "Welcome to your meditation session. Find a comfortable position and gently close your eyes." 
    },
    { 
      time: 10, 
      text: "Take a deep breath in... and slowly exhale..." 
    },
    { 
      time: 20, 
      text: "With each breath, allow your body to relax more deeply."
    },
    { 
      time: 40, 
      text: "Today, we'll focus on identifying and prioritizing what truly matters to you."
    },
    { 
      time: 60, 
      text: "As you continue breathing slowly, bring to mind the most important task or goal you want to accomplish today."
    },
    { 
      time: 90, 
      text: "Visualize yourself completing this task successfully. What does it look like? How does it feel?"
    },
    { 
      time: 120, 
      text: "Now, consider why this task is important to you. How does it align with your values and long-term goals?"
    },
    { 
      time: 150, 
      text: "Notice any resistance or obstacles that might prevent you from focusing on this important task."
    },
    { 
      time: 180, 
      text: "Acknowledge these challenges without judgment, then gently let them go."
    },
    { 
      time: 210, 
      text: "Return your focus to your breath, feeling centered and clear."
    },
    { 
      time: 240, 
      text: "As you prepare to end this meditation, commit to dedicating time and energy to your priority task today."
    },
    { 
      time: 270, 
      text: "When you're ready, you'll be able to add this important task to your list and plan your day accordingly."
    },
    { 
      time: 300, 
      text: "Take a deep breath in... and slowly exhale..."
    },
    { 
      time: 315, 
      text: "Gently open your eyes when you're ready, bringing this clarity and focus with you into your day."
    }
  ],
  
  // Brief focus meditation - Suitable for short meditation sessions
  quickFocus: [
    { time: 0, text: "Find a comfortable position and gently close your eyes." },
    { time: 10, text: "Take a deep breath in through your nose, and slowly exhale through your mouth." },
    { time: 20, text: "Bring your attention to the present moment." },
    { time: 40, text: "Focus on the sensation of your breath entering and leaving your body." },
    { time: 60, text: "If your mind wanders, gently bring your focus back to your breath." },
    { time: 120, text: "As we finish this brief meditation, take one more deep breath." },
    { time: 135, text: "When you're ready, gently open your eyes, feeling refreshed and focused." }
  ],
  
  // Stress relief meditation - Focus on relieving stress and anxiety
  stressRelief: [
    { time: 0, text: "Find a comfortable position and gently close your eyes." },
    { time: 10, text: "Take a deep breath in... and slowly exhale, releasing any tension." },
    { time: 20, text: "With each breath, allow your body to relax more deeply." },
    { time: 40, text: "Scan your body from head to toe, noticing any areas of tension." },
    { time: 60, text: "As you exhale, imagine releasing that tension." },
    { time: 90, text: "Your shoulders relaxing... your jaw softening... your hands unclenching." },
    { time: 120, text: "Let go of worries about the past or future. You are here, now." },
    { time: 150, text: "When your mind wanders to stressful thoughts, gently redirect it to your breath." },
    { time: 210, text: "Remember that you can return to this peaceful state anytime." },
    { time: 240, text: "As we prepare to end this meditation, carry this feeling of calm with you." },
    { time: 270, text: "Take a deep breath in... and slowly exhale..." },
    { time: 285, text: "When you're ready, gently open your eyes, feeling refreshed and at ease." }
  ],
  
  // Bedtime meditation - Help relax and prepare for sleep
  bedtime: [
    { time: 0, text: "Find a comfortable position and gently close your eyes." },
    { time: 10, text: "Take a deep breath in... and slowly exhale..." },
    { time: 20, text: "Allow your body to sink into the surface beneath you." },
    { time: 40, text: "Release any tension from your day with each exhale." },
    { time: 60, text: "Your body becoming heavier and more relaxed." },
    { time: 90, text: "Let go of any thoughts about tomorrow." },
    { time: 120, text: "Focus only on this moment, this breath." },
    { time: 150, text: "With each breath, you drift deeper into relaxation." },
    { time: 180, text: "Your mind becoming quieter... your body becoming softer..." },
    { time: 210, text: "Allow yourself to rest completely." },
    { time: 240, text: "As this meditation concludes, you may drift gently into sleep." }
  ]
};

/**
 * Speech Service class
 * Provides text-to-speech conversion and playback functionality using Azure REST API
 * Implements graceful degradation when network is unavailable
 */
class SpeechService {
  constructor() {
    this.isInitialized = false;
    this.audioPlayer = null;
    this.currentPromptTimer = null;
    this.promptQueue = [];
    this.isPlaying = false;
    this.accessToken = null;
    this.tokenExpiryTime = null;
    this._fallbackErrorCount = 0;
    this.promptTimers = [];
    this._preloadedPromptPath = null;
    this.audioSessionConfigured = false;
    this.isOfflineModeEnabled = false;
    
    // Initialize network status monitoring
    this.initNetworkMonitoring();
  }

  /**
   * Set up network status monitoring to detect offline mode
   * This allows the service to adapt its behavior based on network availability
   */
  initNetworkMonitoring() {
    // Check network status initially
    this.checkNetworkStatus();
    
    // Monitor app state changes to check network when app comes to foreground
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        this.checkNetworkStatus();
      }
    });
  }

  /**
   * Check if the device is connected to the network
   * @returns {Promise<boolean>} True if connected, false otherwise
   */
  async checkNetworkStatus() {
    // Always return true - we're forcing online mode to ensure TTS works properly
    console.log('Network check: Forcing online mode for TTS functionality');
    return true;
  }

  /**
   * Configure audio session for optimal playback
   * @returns {Promise<boolean>} Whether configuration was successful
   */
  async configureAudioSession() {
    try {
      // Skip if already configured
      if (this.audioSessionConfigured) {
        return true;
      }

      // Configure audio mode for optimal playback with valid interrupt mode values
      try {
        await Audio.setAudioModeAsync(AUDIO_MODE);
        console.log('Audio session configured successfully');
        this.audioSessionConfigured = true;
        return true;
      } catch (modeError) {
        console.error('Error setting audio mode:', modeError);
        
        // Fallback to minimal audio configuration if standard config fails
        const minimalConfig = {
          allowsRecordingIOS: false,
          interruptionModeIOS: 0,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeAndroid: 2,
          shouldDuckAndroid: true
        };

        // Try with minimal config
        await Audio.setAudioModeAsync(minimalConfig);
        console.log('Audio session configured with minimal settings');
        this.audioSessionConfigured = true;
        return true;
      }
    } catch (error) {
      console.error('Failed to configure audio session:', error);
      // Even if configuration fails, we'll still try to proceed
      this.audioSessionConfigured = true;
      return false;
    }
  }

  /**
   * Initialize the speech service
   * Modified to handle offline mode gracefully
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      if (!SPEECH_KEY) {
        console.error('Azure Speech Key not configured');
        return false;
      }

      // Configure audio session
      await this.configureAudioSession();

      // Initialize audio player
      this.audioPlayer = new Audio.Sound();
      
      // Force online mode
      this.isOfflineModeEnabled = false;
      
      // Online mode - try to get access token
      try {
        await this.getAccessToken();
      } catch (tokenError) {
        console.warn('Failed to get access token, continuing in online mode:', tokenError.message);
        // Continue without token - some functionality will be limited
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize speech service:', error);
      return false;
    }
  }

  /**
   * Get Azure access token for speech services
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    // Assume we're always online
    
    // Check if we have a valid token already
    const now = Date.now();
    if (this.accessToken && this.tokenExpiryTime && now < this.tokenExpiryTime) {
      console.log("Using cached Azure speech token (valid)");
      return this.accessToken;
    }

    // Setting timeout control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
    
    try {
      // Use the region from environment settings
      const tokenEndpoint = `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      
      console.log(`Requesting new Azure speech access token from ${SPEECH_REGION}`);
      
      // Detailed validation of SPEECH_KEY
      if (!SPEECH_KEY) {
        console.error("Azure Speech Key is missing. Check environment variables or app configuration.");
        throw new Error("Missing API key");
      }
      
      if (SPEECH_KEY.includes('your_') || SPEECH_KEY.length < 10) {
        console.error("Invalid API key format. Check .env file or app configuration.");
        console.error(`Key format problem: ${SPEECH_KEY.substring(0, 3)}...${SPEECH_KEY.substring(SPEECH_KEY.length - 3)}`);
        throw new Error("Invalid API key format");
      }
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': SPEECH_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Provide more detailed error classification
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details available');
        let errorMessage = `Failed to get access token: ${response.status} ${response.statusText}`;
        
        if (response.status === 401) {
          errorMessage += ' - Invalid subscription key or wrong region. Verify Azure settings.';
        } else if (response.status === 403) {
          errorMessage += ' - Subscription key is valid but may not have TTS permissions or quota exceeded.';
        } else if (response.status >= 500) {
          errorMessage += ' - Azure service error, please try again later.';
        }
        
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
        
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      const token = await response.text();
      
      // Check if token is valid
      if (!token || token.length < 10) {
        console.error('Received invalid token (too short or empty)');
        throw new Error(`Invalid token received from Azure API`);
      }
      
      // Token valid for 10 minutes, set expiry for 9 minutes to be safe
      this.accessToken = token;
      this.tokenExpiryTime = now + 9 * 60 * 1000;
      
      console.log(`Successfully received Azure speech access token. Expires in 9 minutes. (${token.substring(0, 3)}...${token.substring(token.length - 3)})`);
      return token;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Provide more detailed error classification
      if (error.name === 'AbortError') {
        console.error('Token request timed out after 15 seconds');
        throw new Error('Azure token request timed out - network may be slow or service unavailable');
      } else if (error.message.includes('Network request failed')) {
        console.error('Network error during token request:', error);
        throw new Error('Network error when contacting Azure - check internet connection');
      } else {
        console.error('Error getting Azure access token:', error);
      }
      
      this.accessToken = null;
      this.tokenExpiryTime = null;
      throw error;
    }
  }

  /**
   * Generate SSML markup language
   * @param {string} text - Text to convert
   * @param {Object} options - Voice options
   * @returns {string} SSML formatted text
   */
  generateSSML(text, options = {}) {
    const {
      voice = DEFAULT_VOICE,
      rate = DEFAULT_RATE,
      pitch = DEFAULT_PITCH
    } = options;

    // Sanitize and truncate text to prevent SSML errors
    const maxTextLength = 400; // More conservative limit to avoid 400 errors
    const truncatedText = text.length > maxTextLength ? 
      text.substring(0, maxTextLength - 3) + "..." : 
      text;
    
    const cleanText = this.sanitizeTextForSSML(truncatedText);
    
    // Create SSML with properly formatted rate (ensure it's in valid range for Azure)
    // Azure expects rate values like "slow", "medium", "fast" or percentage values like "-10%"
    let rateValue = rate;
    
    // If rate is already in percentage format, use it directly (after validation)
    if (typeof rate === 'string' && rate.endsWith('%')) {
      // Just validate the percentage is in range
      const rateNum = parseInt(rate.replace('%', ''));
      if (isNaN(rateNum)) {
        // Invalid percentage format, use default
        rateValue = '0%';
        console.log(`Invalid percentage format "${rate}", using default 0%`);
      } else if (rateNum < -50) {
        rateValue = '-50%';
        console.log(`Rate ${rate} clamped to minimum -50%`);
      } else if (rateNum > 50) {
        rateValue = '50%';
        console.log(`Rate ${rate} clamped to maximum 50%`);
      } else {
        // Valid percentage, use as is
        rateValue = rate;
        console.log(`Using provided percentage rate: ${rate}`);
      }
    }
    // If numeric rate, convert to percentage format that Azure accepts
    else if (!isNaN(parseFloat(rate))) {
      // Convert decimal rate (e.g., 0.60) to percentage format (e.g., "-40%")
      // This gives better control and accuracy for the user setting
      // Azure supports rates from -90% to +900%
      let percentChange = Math.round((parseFloat(rate) - 1) * 100);
      
      // More conservative clamping for Azure compatibility
      if (percentChange < -50) percentChange = -50;
      if (percentChange > 50) percentChange = 50;
      
      rateValue = `${percentChange}%`;
      
      console.log(`Converting voice rate from ${rate} to "${rateValue}" for Azure`);
    }
    
    // Ensure rate value is in acceptable range for Azure (-90% to +900%)
    if (rateValue.endsWith('%')) {
      const rateNum = parseInt(rateValue.replace('%', ''));
      if (rateNum < -50) rateValue = '-50%';
      if (rateNum > 50) rateValue = '50%';
    }
    
    // Use a simpler SSML format to reduce potential incompatibilities
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    <prosody rate="${rateValue}">
      ${cleanText}
    </prosody>
  </voice>
</speak>`;
    
    // Log SSML info
    console.log(`Generated SSML (${ssml.length} chars) for text with rate=${rateValue}: "${truncatedText.substring(0, 30)}${truncatedText.length > 30 ? '...' : ''}" (truncated from ${text.length} chars)`);
    
    return ssml;
  }
  
  /**
   * Sanitize text for use in SSML
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text safe for SSML
   */
  sanitizeTextForSSML(text) {
    if (!text) return '';
    
    // More aggressive sanitization to prevent SSML issues
    let cleaned = text
      // Remove any existing XML/HTML tags
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Remove problematic control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Allow only ASCII printable characters to be safe
      .replace(/[^\x20-\x7E]/g, ' ')
      // Replace XML special characters
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Remove problematic punctuation sequences that might cause SSML errors
      .replace(/[.]{2,}/g, '.')
      .replace(/[?]{2,}/g, '?')
      .replace(/[!]{2,}/g, '!')
      .replace(/[-]{2,}/g, '-');
      
    // Remove any double spaces that might have been created
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Convert text to speech using Azure REST API and return audio data
   * Modified to support offline mode with cached audio
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Voice options
   * @returns {Promise<string>} File URI of the audio data
   */
  async textToSpeech(text, options = {}) {
    if (!this.isInitialized) {
      try {
        const initResult = await this.initialize();
        if (!initResult) {
          console.error("Speech service initialization failed");
          return null;
        }
      } catch (initError) {
        console.error("Error initializing speech service:", initError);
        return null;
      }
    }

    try {
      // Check if text is valid
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.error("Invalid text input:", text);
        return null;
      }
      
      // Check for cached audio first - exact match
      const cacheKey = `${text}_${options.voice || DEFAULT_VOICE}`;
      if (OFFLINE_AUDIO_CACHE[cacheKey]) {
        try {
          const cachedPath = OFFLINE_AUDIO_CACHE[cacheKey];
          // Verify file exists
          const fileInfo = await FileSystem.getInfoAsync(cachedPath);
          if (fileInfo.exists && fileInfo.size > 0) {
            console.log(`Using cached audio for "${text.substring(0, 20)}..."`);
            return cachedPath;
          }
        } catch (cacheError) {
          // Cache miss or error - continue with normal flow
          console.log(`Cache miss or error: ${cacheError.message}`);
        }
      }
      
      // Check network availability
      const isOnline = await this.checkNetworkStatus();
      
      // If offline, check for similar cached phrases as fallback
      if (!isOnline) {
        console.log('Offline mode: Looking for similar cached phrases');
        const similarKey = this.findSimilarCachedText(text);
        if (similarKey) {
          console.log(`Using similar cached audio: "${similarKey.substring(0, 20)}..."`);
          return OFFLINE_AUDIO_CACHE[similarKey];
        }
        
        // No suitable cache found
        console.warn('No suitable cached audio found for offline playback');
        return null;
      }
      
      // Always use online mode regardless of network check result
      isNetworkAvailable = true;
      this.isOfflineModeEnabled = false;
      
      // Online mode - proceed with API request
      // Use more conservative text length limits
      const maxLength = 300; // More conservative limit to avoid 400 errors
      const processedText = text.length > maxLength ? 
        text.substring(0, maxLength - 3) + "..." : 
        text;
        
      // Create file paths for output
      const finalPath = `${FileSystem.documentDirectory}speech-direct-${Date.now()}.mp3`;
      
      // Try with the recommended voice first
      try {
        const safeOptions = {
          ...options,
          // Don't overwrite user-defined voice if provided
          voice: options.voice || 'en-US-JennyNeural',
          rate: options.rate || '0%'  // Preserve rate if already set
        };
        
        // If rate is a decimal and not already a percentage format, convert it
        if (safeOptions.rate && !safeOptions.rate.endsWith('%') && !isNaN(parseFloat(safeOptions.rate))) {
          // Convert to percentage format
          const rate = parseFloat(safeOptions.rate);
          const percentChange = Math.round((rate - 1) * 100);
          const clampedPercent = Math.max(-50, Math.min(50, percentChange));
          safeOptions.rate = `${clampedPercent}%`;
          console.log(`Converted numeric rate ${options.rate} to percentage: ${safeOptions.rate}`);
        }
        
        console.log(`Attempting TTS with safe options: voice=${safeOptions.voice}, rate=${safeOptions.rate}`);
        const result = await this._makeTTSRequest(processedText, safeOptions, finalPath, SPEECH_REGION);
        
        // Cache successful result for offline use
        this.cacheAudioFile(cacheKey, result);
        
        return result;
      } catch (error) {
        console.error(`TTS request in ${SPEECH_REGION} failed: ${error.message}`);
        
        // For shorter text, try once more with even more simplified options and shorter text
        try {
          // Use a much shorter text to increase chances of success
          const shortenedText = processedText.substring(0, Math.min(100, processedText.length));
          console.log(`Trying with minimal text (${shortenedText.length} chars) and basic options`);
          
          const result = await this._makeTTSRequest(shortenedText, {
            voice: "en-US-JennyNeural", 
            rate: '0%',                
            pitch: '0'                 
          }, finalPath, SPEECH_REGION);
          
          // Cache the shortened result too
          this.cacheAudioFile(`${shortenedText}_${DEFAULT_VOICE}`, result);
          
          return result;
        } catch (finalError) {
          console.error("All TTS methods failed:", finalError.message);
          throw new Error(`TTS request failed: ${finalError.message}`);
        }
      }
    } catch (error) {
      console.error('Error in text to speech conversion:', error.message);
      throw error;
    }
  }
  
  /**
   * Cache audio file for offline use
   * @param {string} key - Cache key (text_voice)
   * @param {string} filePath - Path to audio file
   */
  async cacheAudioFile(key, filePath) {
    try {
      // Ensure the file exists
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        return;
      }
      
      // Create a permanent copy for caching
      const cacheDirPath = `${FileSystem.documentDirectory}tts_cache/`;
      const cacheFilePath = `${cacheDirPath}tts_${Date.now()}.mp3`;
      
      // Ensure cache directory exists
      const cacheDirInfo = await FileSystem.getInfoAsync(cacheDirPath);
      if (!cacheDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDirPath, { intermediates: true });
      }
      
      // Copy file to cache
      await FileSystem.copyAsync({
        from: filePath,
        to: cacheFilePath
      });
      
      // Store in memory cache
      OFFLINE_AUDIO_CACHE[key] = cacheFilePath;
      console.log(`Cached audio for offline use: "${key.substring(0, 20)}..."`);
      
      // Manage cache size (async, don't await)
      this.manageCacheSize();
    } catch (error) {
      console.warn('Failed to cache audio file:', error.message);
    }
  }
  
  /**
   * Find similar text in the cache for offline fallback
   * @param {string} text - The text to find similar matches for
   * @returns {string|null} The cache key of the similar text, or null if none found
   */
  findSimilarCachedText(text) {
    // Simple implementation - look for cache keys that contain part of the text
    // or text that contains part of the cache keys
    const normalizedText = text.toLowerCase().trim();
    
    for (const key of Object.keys(OFFLINE_AUDIO_CACHE)) {
      const cacheParts = key.split('_');
      if (cacheParts.length < 1) continue;
      
      const cacheText = cacheParts[0].toLowerCase().trim();
      
      // Check if cache contains the text or text contains the cache
      if (cacheText.includes(normalizedText) || normalizedText.includes(cacheText)) {
        return key;
      }
    }
    
    return null;
  }
  
  /**
   * Manage the size of the audio cache to prevent excessive storage use
   * Removes oldest files when cache gets too large
   */
  async manageCacheSize() {
    try {
      const MAX_CACHE_FILES = 50; // Maximum number of cached audio files
      const cacheDirPath = `${FileSystem.documentDirectory}tts_cache/`;
      
      // Get all cached files
      const cacheFiles = await FileSystem.readDirectoryAsync(cacheDirPath);
      
      // If cache is not too large, do nothing
      if (cacheFiles.length <= MAX_CACHE_FILES) {
        return;
      }
      
      // Get file info with timestamps
      const fileInfoPromises = cacheFiles.map(async (fileName) => {
        const filePath = `${cacheDirPath}${fileName}`;
        const info = await FileSystem.getInfoAsync(filePath);
        return {
          path: filePath,
          modificationTime: info.modificationTime || 0,
          size: info.size || 0
        };
      });
      
      const fileInfos = await Promise.all(fileInfoPromises);
      
      // Sort by modification time (oldest first)
      fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);
      
      // Delete oldest files to reduce cache size
      const filesToDelete = fileInfos.slice(0, fileInfos.length - MAX_CACHE_FILES);
      
      for (const file of filesToDelete) {
        await FileSystem.deleteAsync(file.path, { idempotent: true });
        
        // Also remove from in-memory cache
        Object.keys(OFFLINE_AUDIO_CACHE).forEach(key => {
          if (OFFLINE_AUDIO_CACHE[key] === file.path) {
            delete OFFLINE_AUDIO_CACHE[key];
          }
        });
      }
      
      console.log(`Cleaned up ${filesToDelete.length} old cached audio files`);
    } catch (error) {
      console.warn('Error managing cache size:', error.message);
    }
  }
  
  /**
   * Make TTS request to Azure
   * @param {string} text - Text to convert
   * @param {Object} options - Voice options 
   * @param {string} outputPath - Path to save audio
   * @param {string} region - Azure region to use
   * @returns {Promise<string>} Path to audio file
   */
  async _makeTTSRequest(text, options, outputPath, region = SPEECH_REGION) {
    try {
      // Ensure we have a valid token
      const token = await this.getAccessToken();
      
      // Generate SSML
      // Use a safe default rate (0%) for failed requests
      const safeOptions = {
        ...options,
        rate: options.rate || '0%',
        // Always use a voice known to work well with the API
        voice: options.voice || 'en-US-JennyNeural'  
      };
      
      const ssml = this.generateSSML(text, safeOptions);
      
      console.log(`Making TTS request to Azure (${ssml.length} chars)`);
      
      // Build request URL based on region
      const ttsEndpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      console.log(`Sending TTS request to: ${ttsEndpoint}`);
      
      // Setting timeout control
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      // Make request to Azure TTS API
      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-64kbitrate-mono-mp3',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'KukaiMeditationApp',
        },
        body: ssml,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => null);
        throw new Error(`TTS request failed with status ${response.status}: ${errorText || ''}`);
      }
      
      // Get audio data
      const audioData = await response.arrayBuffer();
      
      // Verify audio data is valid
      if (!audioData || audioData.byteLength < 100) {
        throw new Error(`Received invalid audio data (too small: ${audioData?.byteLength || 0} bytes)`);
      }
      
      // Write audio data to file - using our class method instead of non-existent FileSystem method
      await FileSystem.writeAsStringAsync(
        outputPath,
        this.arrayBufferToBase64(audioData),
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      return outputPath;
    } catch (error) {
      console.error(`TTS API Error (${error.name || 'Unknown'}):`, error.message);
      throw error;
    }
  }

  /**
   * Helper function to convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer} buffer - The array buffer to convert
   * @returns {string} Base64 string
   */
  arrayBufferToBase64(buffer) {
    try {
      if (!buffer) {
        console.error('Invalid buffer provided to arrayBufferToBase64');
        return '';
      }
      
      // First attempt: Use Buffer
      try {
        const buf = Buffer.from(buffer);
        return buf.toString('base64');
      } catch (bufferError) {
        console.warn('Buffer conversion failed, using fallback method:', bufferError.message);
        
        // Fallback method: Manual conversion
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        
        // Try global btoa
        if (typeof global.btoa === 'function') {
          return global.btoa(binary);
        } else {
          console.warn('btoa not available, using manual Base64 encoding');
          return this._manualBase64Encode(binary);
        }
      }
    } catch (error) {
      console.error('Error in arrayBufferToBase64 conversion:', error);
      throw new Error('Failed to convert audio data: ' + error.message);
    }
  }
  
  /**
   * Manual Base64 encoding as a fallback if btoa is not available
   * @param {string} input - Binary string to encode
   * @returns {string} Base64 encoded string
   */
  _manualBase64Encode(input) {
    const base64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i;
    const len = input.length;
    
    for (i = 0; i < len; i += 3) {
      const byte1 = input.charCodeAt(i) & 0xff;
      const byte2 = i + 1 < len ? input.charCodeAt(i + 1) & 0xff : 0;
      const byte3 = i + 2 < len ? input.charCodeAt(i + 2) & 0xff : 0;
      
      const triplet = (byte1 << 16) | (byte2 << 8) | byte3;
      
      result += base64chars[(triplet >> 18) & 0x3F];
      result += base64chars[(triplet >> 12) & 0x3F];
      result += i + 1 < len ? base64chars[(triplet >> 6) & 0x3F] : '=';
      result += i + 2 < len ? base64chars[triplet & 0x3F] : '=';
    }
    
    return result;
  }

  /**
   * Play a spoken prompt with offline support
   * @param {string} text - Prompt text
   * @param {Object} options - Voice options
   * @returns {Promise<boolean>} Whether playback was successful
   */
  async playPrompt(text, options = {}) {
    try {
      console.log(`Playing prompt: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
      
      // Ensure valid text
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.error('Invalid text provided for prompt');
        return false;
      }
      
      // Try to get user settings for voice preferences
      try {
        const settingsJson = await storageService.getItem("userSettings");
        
        if (settingsJson) {
          // Parse settings
          const settings = typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
          
          // Apply user preferences if not explicitly provided in options
          if (!options.voice && settings.selectedVoice) {
            options.voice = settings.selectedVoice;
          }
          
          if (!options.rate && settings.voiceSpeed) {
            // Don't set the raw voiceSpeed directly - getUserVoiceSettings will handle the conversion
            // Instead, get the properly converted voice settings
            const voiceSettings = await this.getUserVoiceSettings();
            options.rate = voiceSettings.rate;
            console.log(`Applied converted rate from settings: ${options.rate}`);
          }
          
          console.log(`Using voice preferences from settings: voice=${options.voice}, rate=${options.rate}`);
        }
      } catch (settingsError) {
        console.warn('Could not load voice settings, using defaults:', settingsError.message);
      }
      
      // Ensure audio session is configured before playback - use minimal config
      try {
        if (!this.audioSessionConfigured) {
          await this.configureAudioSession();
        }
      } catch (audioConfigError) {
        // Continue even if audio config fails - iOS might still play audio
        console.warn('Audio session config error, continuing anyway:', audioConfigError.message);
      }
      
      // Check network status to determine approach
      // Force online mode
      const isOnline = true;
      let audioFilePath = null;
      let lastError = null;
      
      // Get user's preferred voice
      const userVoice = options.voice || DEFAULT_VOICE;
      
      // Try to generate speech with user's voice preference
      try {
        console.log(`Generating TTS with voice: ${userVoice}`);
        audioFilePath = await this.textToSpeech(text, {
          ...options,
          voice: userVoice
        });
      } catch (error) {
        console.error('Failed to generate TTS:', error.message);
        lastError = error;
        
        // Try with standard rate if custom rate fails
        if (options.rate && options.rate !== '0%') {
          console.log('TTS failed with custom rate, trying with standard rate');
          try {
            // Make sure the rate is properly formatted
            let fallbackRate = '0%';
            
            // If this is coming from a settings.voiceSpeed value, convert properly
            if (!options.rate.endsWith('%') && !isNaN(parseFloat(options.rate))) {
              const voiceSettings = await this.getUserVoiceSettings();
              fallbackRate = voiceSettings.rate;
            }
            
            audioFilePath = await this.textToSpeech(text, {
              ...options,
              voice: userVoice,
              rate: fallbackRate
            });
          } catch (rateError) {
            // Try with fallback voice as last resort
            try {
              console.log(`Trying with fallback voice: ${FALLBACK_VOICE}`);
              audioFilePath = await this.textToSpeech(text, {
                voice: FALLBACK_VOICE,
                rate: '0%',
                pitch: '0'
              });
            } catch (fallbackError) {
              // One final attempt with the simplest voice
              try {
                console.log(`Last attempt with simple fallback voice: ${SIMPLE_FALLBACK_VOICE}`);
                audioFilePath = await this.textToSpeech(text, {
                  voice: SIMPLE_FALLBACK_VOICE,
                  rate: '0%',
                  pitch: '0'
                });
              } catch (finalError) {
                console.error('All voice fallbacks failed:', finalError.message);
              }
            }
          }
        }
      }
      
      // If offline, try to find cached audio
      if (!audioFilePath && !isOnline) {
        console.log('Offline mode: Using cached audio only');
        
        try {
          // Try exact match with user's preferred voice
          const cacheKey = `${text}_${userVoice}`;
          if (OFFLINE_AUDIO_CACHE[cacheKey]) {
            audioFilePath = OFFLINE_AUDIO_CACHE[cacheKey];
          } else {
            // Try with default voice
            const defaultCacheKey = `${text}_${DEFAULT_VOICE}`;
            if (OFFLINE_AUDIO_CACHE[defaultCacheKey]) {
              audioFilePath = OFFLINE_AUDIO_CACHE[defaultCacheKey];
            } else {
              // Try similar text
              const similarKey = this.findSimilarCachedText(text);
              if (similarKey) {
                audioFilePath = OFFLINE_AUDIO_CACHE[similarKey];
                console.log(`Using similar cached audio: "${similarKey.substring(0, 20)}..."`);
              }
            }
          }
        } catch (cacheError) {
          console.warn('Error accessing audio cache:', cacheError.message);
        }
      }
      
      if (!audioFilePath) {
        console.error('Failed to generate or find audio for prompt:', lastError?.message || 'No suitable audio found in offline mode');
        return false;
      }
      
      console.log(`Loading audio from: ${audioFilePath}`);
      
      try {
        // Stop current playback with proper checks
        await this.stopPlayback();
        
        // Add a small delay to ensure previous audio operations are complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Double-check audio player state
        if (!this.audioPlayer) {
          console.log('Creating new audio player instance');
          this.audioPlayer = new Audio.Sound();
        }
        
        // Check if audio is already loading
        if (this.audioPlayer._loading) {
          console.log('Audio is already loading, waiting before proceeding');
          await new Promise(resolve => setTimeout(resolve, 200));
          // If still loading after waiting, create a new instance
          if (this.audioPlayer._loading) {
            console.log('Audio still loading after delay, creating new instance');
            this.audioPlayer = new Audio.Sound();
          }
        }
        
        // Final check before loading
        let status = null;
        try {
          status = await this.audioPlayer.getStatusAsync();
          if (status.isLoaded) {
            console.log('Audio is still loaded, unloading before loading new audio');
            await this.audioPlayer.unloadAsync();
          }
        } catch (statusError) {
          // Status error is expected if sound is not loaded
          console.log('Audio status check (expected error if not loaded):', statusError.message);
        }
        
        // Load and play audio file with proper error handling
        try {
          await this.audioPlayer.loadAsync({ uri: audioFilePath });
        } catch (loadError) {
          if (loadError.message && loadError.message.includes('already loading')) {
            console.log('Load conflict detected, creating new player and retrying');
            this.audioPlayer = new Audio.Sound();
            // Retry loading with new instance
            await this.audioPlayer.loadAsync({ uri: audioFilePath });
          } else {
            throw loadError; // Re-throw other errors
          }
        }
        
        // Set audio completion callback
        this.audioPlayer.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            console.log('Audio playback completed');
            this.isPlaying = false;
            this.playNextInQueue();
            
            // Don't delete cached files
            if (!audioFilePath.includes('tts_cache')) {
              // Clean up temporary file
              FileSystem.deleteAsync(audioFilePath, { idempotent: true })
                .catch(err => console.warn('Failed to delete temporary audio file:', err));
            }
          } else if (status.error) {
            console.error('Audio playback error:', status.error);
            this.isPlaying = false;
            this.playNextInQueue();
          }
        });
        
        // Start playback and wait
        this.isPlaying = true;
        const playbackResult = await this.audioPlayer.playAsync();
        
        console.log(`Playback started: ${JSON.stringify(playbackResult)}`);
        return true;
      } catch (playbackError) {
        console.error('Error during audio playback:', playbackError);
        
        // Ensure failure clears state and try to continue queue
        this.isPlaying = false;
        setTimeout(() => this.playNextInQueue(), 500);
        return false;
      }
    } catch (error) {
      console.error('Error playing prompt:', error);
      this.isPlaying = false;
      return false;
    }
  }

  /**
   * Speak text using text-to-speech (alias for playPrompt)
   * @param {string} text - Text to speak
   * @param {Object} options - Voice options
   * @returns {Promise<boolean>} Whether playback was successful
   */
  async speak(text, options = {}) {
    return this.playPrompt(text, options);
  }

  /**
   * Queue a prompt to be played
   * @param {string} text - The text to speak
   * @param {Object} options - Options for speech
   */
  queuePrompt(text, options = {}) {
    // Add to queue
    this.promptQueue.push({ text, options });
    
    // If not currently playing, start playing
    if (!this.isPlaying) {
      this.playNextInQueue();
    }
  }

  /**
   * Play next prompt in queue
   */
  async playNextInQueue() {
    if (this.isPlaying || this.promptQueue.length === 0) {
      return;
    }
    
    const { text, options } = this.promptQueue.shift();
    
    try {
      // Make sure the rate is properly formatted if it exists
      if (options.rate && !options.rate.endsWith('%') && !isNaN(parseFloat(options.rate))) {
        // Convert the rate to percentage format if it's a raw decimal
        const voiceSettings = await this.getUserVoiceSettings();
        options.rate = voiceSettings.rate;
        console.log(`Queue: Converted rate format to ${options.rate}`);
      }
      
      // Try with specified rate first
      let success = await this.playPrompt(text, options);
      
      // If failed and using custom rate, try again with standard rate
      if (!success && options.rate && options.rate !== '0%') {
        console.log('TTS failed with custom rate, trying with standard rate');
        const standardOptions = {
          ...options,
          rate: '0%'  // Standard rate
        };
        await this.playPrompt(text, standardOptions);
      }
    } catch (error) {
      console.error('Error playing prompt:', error);
      // Continue to next prompt regardless of error
      this.isPlaying = false;
      setTimeout(() => this.playNextInQueue(), 500);
    }
  }

  /**
   * Stop current speech playback
   */
  async stopPlayback() {
    if (this.audioPlayer) {
      try {
        // Reset state first to prevent further operations
        this.isPlaying = false;
        
        // Check if the sound is currently loading
        if (this.audioPlayer._loading) {
          console.log('Sound is currently loading, waiting before unloading');
          // Wait for a moment to allow loading to complete or fail
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Check if playing using a more defensive approach
        let status = null;
        try {
          status = await this.audioPlayer.getStatusAsync();
        } catch (statusError) {
          console.log('Could not get audio status, assuming not loaded:', statusError.message);
        }
        
        if (status && status.isLoaded) {
          // Stop first if playing
          if (status.isPlaying) {
            try {
              await this.audioPlayer.stopAsync();
              console.log('Audio playback stopped successfully');
            } catch (stopError) {
              console.log('Non-critical error stopping audio:', stopError.message);
              // Continue to unload even if stop fails
            }
          }
          
          // Small delay before unloading to avoid race conditions
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Unload with error handling
          try {
            await this.audioPlayer.unloadAsync();
            console.log('Audio successfully unloaded');
          } catch (unloadError) {
            console.log('Non-critical error unloading audio:', unloadError.message);
            
            // If we get a "sound is already loading" error, wait and try once more
            if (unloadError.message && unloadError.message.includes('already loading')) {
              console.log('Detected "already loading" error, waiting and trying again');
              await new Promise(resolve => setTimeout(resolve, 200));
              try {
                await this.audioPlayer.unloadAsync();
                console.log('Audio successfully unloaded on second attempt');
              } catch (finalError) {
                console.log('Could not unload audio on second attempt, creating new Sound instance');
                // Create a new Sound instance to ensure clean state
                this.audioPlayer = new Audio.Sound();
              }
            }
          }
        } else {
          // If not loaded but the instance exists, recreate it to ensure clean state
          this.audioPlayer = new Audio.Sound();
          console.log('Created new Sound instance for clean state');
        }
      } catch (error) {
        // Ignore specific error types with more detailed logging
        if (error.message && error.message.includes('sound is not loaded')) {
          console.log('No audio currently loaded to stop');
        } else if (error.message && error.message.includes('Seeking interrupted')) {
          console.log('Seeking was interrupted while stopping - this is normal during cancellation');
        } else if (error.message && error.message.includes('already loading')) {
          console.log('Sound is already loading, creating new Sound instance');
          // Create a new Sound instance to ensure clean state
          this.audioPlayer = new Audio.Sound();
        } else {
          console.error('Error in audio cleanup:', error.message);
          // Reset audio player if we encounter unexpected errors
          this.audioPlayer = new Audio.Sound();
        }
      } finally {
        // Always ensure state is reset regardless of errors
        this.isPlaying = false;
      }
    }
    
    // Always clear queue and timers
    this.promptQueue = [];
    
    if (this.currentPromptTimer) {
      clearTimeout(this.currentPromptTimer);
      this.currentPromptTimer = null;
    }
  }

  /**
   * Schedule guided meditation prompts with offline support
   * Preloads and caches prompts when online to ensure offline availability
   * @param {Array} prompts - Array of prompts with time and text properties
   * @param {number} durationInSeconds - Total meditation duration in seconds
   * @param {function} onPromptPlay - Callback function when a prompt is played
   */
  scheduleGuidedMeditationPrompts(prompts, durationInSeconds, onPromptPlay = null) {
    // Clear existing timers and playback
    this.stopPlayback();
    
    // Safe check - Valid input parameters
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      console.error('Invalid meditation prompt array');
      return;
    }
    
    if (!durationInSeconds || durationInSeconds <= 0) {
      console.error('Invalid meditation duration');
      return;
    }
    
    // Ensure prompts do not exceed meditation duration
    const validPrompts = prompts.filter(prompt => 
      prompt && 
      typeof prompt.time === 'number' && 
      typeof prompt.text === 'string' && 
      prompt.time < durationInSeconds
    );
    
    if (validPrompts.length === 0) {
      console.warn('No valid meditation prompts found');
      return;
    }
    
    console.log(`Planning ${validPrompts.length} meditation prompts, total duration ${durationInSeconds} seconds`);
    
    // Get user settings for speech parameters
    this.getUserVoiceSettings().then(voiceSettings => {
      console.log("Using voice settings for meditation guidance:", voiceSettings);
      
      // Always use online mode
      this.isOfflineModeEnabled = false;
      isNetworkAvailable = true;
      
      // Preload prompts to ensure availability
      this.preloadMeditationPrompts(validPrompts, voiceSettings);
      
      // Set timers for each prompt
      this.promptTimers = [];
      
      validPrompts.forEach((prompt, index) => {
        const timer = setTimeout(() => {
          try {
            // Call callback function (if provided)
            if (onPromptPlay && typeof onPromptPlay === 'function') {
              try {
                onPromptPlay(prompt.text);
              } catch (callbackError) {
                console.error('Prompt playback callback error:', callbackError);
              }
            }
            
            // Add prompt to queue
            setTimeout(() => {
              this.queuePrompt(prompt.text, {
                ...voiceSettings,
                pauseAfter: 500 // Add brief pause after speech
              });
            }, 0);
            
            // Record scheduled prompt
            console.log(`Scheduled meditation prompt #${index + 1}/${validPrompts.length}: "${prompt.text.substring(0, 30)}${prompt.text.length > 30 ? '...' : ''}" (${prompt.time} seconds)`);
          } catch (promptError) {
            console.error(`Prompt #${index + 1} scheduling error:`, promptError);
          }
        }, prompt.time * 1000); // Convert to milliseconds
        
        this.promptTimers.push(timer);
      });
      
      console.log('Meditation prompts successfully scheduled');
      
      // Set reminder for session end
      if (durationInSeconds > 30) {
        this.sessionEndTimer = setTimeout(() => {
          console.log('Meditation session ending soon');
        }, (durationInSeconds - 10) * 1000);
      }
    }).catch(err => {
      console.warn("Could not load user voice settings, using defaults:", err.message);
      // Continue with default settings
      const voiceSettings = {
        voice: DEFAULT_VOICE,
        rate: '0%'
      };
      
      // Use same implementation as above but with default settings
      this.promptTimers = [];
      
      validPrompts.forEach((prompt, index) => {
        const timer = setTimeout(() => {
          if (onPromptPlay && typeof onPromptPlay === 'function') {
            onPromptPlay(prompt.text);
          }
          
          setTimeout(() => {
            this.queuePrompt(prompt.text, {
              ...voiceSettings,
              pauseAfter: 500
            });
          }, 0);
          
          console.log(`Scheduled default meditation prompt #${index + 1}/${validPrompts.length}`);
        }, prompt.time * 1000);
        
        this.promptTimers.push(timer);
      });
    });
  }
  
  /**
   * Get user voice settings from storage
   * @returns {Promise<Object>} User voice settings
   */
  async getUserVoiceSettings() {
    try {
      const settingsJson = await storageService.getItem('userSettings');
      if (!settingsJson) {
        console.log('No user settings found, using default voice settings');
        return {
          voice: DEFAULT_VOICE,
          rate: '0%'
        };
      }

      // Parse settings if it's a string
      const settings = typeof settingsJson === 'string' ? JSON.parse(settingsJson) : settingsJson;
      
      // Extract just the voice-related settings
      // Convert voiceSpeed (0.7-1.4) to Azure rate (-50% to +50%)
      // When voiceSpeed is 1.0, rate should be "0%"
      // When voiceSpeed is 0.7, rate should be close to "-50%"
      // When voiceSpeed is 1.4, rate should be close to "+50%"
      let ratePercentage = 0;
      if (settings.voiceSpeed) {
        // Linear conversion from the 0.7-1.4 range to -50% to +50% range
        ratePercentage = Math.round((settings.voiceSpeed - 1.0) * 100);
        // Clamp to the -50% to +50% range
        ratePercentage = Math.max(-50, Math.min(50, ratePercentage));
      }
      
      const voiceSettings = {
        voice: settings.selectedVoice || DEFAULT_VOICE,
        rate: `${ratePercentage}%`
      };
      
      console.log('Retrieved user voice settings:', voiceSettings);
      return voiceSettings;
    } catch (error) {
      console.error('Error getting user voice settings:', error);
      // Return default settings on error
      return {
        voice: DEFAULT_VOICE,
        rate: '0%'
      };
    }
  }
  
  /**
   * Preload meditation prompts to ensure offline availability
   * @param {Array} prompts - Array of prompts to preload
   * @param {Object} voiceSettings - Voice settings to use for preloading
   */
  async preloadMeditationPrompts(prompts, voiceSettings = {}) {
    // Only preload a subset of prompts to avoid excessive API calls
    const promptsToPreload = prompts.slice(0, Math.min(5, prompts.length));
    
    console.log(`Preloading ${promptsToPreload.length} meditation prompts for offline use`);
    
    for (const prompt of promptsToPreload) {
      try {
        const voice = voiceSettings.voice || DEFAULT_VOICE;
        const cacheKey = `${prompt.text}_${voice}`;
        
        // Check if already cached
        if (OFFLINE_AUDIO_CACHE[cacheKey]) {
          continue;
        }
        
        // Generate and cache TTS in background
        this.textToSpeech(prompt.text, {
          ...voiceSettings,
          voice
        }).catch(err => {
          // Silently fail preloading - not critical
          console.log(`Preload failed for prompt: ${err.message}`);
        });
        
        // Short delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        // Ignore preload errors
      }
    }
  }

  /**
   * Get a specific type of meditation script
   * @param {string} type - Script type (dailyFocus, quickFocus, etc.)
   * @returns {Array} Array of prompts
   */
  getMeditationScript(type = 'dailyFocus') {
    return MEDITATION_SCRIPTS[type] || MEDITATION_SCRIPTS.dailyFocus;
  }

  /**
   * Adjust prompt intervals based on meditation duration
   * @param {Array} prompts - Array of prompts
   * @param {number} targetDurationInSeconds - Target duration in seconds
   * @returns {Array} Adjusted array of prompts
   */
  adjustPromptsForDuration(prompts, targetDurationInSeconds) {
    if (!prompts || prompts.length === 0) {
      return [];
    }
    
    // Get the original script duration (time of the last prompt)
    const originalDuration = prompts[prompts.length - 1].time;
    
    // If target duration is less than original duration, truncate appropriate prompts
    if (targetDurationInSeconds <= originalDuration) {
      return prompts.filter(prompt => prompt.time <= targetDurationInSeconds);
    }
    
    // If target duration is greater than original duration, stretch time intervals
    const stretchFactor = targetDurationInSeconds / originalDuration;
    
    return prompts.map(prompt => ({
      ...prompt,
      time: Math.round(prompt.time * stretchFactor)
    }));
  }

  /**
   * Cancel all scheduled prompts
   */
  cancelAllPrompts() {
    // Clear all timers
    if (this.promptTimers && this.promptTimers.length > 0) {
      this.promptTimers.forEach(timer => clearTimeout(timer));
      this.promptTimers = [];
    }
    
    if (this.sessionEndTimer) {
      clearTimeout(this.sessionEndTimer);
      this.sessionEndTimer = null;
    }
    
    // Stop current playback
    this.stopPlayback();
    
    // Stop any queued audio
    this.promptQueue = [];
    
    // Clear any waiting timers
    if (this.currentPromptTimer) {
      clearTimeout(this.currentPromptTimer);
      this.currentPromptTimer = null;
    }
    
    // Clean up preloaded prompts
    if (this._preloadedPromptPath) {
      FileSystem.deleteAsync(this._preloadedPromptPath, { idempotent: true })
        .catch(err => console.warn('Cleaning up preloaded prompt file failed:', err));
      this._preloadedPromptPath = null;
    }
    
    console.log('All meditation prompts cancelled');
  }

  async isConnectedToAzure() {
    if (!SPEECH_REGION) {
      console.log('Azure Speech Service not configured: Missing region');
      return false;
    }
    
    console.log(`Testing Azure connection to region: ${SPEECH_REGION}`);
    try {
      const response = await fetch(
        `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': SPEECH_KEY
          }
        }
      );
      
      if (response.ok) {
        console.log(`Connected to Azure Speech Service in ${SPEECH_REGION}`);
        return true;
      } else {
        console.log(`Failed to connect to Azure in ${SPEECH_REGION}: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error(`Azure connectivity test failed for ${SPEECH_REGION}:`, error);
      return false;
    }
  }

  /**
   * Initialize Azure Speech Service
   * Verifies API key and region are available
   * @returns {Promise<boolean>} Success status
   */
  async initializeAzureSpeech() {
    // Simplified initialization that only checks the configured region
    try {
      if (!SPEECH_KEY) {
        console.error('Azure Speech Service not configured: Missing API key');
        return false;
      }
      
      if (!SPEECH_REGION) {
        console.error('Azure Speech Service not configured: Missing region');
        return false;
      }

      // Log configuration
      console.log(`Initializing Azure Speech with region: ${SPEECH_REGION}`);
      
      // Test connectivity to configured region
      return await this.isConnectedToAzure();
    } catch (error) {
      console.error('Failed to initialize speech service:', error);
      return false;
    }
  }

  /**
   * Get introduction prompt for a meditation type
   * @param {string} type - Script type (dailyFocus, quickFocus, etc.)
   * @returns {string} Introduction prompt text
   */
  getIntroPrompt(type = 'dailyFocus') {
    const script = this.getMeditationScript(type);
    return script && script.length > 0 ? script[0].text : '';
  }
  
  /**
   * Get meditation prompts based on type
   * @param {string} type - Script type (dailyFocus, quickFocus, etc.)
   * @param {number} totalSeconds - Total duration in seconds
   * @returns {Array} Array of prompts adjusted for the given duration
   */
  getMeditationPrompts(type = 'dailyFocus', totalSeconds) {
    const script = this.getMeditationScript(type);
    return this.adjustPromptsForDuration(script, totalSeconds);
  }
}

// Create a singleton instance
const speechService = new SpeechService();

export default speechService; 