/**
 * Application configuration constants
 */
import {
  WEATHER_API_KEY,
  WEATHER_API_BASE_URL,
  WEATHER_API_UNITS,
  WEATHER_CACHE_DURATION_HOURS,
  LOCATION_CHANGE_THRESHOLD_KM,
} from "@env";

// Log the source of the API key without exposing the actual key
console.log(
  "Weather API Key source:",
  WEATHER_API_KEY ? "Environment variable (.env)" : "Hardcoded fallback value",
);

// Display detailed API key info for debugging (first 4 and last 4 chars only)
if (WEATHER_API_KEY) {
  const keyPrefix = WEATHER_API_KEY.substring(0, 4);
  const keySuffix = WEATHER_API_KEY.substring(WEATHER_API_KEY.length - 4);
  console.log(`Env API key detected: ${keyPrefix}...${keySuffix} (length: ${WEATHER_API_KEY.length})`);
}

// Debug: Show the actual WEATHER_API_KEY value from env (safely)
console.log(`API key from env starts with: ${WEATHER_API_KEY ? WEATHER_API_KEY.substring(0, 4) : 'undefined'}`);

// Weather API configuration - Force using the provided key
const VALID_API_KEY = "1e013698aab01a9b45a5af2da03c9fef";
export const WEATHER_API = {
  API_KEY: VALID_API_KEY, // Force use of the valid key
  BASE_URL: WEATHER_API_BASE_URL || "https://api.openweathermap.org/data/2.5",
  UNITS: WEATHER_API_UNITS || "metric", // Use Celsius
};

// Add API key validation log without displaying the full key
if (WEATHER_API.API_KEY) {
  const keyPrefix = WEATHER_API.API_KEY.substring(0, 4);
  const keySuffix = WEATHER_API.API_KEY.substring(WEATHER_API.API_KEY.length - 4);
  console.log(`API key configured: ${keyPrefix}...${keySuffix} (length: ${WEATHER_API.API_KEY.length})`);
} else {
  console.warn("Warning: No valid API key detected");
}

// Cache configuration
export const CACHE = {
  // Weather data cache duration (milliseconds)
  WEATHER_CACHE_DURATION:
    (parseInt(WEATHER_CACHE_DURATION_HOURS) || 3) * 60 * 60 * 1000,
  // Minimum distance change to trigger refresh (meters)
  LOCATION_CHANGE_THRESHOLD:
    (parseInt(LOCATION_CHANGE_THRESHOLD_KM) || 5) * 1000,
};

// Error types
export const ERROR_TYPES = {
  NETWORK: "NETWORK_ERROR",
  API: "API_ERROR",
  PERMISSION: "PERMISSION_ERROR",
  LOCATION: "LOCATION_ERROR",
  UNKNOWN: "UNKNOWN_ERROR",
};

// AsyncStorage keys
export const STORAGE_KEYS = {
  WEATHER_DATA: "currentWeatherData",
  LAST_LOCATION: "lastLocationCoords",
  JOURNAL: "journal",
};
