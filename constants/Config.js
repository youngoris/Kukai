/**
 * Application configuration constants
 */
import {
  WEATHER_API_KEY,
  WEATHER_API_BASE_URL,
  WEATHER_API_UNITS,
  WEATHER_CACHE_DURATION_HOURS,
  LOCATION_CHANGE_THRESHOLD_KM
} from '@env';

// Weather API configuration
export const WEATHER_API = {
  API_KEY: WEATHER_API_KEY || '847915028262f4981a07546eb43696ce',
  BASE_URL: WEATHER_API_BASE_URL || 'https://api.openweathermap.org/data/2.5',
  UNITS: WEATHER_API_UNITS || 'metric', // Use Celsius
};

// Cache configuration
export const CACHE = {
  // Weather data cache duration (milliseconds)
  WEATHER_CACHE_DURATION: (parseInt(WEATHER_CACHE_DURATION_HOURS) || 3) * 60 * 60 * 1000,
  // Minimum distance change to trigger refresh (meters)
  LOCATION_CHANGE_THRESHOLD: (parseInt(LOCATION_CHANGE_THRESHOLD_KM) || 5) * 1000,
};

// Error types
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  LOCATION: 'LOCATION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

// AsyncStorage keys
export const STORAGE_KEYS = {
  WEATHER_DATA: 'currentWeatherData',
  LAST_LOCATION: 'lastLocationCoords',
  JOURNAL: 'journal',
}; 