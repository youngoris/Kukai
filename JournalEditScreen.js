import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  Alert,
  ScrollView
} from 'react-native';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Markdown from 'react-native-markdown-display'; // 导入 Markdown 组件

const JournalEditScreen = ({ navigation, route }) => {
  const { savedJournal, date, viewOnly = false } = route.params;
  const [journalText, setJournalText] = useState(savedJournal || '');
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState('');
  const [temperature, setTemperature] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);

  // 监听键盘事件
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 修改获取天气信息的部分，添加从API提取位置信息
  const getWeatherAndLocation = async (latitude, longitude) => {
    try {
      const API_KEY = 'your_api_key';
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('Weather data fetch failed');
      }
      
      const weatherData = await response.json();
      const temp = Math.round(weatherData.main.temp);
      const weatherCondition = weatherData.weather[0].main;
      const city = weatherData.name;
      const country = weatherData.sys.country;
      const locationFromWeather = city || '';
      
      setTemperature(temp);
      setWeather(weatherCondition);
      if (!location) {
        setLocation(locationFromWeather);
      }
      
      return {
        weather: weatherCondition,
        temperature: temp,
        location: locationFromWeather
      };
    } catch (error) {
      console.error('获取天气数据失败:', error);
      return null;
    }
  };

  // 修改位置获取函数以调用天气API
  const getLocationAndWeather = async () => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Permission to access location was denied');
        setLoading(false);
        return;
      }
      
      const locationData = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = locationData.coords;
      
      const weatherInfo = await getWeatherAndLocation(latitude, longitude);
      
      const geoResponse = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });
      
      if (geoResponse && geoResponse.length > 0 && !weatherInfo?.location) {
        const geo = geoResponse[0];
        let locationString = '';
        
        if (geo.city) {
          locationString = geo.city;
        } else if (geo.region) {
          locationString = geo.region;
        }
        
        if (geo.country && locationString) {
          locationString += `, ${geo.country}`;
        } else if (geo.country) {
          locationString = geo.country;
        }
        
        setLocation(locationString);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Unable to fetch location');
    } finally {
      setLoading(false);
    }
  };

  // 修改 useEffect，首先尝试从 AsyncStorage 获取天气数据
  useEffect(() => {
    const loadJournalMeta = async () => {
      try {
        const journalData = await AsyncStorage.getItem('journal');
        if (journalData) {
          const journals = JSON.parse(journalData);
          const todayJournal = journals.find(j => j.date === date);
          
          if (todayJournal) {
            if (todayJournal.location) setLocation(todayJournal.location);
            if (todayJournal.weather) setWeather(todayJournal.weather);
            if (todayJournal.temperature) setTemperature(todayJournal.temperature);
          }
        }
      } catch (error) {
        console.error('Failed to load journal metadata:', error);
      }
    };
    
    const getWeatherFromCache = async () => {
      try {
        const cachedWeather = await AsyncStorage.getItem('currentWeatherData');
        if (cachedWeather) {
          const weatherData = JSON.parse(cachedWeather);
          const isSameDay = date === new Date().toISOString().split('T')[0];
          const isRecent = new Date().getTime() - new Date(weatherData.timestamp).getTime() < 3600000;
          
          if (isSameDay && isRecent) {
            setWeather(weatherData.weather);
            setTemperature(weatherData.temperature);
            setLocation(weatherData.location);
            setLoading(false);
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error('Error getting cached weather data:', error);
        return false;
      }
    };
    
    const initialize = async () => {
      await loadJournalMeta();
      if (weather && location) {
        setLoading(false);
        return;
      }
      
      const gotCachedWeather = await getWeatherFromCache();
      if (gotCachedWeather) {
        return;
      }
      
      await getLocationAndWeather();
    };
    
    initialize();
  }, []);

  // 保存日志
  const saveJournal = async () => {
    if (journalText.trim() === '') {
      Alert.alert("Error", "Journal content cannot be empty");
      return;
    }

    try {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      const previewText = journalText.length > 20 
        ? journalText.substring(0, 20) + '...' 
        : journalText;
      
      const title = `${formattedDate}: ${previewText}`;
      
      const journalEntry = {
        title: title,
        text: journalText.trim(),
        date: date,
        location: location,
        weather: weather,
        temperature: temperature,
        timestamp: new Date().toISOString()
      };

      const journalData = await AsyncStorage.getItem('journal');
      let journals = [];
      
      if (journalData) {
        journals = JSON.parse(journalData);
        journals = journals.filter(entry => entry.date !== date);
      }
      
      journals.push(journalEntry);
      
      await AsyncStorage.setItem('journal', JSON.stringify(journals));
      await AsyncStorage.setItem(`journal_${date}`, journalText.trim());
      
      navigation.navigate('Journal', { 
        savedJournal: journalText,
        journalMeta: {
          location: location,
          weather: weather,
          temperature: temperature,
          title: title
        },
        refreshJournal: true 
      });
    } catch (error) {
      console.error('Failed to save journal:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
  };

  // 获取天气图标
  const getWeatherIcon = (weatherType) => {
    switch(weatherType) {
      case 'Sunny': return 'sunny-outline';
      case 'Cloudy': return 'cloud-outline';
      case 'Rainy': return 'rainy-outline';
      case 'Storm': return 'thunderstorm-outline';
      case 'Snow': return 'snow-outline';
      case 'Clear': return 'moon-outline';
      default: return 'partly-sunny-outline';
    }
  };

  // Markdown 样式
  const markdownStyles = {
    text: {
      color: '#FFF',
      fontSize: 16,
      lineHeight: 24,
    },
    heading1: {
      color: '#FFF',
      fontSize: 24,
      fontWeight: 'bold',
      marginVertical: 10,
    },
    heading2: {
      color: '#FFF',
      fontSize: 20,
      fontWeight: 'bold',
      marginVertical: 8,
    },
    heading3: {
      color: '#FFF',
      fontSize: 18,
      fontWeight: 'bold',
      marginVertical: 6,
    },
    paragraph: {
      color: '#FFF',
      fontSize: 16,
      lineHeight: 24,
      marginVertical: 5,
    },
    listItem: {
      color: '#FFF',
      fontSize: 16,
      lineHeight: 24,
    },
    strong: {
      fontWeight: 'bold',
    },
    em: {
      fontStyle: 'italic',
    },
    link: {
      color: '#1E90FF',
      textDecorationLine: 'underline',
    },
    code: {
      backgroundColor: '#222',
      padding: 10,
      borderRadius: 5,
      color: '#FFF',
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: '#666',
      paddingLeft: 10,
      color: '#CCC',
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewOnly ? 'Journal Entry' : 'Edit Journal'}
        </Text>
        {!viewOnly && (
          <TouchableOpacity onPress={saveJournal}>
            <MaterialIcons name="check" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {viewOnly && (
          <TouchableOpacity onPress={() => {
            navigation.setParams({
              viewOnly: false
            });
          }}>
            <MaterialIcons name="edit" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* 日期显示 - 仅在查看模式显示 */}
      {viewOnly && (
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {new Date(date).toLocaleDateString('en-US', { 
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        </View>
      )}
      
      {/* 主要输入/展示区域 */}
      {viewOnly ? (
        <ScrollView style={styles.contentScrollView}>
          <Markdown style={markdownStyles}>{journalText}</Markdown>
        </ScrollView>
      ) : (
        <TextInput
          style={styles.editor}
          multiline
          autoFocus
          placeholder="Write your journal entry here... (supports markdown)"
          placeholderTextColor="#666"
          value={journalText}
          onChangeText={setJournalText}
        />
      )}
      
      {/* 底部显示区域 */}
      <View style={styles.infoBar}>
        {loading ? (
          <Text style={styles.loadingText}>Loading location and weather...</Text>
        ) : (
          <View style={styles.infoContainer}>
            {location ? (
              <View style={styles.infoItem}>
                <Feather name="map-pin" size={16} color="#AAAAAA" />
                <Text style={styles.infoText}>{location}</Text>
              </View>
            ) : locationError ? (
              <View style={styles.infoItem}>
                <Feather name="alert-circle" size={16} color="#AAAAAA" />
                <Text style={styles.infoText}>Location unavailable</Text>
              </View>
            ) : null}
            
            {weather && temperature ? (
              <View style={styles.infoItem}>
                <Ionicons name={getWeatherIcon(weather)} size={16} color="#AAAAAA" />
                <Text style={styles.infoText}>
                  {weather}, {temperature}°C
                  {location && ` • ${location}`}
                </Text>
              </View>
            ) : weather ? (
              <View style={styles.infoItem}>
                <Ionicons name={getWeatherIcon(weather)} size={16} color="#AAAAAA" />
                <Text style={styles.infoText}>
                  {weather}
                  {location && ` • ${location}`}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  editor: {
    flex: 1,
    padding: 20,
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  infoBar: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
    padding: 15,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 5,
  },
  infoText: {
    color: '#CCCCCC',
    marginLeft: 8,
    fontSize: 14,
  },
  loadingText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
  },
  dateContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#111',
  },
  dateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  contentScrollView: {
    flex: 1,
    padding: 20,
  },
  contentText: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default JournalEditScreen;