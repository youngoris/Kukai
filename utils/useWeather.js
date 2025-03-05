import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEATHER_API, CACHE, ERROR_TYPES, STORAGE_KEYS } from '../constants/Config';

/**
 * 自定义Hook - 天气数据获取
 * @param {Object} options 配置选项
 * @param {boolean} options.autoFetch 是否自动获取天气数据
 * @param {number} options.refreshInterval 自动刷新间隔（毫秒）
 * @returns {Object} 天气数据和控制函数
 */
export default function useWeather(options = {}) {
  const { 
    autoFetch = true, 
    refreshInterval = 60 * 60 * 1000 // 默认1小时
  } = options;
  
  const [weather, setWeather] = useState(null);
  const [temperature, setTemperature] = useState(null);
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'cache' 或 'api'
  
  /**
   * 获取天气数据
   * @param {boolean} forceRefresh 是否强制刷新
   * @returns {Promise<Object|null>} 天气数据或null
   */
  const fetchWeather = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 如果不是强制刷新，尝试从缓存获取
      if (!forceRefresh) {
        const savedWeatherData = await AsyncStorage.getItem(STORAGE_KEYS.WEATHER_DATA);
        const savedLocationCoords = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        
        if (savedWeatherData) {
          const parsedWeatherData = JSON.parse(savedWeatherData);
          const savedTimestamp = new Date(parsedWeatherData.timestamp);
          const currentTime = new Date();
          
          // 如果天气数据不超过配置的缓存时间，直接使用缓存的数据
          if ((currentTime - savedTimestamp) < CACHE.WEATHER_CACHE_DURATION) {
            console.log('使用缓存的天气数据');
            setWeather({
              main: parsedWeatherData.weather,
              icon: parsedWeatherData.icon || 'weather-partly-cloudy'
            });
            setTemperature(parsedWeatherData.temperature);
            setLocation(parsedWeatherData.location);
            setSource('cache');
            setIsLoading(false);
            
            // 检查位置是否发生显著变化，如果是则刷新数据
            if (savedLocationCoords && !forceRefresh) {
              try {
                // 获取当前位置
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                  const currentLocation = await Location.getCurrentPositionAsync({});
                  const parsedLastLocation = JSON.parse(savedLocationCoords);
                  
                  // 计算距离变化
                  const distance = calculateDistance(
                    currentLocation.coords.latitude,
                    currentLocation.coords.longitude,
                    parsedLastLocation.latitude,
                    parsedLastLocation.longitude
                  );
                  
                  // 如果位置变化小于配置的阈值，使用缓存数据
                  if (distance <= CACHE.LOCATION_CHANGE_THRESHOLD / 1000) {
                    return {
                      weather: parsedWeatherData.weather,
                      temperature: parsedWeatherData.temperature,
                      location: parsedWeatherData.location,
                      source: 'cache',
                      icon: parsedWeatherData.icon
                    };
                  }
                  // 否则继续执行获取新数据的逻辑
                }
              } catch (locationError) {
                console.error('检查位置变化时出错:', locationError);
                // 如果不是强制刷新，出错时继续使用缓存数据
                if (!forceRefresh) {
                  return {
                    weather: parsedWeatherData.weather,
                    temperature: parsedWeatherData.temperature,
                    location: parsedWeatherData.location,
                    source: 'cache',
                    icon: parsedWeatherData.icon
                  };
                }
              }
            } else if (!forceRefresh) {
              return {
                weather: parsedWeatherData.weather,
                temperature: parsedWeatherData.temperature,
                location: parsedWeatherData.location,
                source: 'cache',
                icon: parsedWeatherData.icon
              };
            }
          }
        }
      }
      
      // 请求位置权限
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const permissionError = {
          type: ERROR_TYPES.PERMISSION,
          message: '位置权限被拒绝',
          details: '无法获取天气数据，请在设置中允许位置权限'
        };
        setError(permissionError);
        setIsLoading(false);
        return { error: permissionError };
      }
      
      // 获取当前位置
      const locationData = await Location.getCurrentPositionAsync({});
      if (!locationData) {
        const locationError = {
          type: ERROR_TYPES.LOCATION,
          message: '无法获取位置信息',
          details: '请确保位置服务已开启'
        };
        setError(locationError);
        setIsLoading(false);
        return { error: locationError };
      }
      
      const { latitude, longitude } = locationData.coords;
      
      // 保存位置信息用于后续比较
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      }));
      
      // 使用OpenWeather API获取天气数据
      const url = `${WEATHER_API.BASE_URL}/weather?lat=${latitude}&lon=${longitude}&units=${WEATHER_API.UNITS}&appid=${WEATHER_API.API_KEY}`;
      
      // 添加超时处理
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('天气API响应错误:', response.status, errorText);
        
        const apiError = {
          type: ERROR_TYPES.API,
          message: `天气数据获取失败: ${response.status}`,
          details: errorText
        };
        setError(apiError);
        setIsLoading(false);
        return { error: apiError };
      }
      
      const weatherData = await response.json();
      
      // 设置状态
      const weatherMain = weatherData.weather[0].main;
      const weatherIcon = weatherData.weather[0].icon;
      const temp = Math.round(weatherData.main.temp);
      const locationName = weatherData.name;
      
      setWeather({
        main: weatherMain,
        icon: weatherIcon
      });
      setTemperature(temp);
      setLocation(locationName);
      setSource('api');
      
      // 保存天气数据到AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.WEATHER_DATA, JSON.stringify({
        weather: weatherMain,
        icon: weatherIcon,
        temperature: temp,
        location: locationName,
        timestamp: new Date().toISOString(),
        data: weatherData
      }));
      
      setIsLoading(false);
      
      return {
        weather: weatherMain,
        temperature: temp,
        location: locationName,
        source: 'api',
        icon: weatherIcon
      };
    } catch (error) {
      console.error('获取天气数据时出错:', error);
      
      // 区分网络错误和其他错误
      let errorType = ERROR_TYPES.UNKNOWN;
      let errorMessage = `无法获取天气: ${error.message}`;
      
      if (error.name === 'AbortError') {
        errorType = ERROR_TYPES.NETWORK;
        errorMessage = '网络请求超时，无法获取天气数据';
      } else if (error.message.includes('network')) {
        errorType = ERROR_TYPES.NETWORK;
        errorMessage = '网络连接错误，无法获取天气数据';
      }
      
      const weatherError = {
        type: errorType,
        message: errorMessage,
        details: error.message
      };
      
      setError(weatherError);
      setIsLoading(false);
      
      return { error: weatherError };
    }
  }, []);
  
  // 计算两点之间的距离（公里）
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半径（公里）
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c;
    return distance;
  };
  
  // 角度转弧度
  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };
  
  // 获取天气图标名称
  const getWeatherIcon = (iconCode) => {
    // 如果iconCode是对象，尝试获取icon属性
    if (typeof iconCode === 'object' && iconCode !== null) {
      iconCode = iconCode.icon || iconCode.main || '';
    }
    
    // 转换为字符串并处理
    iconCode = String(iconCode || '');
    
    const weatherIcons = {
      // OpenWeather API图标代码
      '01d': 'sunny',
      '01n': 'night',
      '02d': 'partly-cloudy',
      '02n': 'night-partly-cloudy',
      '03d': 'cloudy',
      '03n': 'cloudy',
      '04d': 'cloudy',
      '04n': 'cloudy',
      '09d': 'pouring',
      '09n': 'pouring',
      '10d': 'rainy',
      '10n': 'rainy',
      '11d': 'lightning',
      '11n': 'lightning',
      '13d': 'snowy',
      '13n': 'snowy',
      '50d': 'fog',
      '50n': 'fog',
      
      // 天气状况名称
      'Sunny': 'sunny',
      'Clear': 'sunny',
      'Partly Cloudy': 'partly-cloudy',
      'Cloudy': 'cloudy',
      'Clouds': 'cloudy',
      'Overcast': 'cloudy',
      'Rain': 'rainy',
      'Rainy': 'rainy',
      'Drizzle': 'pouring',
      'Showers': 'pouring',
      'Thunderstorm': 'lightning',
      'Storm': 'lightning',
      'Thunder': 'lightning',
      'Snow': 'snowy',
      'Snowy': 'snowy',
      'Sleet': 'snowy-rainy',
      'Hail': 'hail',
      'Mist': 'fog',
      'Fog': 'fog',
      'Haze': 'hazy',
      'Dust': 'dust',
      'Smoke': 'smoke',
      'Tornado': 'hurricane',
      'Hurricane': 'hurricane',
      'Windy': 'windy',
    };
    
    // 尝试匹配完整的iconCode
    if (weatherIcons[iconCode]) {
      return weatherIcons[iconCode];
    }
    
    // 如果没有匹配，尝试部分匹配（例如，"Clear Sky" 应该匹配 "Clear"）
    for (const key in weatherIcons) {
      if (iconCode.toLowerCase().includes(key.toLowerCase())) {
        return weatherIcons[key];
      }
    }
    
    // 默认图标
    return 'partly-cloudy';
  };
  
  // 获取天气错误图标名称
  const getErrorIcon = () => {
    if (!error) return 'cloudy-alert';
    
    switch(error.type) {
      case ERROR_TYPES.PERMISSION:
        return 'account-alert';
      case ERROR_TYPES.NETWORK:
        return 'wifi-off';
      case ERROR_TYPES.API:
        return 'cloud-alert';
      case ERROR_TYPES.LOCATION:
        return 'map-marker-alert';
      default:
        return 'cloudy-alert';
    }
  };
  
  // 自动获取天气数据
  useEffect(() => {
    if (autoFetch) {
      fetchWeather();
      
      // 添加定时刷新
      if (refreshInterval > 0) {
        const interval = setInterval(() => {
          fetchWeather(false); // 不强制刷新，让缓存和位置变化逻辑决定是否需要刷新
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
    getErrorIcon
  };
}