/**
 * SpeechService.js
 * 
 * Direct Azure Cognitive Services speech synthesis integration
 * Implements text-to-speech conversion using REST API instead of SDK
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

// Default voice settings
const DEFAULT_VOICE = 'en-US-JennyMultilingualNeural';
const DEFAULT_RATE = '0.9'; // Slightly slower rate for meditation guidance
const DEFAULT_PITCH = '0';  // Default pitch

// Azure Speech Service configuration
const SPEECH_KEY = Constants.expoConfig?.extra?.AZURE_SPEECH_KEY;
const SPEECH_REGION = Constants.expoConfig?.extra?.AZURE_SPEECH_REGION || 'eastasia';
const SPEECH_ENDPOINT = Constants.expoConfig?.extra?.AZURE_SPEECH_ENDPOINT || 'https://eastasia.api.cognitive.microsoft.com/';

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
  }

  /**
   * Initialize the speech service
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      if (!SPEECH_KEY) {
        console.error('Azure Speech Key not configured');
        return false;
      }

      // Initialize audio player
      this.audioPlayer = new Audio.Sound();
      
      // Get access token
      await this.getAccessToken();
      
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
      pitch = DEFAULT_PITCH,
      pauseBefore = 0,
      pauseAfter = 0
    } = options;

    // Sanitize and truncate text if it's too long
    // Azure TTS has a limit on input text length
    const maxTextLength = 1000;
    const truncatedText = text.length > maxTextLength ? 
      text.substring(0, maxTextLength - 3) + "..." : 
      text;
    
    const cleanText = this.sanitizeTextForSSML(truncatedText);
    
    // Use minimal SSML format to reduce overall length
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`;
    
    // Simplify - only add pauses if really needed
    if (pauseBefore > 0) {
      ssml += `<break time="${pauseBefore}ms"/>`;
    }
    
    // Voice tag with minimal attributes
    ssml += `<voice name="${voice}">`;
    
    // Only add prosody if rate or pitch are non-default
    if (rate !== "1.0" || pitch !== "0") {
      ssml += `<prosody rate="${rate}" pitch="${pitch}">${cleanText}</prosody>`;
    } else {
      ssml += cleanText;
    }
    
    ssml += `</voice>`;
    
    if (pauseAfter > 0) {
      ssml += `<break time="${pauseAfter}ms"/>`;
    }
    
    ssml += `</speak>`;
    
    // Log SSML length instead of content to avoid lengthy logs
    console.log(`Generated SSML (${ssml.length} chars) for text: "${truncatedText.substring(0, 30)}${truncatedText.length > 30 ? '...' : ''}" (truncated from ${text.length} chars)`);
    
    return ssml;
  }
  
  /**
   * Sanitize text for use in SSML
   * @param {string} text - The text to sanitize
   * @returns {string} Sanitized text safe for SSML
   */
  sanitizeTextForSSML(text) {
    if (!text) return '';
    
    // Replace XML special characters
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert text to speech using Azure REST API and return audio data
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
      
      // Limit text length for all methods
      const maxLength = 500;
      const processedText = text.length > maxLength ? 
        text.substring(0, maxLength - 3) + "..." : 
        text;
        
      // Create file paths for output
      const finalPath = `${FileSystem.documentDirectory}speech-direct-${Date.now()}.mp3`;
      
      try {
        // Try standard method first
        let accessToken;
        try {
          accessToken = await this.getAccessToken();
        } catch (tokenError) {
          console.error("Failed to get access token:", tokenError);
          throw new Error("Token acquisition failed");
        }
        
        // Generate SSML
        const ssml = this.generateSSML(processedText, options);
        
        // Create a temporary file path to save the audio
        const tempFilePath = `${FileSystem.cacheDirectory}speech-${Date.now()}.mp3`;
        
        // API endpoint for text-to-speech
        const endpoint = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
        
        console.log(`Making TTS request to Azure for text (${processedText.length} chars): "${processedText.substring(0, 30)}${processedText.length > 30 ? '...' : ''}"`);
        
        // Setting timeout control
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout
        
        try {
          // Make the TTS request
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
              'User-Agent': 'ReactNative-TTS'
            },
            body: ssml,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`Speech synthesis failed: ${response.status} ${response.statusText}`, errorText);
            
            // Provide more detailed error information
            if (response.status === 401) {
              console.error("Authentication failed. Token may be invalid or expired.");
              // Try refreshing token
              this.accessToken = null;
              this.tokenExpiryTime = null;
            } else if (response.status === 400) {
              console.error(`Bad request. Text length: ${processedText.length}, SSML length: ${ssml.length}`);
              // Try fallback method with simpler SSML
              throw new Error("Bad request - will try fallback method");
            } else if (response.status === 429) {
              console.error("Rate limit exceeded. Too many requests to Azure TTS API.");
            } else if (response.status >= 500) {
              console.error("Azure service error. The service might be experiencing issues.");
            }
            
            throw new Error(`TTS request failed with status ${response.status}`);
          }
          
          // Process successful response
          const audioData = await response.arrayBuffer();
          
          if (!audioData || audioData.byteLength === 0) {
            console.error('Received empty audio data from Azure TTS API');
            throw new Error("Empty audio data received");
          }
          
          console.log(`Received audio data: ${audioData.byteLength} bytes`);
          
          await FileSystem.writeAsStringAsync(tempFilePath, this.arrayBufferToBase64(audioData), 
            { encoding: FileSystem.EncodingType.Base64 }
          );
          
          // Check if file was created successfully
          const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
          if (!fileInfo.exists) {
            throw new Error("Audio file was not created");
          }
          
          if (fileInfo.size === 0) {
            throw new Error("Audio file was created but is empty");
          }
          
          console.log(`Speech audio saved to: ${tempFilePath} (${fileInfo.size} bytes)`);
          return tempFilePath;
        } catch (apiError) {
          clearTimeout(timeoutId);
          
          if (apiError.name === 'AbortError') {
            console.error('TTS request timed out after 20 seconds');
          } else {
            console.error('Azure TTS API Error:', apiError);
          }
          
          throw apiError; // Let external catch and handle
        }
      } catch (standardMethodError) {
        console.log(`Standard TTS method failed, attempting fallback method with simpler SSML`);
        
        try {
          // Ultra simplified approach - minimal SSML with direct API key authentication
          const fallbackEndpoint = `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
          
          // Use a shorter version of the text for fallback
          const shortenedText = processedText.substring(0, Math.min(processedText.length, 200));
          
          // Create ultra-simple SSML - minimal format, no extra attributes
          const minimalSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="en-US-JennyNeural">${this.sanitizeTextForSSML(shortenedText)}</voice></speak>`;
          
          console.log(`Fallback TTS request with simplified SSML (${minimalSsml.length} chars)`);
          
          // Use direct API key instead of token
          const response = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': SPEECH_KEY,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
              'User-Agent': 'ReactNative-Minimal'
            },
            body: minimalSsml
          });
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`Fallback TTS request failed: ${response.status}`, errorText);
            throw new Error(`Fallback TTS request failed: ${response.status}`);
          }
          
          const audioData = await response.arrayBuffer();
          
          if (!audioData || audioData.byteLength === 0) {
            throw new Error("Fallback method returned empty audio data");
          }
          
          await FileSystem.writeAsStringAsync(finalPath, this.arrayBufferToBase64(audioData), {
            encoding: FileSystem.EncodingType.Base64
          });
          
          const fileInfo = await FileSystem.getInfoAsync(finalPath);
          if (!fileInfo.exists || fileInfo.size === 0) {
            throw new Error("Failed to create audio file or file is empty");
          }
          
          console.log(`Fallback TTS audio saved to: ${finalPath} (${fileInfo.size} bytes)`);
          return finalPath;
        } catch (fallbackError) {
          console.error("All TTS methods failed:", fallbackError);
          return null;
        }
      }
    } catch (error) {
      console.error('Error in text to speech conversion:', error);
      return null;
    }
  }

  /**
   * Helper function to convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer} buffer - The array buffer to convert
   * @returns {string} Base64 string
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    if (Platform.OS === 'ios') {
      return btoa(binary);
    } else {
      // For Android
      return global.btoa ? global.btoa(binary) : binary;
    }
  }

  /**
   * Play a spoken prompt
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
      
      // Add retry count
      let retryCount = 0;
      let audioFilePath = null;
      
      while (!audioFilePath && retryCount < 2) {
        try {
          // First try - Use user provided options
          if (retryCount === 0) {
            audioFilePath = await this.textToSpeech(text, options);
          } 
          // Second try - Use default options
          else {
            const defaultOptions = {
              voice: 'en-US-JennyNeural',
              rate: '1.0',
              pitch: '0'
            };
            console.log('Retrying with default voice options');
            audioFilePath = await this.textToSpeech(text, defaultOptions);
          }
          
          retryCount++;
        } catch (ttsError) {
          console.error(`TTS attempt ${retryCount + 1} failed:`, ttsError);
          retryCount++;
        }
      }
      
      if (!audioFilePath) {
        console.error('Failed to generate audio for prompt after multiple attempts');
        return false;
      }
      
      console.log(`Loading audio from: ${audioFilePath}`);
      
      try {
        // Stop current playback
        await this.stopPlayback();
        
        // Ensure load new audio before releasing old
        if (this.audioPlayer._loaded) {
          await this.audioPlayer.unloadAsync();
        }
        
        // Load and play audio file
        await this.audioPlayer.loadAsync({ uri: audioFilePath });
        
        // Set audio completion callback
        this.audioPlayer.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            console.log('Audio playback completed');
            this.isPlaying = false;
            this.playNextInQueue();
            
            // Clean up temporary file
            FileSystem.deleteAsync(audioFilePath, { idempotent: true })
              .catch(err => console.warn('Failed to delete temporary audio file:', err));
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
   * Add a prompt to the queue
   * @param {string} text - Prompt text
   * @param {Object} options - Voice options
   */
  queuePrompt(text, options = {}) {
    this.promptQueue.push({ text, options });
    
    // If nothing is currently playing, start playing the queue
    if (!this.isPlaying) {
      this.playNextInQueue();
    }
  }

  /**
   * Play the next prompt in the queue
   */
  playNextInQueue() {
    if (this.promptQueue.length > 0) {
      const { text, options } = this.promptQueue.shift();
      this.playPrompt(text, options);
    }
  }

  /**
   * Stop current speech playback
   */
  async stopPlayback() {
    if (this.audioPlayer) {
      try {
        // Check if playing
        const status = await this.audioPlayer.getStatusAsync();
        
        if (status.isLoaded) {
          if (status.isPlaying) {
            await this.audioPlayer.stopAsync();
          }
          await this.audioPlayer.unloadAsync();
        }
        
        this.isPlaying = false;
      } catch (error) {
        // Ignore specific error types
        if (error.message && error.message.includes('sound is not loaded')) {
          // This is acceptable - audio not yet loaded
          console.log('No audio currently loaded to stop');
        } else {
          console.error('Error stopping playback:', error);
        }
        
        // Regardless reset state
        this.isPlaying = false;
      }
    }
    
    // Clear queue and timers
    this.promptQueue = [];
    
    if (this.currentPromptTimer) {
      clearTimeout(this.currentPromptTimer);
      this.currentPromptTimer = null;
    }
  }

  /**
   * Schedule guided meditation prompts
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
    
    // Preload first prompt's audio (if time allows)
    if (validPrompts.length > 0 && validPrompts[0].time > 5) {
      const firstPrompt = validPrompts[0];
      console.log(`Preloading first meditation prompt: "${firstPrompt.text.substring(0, 30)}${firstPrompt.text.length > 30 ? '...' : ''}"`);
      
      // Start asynchronous preload but do not wait for result
      this.textToSpeech(firstPrompt.text, {
        rate: '0.9',
        pauseAfter: 500
      }).then(filePath => {
        if (filePath) {
          console.log(`First prompt preload successful: ${filePath}`);
          this._preloadedPromptPath = filePath;
        }
      }).catch(err => {
        console.warn('Preload prompt failed:', err);
      });
    }
    
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
          // Set to low priority to ensure it doesn't interfere with user interaction
          setTimeout(() => {
            this.queuePrompt(prompt.text, {
              rate: '0.9',  // Meditation guidance uses slightly slower speed
              pitch: '0',   // Use default tone
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
    
    // Clean up preloaded prompts
    if (this._preloadedPromptPath) {
      FileSystem.deleteAsync(this._preloadedPromptPath, { idempotent: true })
        .catch(err => console.warn('Cleaning up preloaded prompt file failed:', err));
      this._preloadedPromptPath = null;
    }
    
    console.log('All meditation prompts cancelled');
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
}

// Create a singleton instance
const speechService = new SpeechService();

export default speechService; 