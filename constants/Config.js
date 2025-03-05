/**
 * 应用配置常量
 */
import {
  WEATHER_API_KEY,
  WEATHER_API_BASE_URL,
  WEATHER_API_UNITS,
  WEATHER_CACHE_DURATION_HOURS,
  LOCATION_CHANGE_THRESHOLD_KM
} from '@env';

// 天气API配置
export const WEATHER_API = {
  API_KEY: WEATHER_API_KEY || '847915028262f4981a07546eb43696ce',
  BASE_URL: WEATHER_API_BASE_URL || 'https://api.openweathermap.org/data/2.5',
  UNITS: WEATHER_API_UNITS || 'metric', // 使用摄氏度
};

// 缓存配置
export const CACHE = {
  // 天气数据缓存时间（毫秒）
  WEATHER_CACHE_DURATION: (parseInt(WEATHER_CACHE_DURATION_HOURS) || 3) * 60 * 60 * 1000,
  // 位置变化触发刷新的最小距离（米）
  LOCATION_CHANGE_THRESHOLD: (parseInt(LOCATION_CHANGE_THRESHOLD_KM) || 5) * 1000,
};

// 错误类型
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  LOCATION: 'LOCATION_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

// AsyncStorage 键名
export const STORAGE_KEYS = {
  WEATHER_DATA: 'currentWeatherData',
  LAST_LOCATION: 'lastLocationCoords',
  JOURNAL: 'journal',
}; 