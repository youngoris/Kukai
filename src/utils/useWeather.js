/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import storageService from "../services/storage/StorageService";
import {
  WEATHER_API,
  CACHE,
  ERROR_TYPES,
  STORAGE_KEYS,
} from "../constants/Config";

/**
 * Custom Hook - Weather data fetching
 * @param {Object} options Configuration options
 * @param {boolean} options.autoFetch Whether to automatically fetch weather data
 * @param {number} options.refreshInterval Auto refresh interval (milliseconds)
 * @returns {Object} Weather data and control functions
 */
export default function useWeather(options = {}) {
  const {
    autoFetch = true,
    refreshInterval = 60 * 60 * 1000, // Default 1 hour
  } = options;

  const [weather, setWeather] = useState(null);
  const [temperature, setTemperature] = useState(null);
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'cache' or 'api'

  /**
   * Get weather data
   * @param {boolean} forceRefresh Whether to force refresh
   * @returns {Promise<Object|null>} Weather data or null
   */
  const fetchWeather = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // If not forced refresh, try to get from cache
      if (!forceRefresh) {
        const savedWeatherData = await storageService.getItem(
          STORAGE_KEYS.WEATHER_DATA,
        );
        const savedLocationCoords = await storageService.getItem(
          STORAGE_KEYS.LAST_LOCATION,
        );

        if (savedWeatherData) {
          const parsedWeatherData = JSON.parse(savedWeatherData);
          const savedTimestamp = new Date(parsedWeatherData.timestamp);
          const currentTime = new Date();

          // If weather data is not older than the configured cache duration, use cached data
          if (currentTime - savedTimestamp < CACHE.WEATHER_CACHE_DURATION) {
            console.log("Using cached weather data");
            setWeather({
              main: parsedWeatherData.weather,
              icon: parsedWeatherData.icon || "weather-partly-cloudy",
            });
            setTemperature(parsedWeatherData.temperature);
            setLocation(parsedWeatherData.location);
            setSource("cache");
            setIsLoading(false);

            // Check if location has changed significantly, if so refresh data
            if (savedLocationCoords && !forceRefresh) {
              try {
                // Get current location
                const { status } =
                  await Location.requestForegroundPermissionsAsync();
                if (status === "granted") {
                  const currentLocation =
                    await Location.getCurrentPositionAsync({});
                  const parsedLastLocation = JSON.parse(savedLocationCoords);

                  // Calculate distance change
                  const distance = calculateDistance(
                    currentLocation.coords.latitude,
                    currentLocation.coords.longitude,
                    parsedLastLocation.latitude,
                    parsedLastLocation.longitude,
                  );

                  // If location change is less than the configured threshold, use cached data
                  if (distance <= CACHE.LOCATION_CHANGE_THRESHOLD / 1000) {
                    return {
                      weather: parsedWeatherData.weather,
                      temperature: parsedWeatherData.temperature,
                      location: parsedWeatherData.location,
                      source: "cache",
                      icon: parsedWeatherData.icon,
                    };
                  }
                  // Otherwise continue with fetching new data
                }
              } catch (locationError) {
                console.error("Error checking location change:", locationError);
                // If not forced refresh, continue using cached data on error
                if (!forceRefresh) {
                  return {
                    weather: parsedWeatherData.weather,
                    temperature: parsedWeatherData.temperature,
                    location: parsedWeatherData.location,
                    source: "cache",
                    icon: parsedWeatherData.icon,
                  };
                }
              }
            } else if (!forceRefresh) {
              return {
                weather: parsedWeatherData.weather,
                temperature: parsedWeatherData.temperature,
                location: parsedWeatherData.location,
                source: "cache",
                icon: parsedWeatherData.icon,
              };
            }
          }
        }
      }

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        const permissionError = {
          type: ERROR_TYPES.PERMISSION,
          message: "Location permission denied",
          details:
            "Unable to get weather data, please allow location permission in settings",
        };
        setError(permissionError);
        setIsLoading(false);
        return { error: permissionError };
      }

      // Check if location services are enabled
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServicesEnabled) {
        const locationError = {
          type: ERROR_TYPES.LOCATION,
          message: "Location services disabled",
          details: "Please enable location services in device settings",
        };
        setError(locationError);
        setIsLoading(false);
        return { error: locationError };
      }

      // Get current location
      let locationData;
      try {
        locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
        });
        
        if (!locationData) {
          throw new Error("Location data unavailable");
        }
        
        // Save location coordinates for future reference
        await storageService.setItem(
          STORAGE_KEYS.LAST_LOCATION,
          JSON.stringify({
            latitude: locationData.coords.latitude,
            longitude: locationData.coords.longitude,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (locationError) {
        const errorObj = {
          type: ERROR_TYPES.LOCATION,
          message: "Unable to get location information",
          details: locationError.message || "Please ensure location services are enabled",
        };
        setError(errorObj);
        setIsLoading(false);
        return { error: errorObj };
      }

      const { latitude, longitude } = locationData.coords;

      // Use OpenWeather API to get weather data
      const url = `${WEATHER_API.BASE_URL}/weather?lat=${latitude}&lon=${longitude}&units=${WEATHER_API.UNITS}&appid=${WEATHER_API.API_KEY}`;

      // Log API request information without exposing the key
      console.log("Making Weather API request:", {
        baseUrl: WEATHER_API.BASE_URL,
        units: WEATHER_API.UNITS,
        endpoint: "/weather",
        coordinates: `lat=${latitude}&lon=${longitude}`,
        keySource: "Current configuration",
        keyLength: WEATHER_API.API_KEY.length,
        keyStart: WEATHER_API.API_KEY.substring(0, 4),
        keyEnd: WEATHER_API.API_KEY.substring(WEATHER_API.API_KEY.length - 4),
      });

      // Debug: Show API key being used
      console.log("Using API key: " + WEATHER_API.API_KEY.substring(0, 4) + "..." + WEATHER_API.API_KEY.substring(WEATHER_API.API_KEY.length - 4));

      // Add timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

      try {
        // Log the full URL for debugging (with key hidden)
        const debugUrl = url.replace(WEATHER_API.API_KEY, "API_KEY_HIDDEN");
        console.log("Full request URL (key hidden):", debugUrl);
        
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Weather API response error:",
            response.status,
            errorText,
            "\nURL:", url.replace(WEATHER_API.API_KEY, "API_KEY_HIDDEN") // Hide API key but show URL structure
          );

          // Special handling for 401 errors
          if (response.status === 401) {
            // Try direct test of the API key with a simple request
            console.log("Testing API key with a direct fetch...");
            try {
              const testUrl = `https://api.openweathermap.org/data/2.5/weather?q=London&appid=${WEATHER_API.API_KEY}`;
              const testResponse = await fetch(testUrl);
              console.log("Test API response status:", testResponse.status);
              
              const apiError = {
                type: ERROR_TYPES.API,
                message: `API authentication failed (401): API key may be invalid or expired`,
                details: `Please check if your OpenWeatherMap API key is valid. Key: ${WEATHER_API.API_KEY.substring(0, 4)}...${WEATHER_API.API_KEY.substring(WEATHER_API.API_KEY.length - 4)} (length: ${WEATHER_API.API_KEY.length}). Test response: ${testResponse.status}`,
              };
              setError(apiError);
              setIsLoading(false);
              return { error: apiError };
            } catch (testError) {
              console.error("API key test failed:", testError);
              const apiError = {
                type: ERROR_TYPES.API,
                message: `API authentication failed (401): API key may be invalid or expired`,
                details: `Please check if your OpenWeatherMap API key is valid. Key: ${WEATHER_API.API_KEY.substring(0, 4)}...${WEATHER_API.API_KEY.substring(WEATHER_API.API_KEY.length - 4)} (length: ${WEATHER_API.API_KEY.length}). Test error: ${testError.message}`,
              };
              setError(apiError);
              setIsLoading(false);
              return { error: apiError };
            }
          }

          const apiError = {
            type: ERROR_TYPES.API,
            message: `Failed to get weather data: ${response.status}`,
            details: errorText,
          };
          setError(apiError);
          setIsLoading(false);
          return { error: apiError };
        }

        const weatherData = await response.json();
        console.log("Weather API response successful:", {
          city: weatherData.name,
          weatherCondition: weatherData.weather[0].main,
          responseStatus: response.status,
        });

        // Set states
        const weatherMain = weatherData.weather[0].main;
        const weatherIcon = weatherData.weather[0].icon;
        const temp = Math.round(weatherData.main.temp);
        const locationName = weatherData.name;

        setWeather({
          main: weatherMain,
          icon: weatherIcon,
        });
        setTemperature(temp);
        setLocation(locationName);
        setSource("api");

        // Save weather data to AsyncStorage
        await storageService.setItem(
          STORAGE_KEYS.WEATHER_DATA,
          JSON.stringify({
            weather: weatherMain,
            icon: getWeatherIcon(weatherIcon),
            temperature: temp,
            location: locationName,
            timestamp: new Date().toISOString(),
          })
        );

        setIsLoading(false);
        return {
          weather: weatherMain,
          temperature: temp,
          location: locationName,
          source: "api",
          icon: getWeatherIcon(weatherIcon),
        };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Fetch error:", error.message);
        
        // Handle abort error separately
        if (error.name === 'AbortError') {
          const timeoutError = {
            type: ERROR_TYPES.NETWORK,
            message: "Request timeout",
            details: "Weather API request timed out, please check your network connection",
          };
          setError(timeoutError);
          setIsLoading(false);
          return { error: timeoutError };
        }
        
        // Handle network errors
        const networkError = {
          type: ERROR_TYPES.NETWORK,
          message: "Network connection error",
          details: error.message || "Please check your network connection", 
        };
        setError(networkError);
        setIsLoading(false);
        return { error: networkError };
      }
    } catch (error) {
      console.error("Error getting weather data:", error);

      // Distinguish between network errors and other errors
      let errorType = ERROR_TYPES.UNKNOWN;
      let errorMessage = `Unable to get weather: ${error.message}`;

      if (error.name === "AbortError") {
        errorType = ERROR_TYPES.NETWORK;
        errorMessage = "Network request timeout, unable to get weather data";
      } else if (error.message.includes("network")) {
        errorType = ERROR_TYPES.NETWORK;
        errorMessage = "Network connection error, unable to get weather data";
      }

      const weatherError = {
        type: errorType,
        message: errorMessage,
        details: error.message,
      };

      setError(weatherError);
      setIsLoading(false);

      return { error: weatherError };
    }
  }, []);

  // Calculate distance between two points (kilometers)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius (kilometers)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  // Convert degrees to radians
  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // Get weather icon name
  const getWeatherIcon = (iconCode) => {
    // If iconCode is an object, try to get the icon property
    if (typeof iconCode === "object" && iconCode !== null) {
      iconCode = iconCode.icon || iconCode.main || "";
    }

    // Convert to string and process
    iconCode = String(iconCode || "");

    const weatherIcons = {
      // OpenWeather API icon codes
      "01d": "sunny",
      "01n": "night",
      "02d": "partly-cloudy",
      "02n": "night-partly-cloudy",
      "03d": "cloudy",
      "03n": "cloudy",
      "04d": "cloudy",
      "04n": "cloudy",
      "09d": "pouring",
      "09n": "pouring",
      "10d": "rainy",
      "10n": "rainy",
      "11d": "lightning",
      "11n": "lightning",
      "13d": "snowy",
      "13n": "snowy",
      "50d": "fog",
      "50n": "fog",

      // Weather condition names
      Sunny: "sunny",
      Clear: "sunny",
      "Partly Cloudy": "partly-cloudy",
      Cloudy: "cloudy",
      Clouds: "cloudy",
      Overcast: "cloudy",
      Rain: "rainy",
      Rainy: "rainy",
      Drizzle: "pouring",
      Showers: "pouring",
      Thunderstorm: "lightning",
      Storm: "lightning",
      Thunder: "lightning",
      Snow: "snowy",
      Snowy: "snowy",
      Sleet: "snowy-rainy",
      Hail: "hail",
      Mist: "fog",
      Fog: "fog",
      Haze: "hazy",
      Dust: "dust",
      Smoke: "smoke",
      Tornado: "hurricane",
      Hurricane: "hurricane",
      Windy: "windy",
    };

    // Try to match the complete iconCode
    if (weatherIcons[iconCode]) {
      return weatherIcons[iconCode];
    }

    // If no match, try partial matching (e.g., "Clear Sky" should match "Clear")
    for (const key in weatherIcons) {
      if (iconCode.toLowerCase().includes(key.toLowerCase())) {
        return weatherIcons[key];
      }
    }

    // Default icon
    return "partly-cloudy";
  };

  // Get weather error icon name
  const getErrorIcon = () => {
    if (!error) return "cloudy-alert";

    switch (error.type) {
      case ERROR_TYPES.PERMISSION:
        return "account-alert";
      case ERROR_TYPES.NETWORK:
        return "wifi-off";
      case ERROR_TYPES.API:
        return "cloud-alert";
      case ERROR_TYPES.LOCATION:
        return "map-marker-off";
      default:
        return "cloudy-alert";
    }
  };

  // Get weather error message
  const getWeatherErrorMessage = () => {
    if (!error) return "Unknown error";

    switch (error.type) {
      case ERROR_TYPES.PERMISSION:
        return "Location permission denied";
      case ERROR_TYPES.NETWORK:
        return "Network error";
      case ERROR_TYPES.API:
        return "Weather service error";
      case ERROR_TYPES.LOCATION:
        return "NA";
      default:
        return "Weather unavailable";
    }
  };

  // Automatically fetch weather data
  useEffect(() => {
    if (autoFetch) {
      fetchWeather();

      // Add timed refresh
      if (refreshInterval > 0) {
        const interval = setInterval(() => {
          fetchWeather(false); // Don't force refresh, let cache and location change logic decide if refresh is needed
        }, refreshInterval);

        return () => clearInterval(interval);
      }
    }
  }, [autoFetch, fetchWeather, refreshInterval]);

  return {
    weather,
    temperature,
    location,
    isLoading,
    error,
    source,
    fetchWeather,
    getWeatherIcon,
    getErrorIcon,
    getWeatherErrorMessage,
  };
}
