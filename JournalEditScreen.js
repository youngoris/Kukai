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
import { MaterialIcons, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Markdown from 'react-native-markdown-display'; // 导入 Markdown 组件

const JournalEditScreen = ({ navigation, route }) => {
  const { savedJournal, date, viewOnly = false, location: routeLocation, weather: routeWeather, temperature: routeTemperature, mood: routeMood } = route.params;
  const [journalText, setJournalText] = useState(savedJournal || '');
  const [location, setLocation] = useState(routeLocation || '');
  const [weather, setWeather] = useState(routeWeather || '');
  const [temperature, setTemperature] = useState(routeTemperature || null);
  const [mood, setMood] = useState(routeMood || null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);

  // 监听键盘事件
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        const keyboardHeight = event.endCoordinates.height;
        console.log('Keyboard shown, height:', keyboardHeight);
        setKeyboardVisible(true);
        setKeyboardHeight(keyboardHeight);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        console.log('Keyboard hidden');
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 修改获取天气信息的部分，添加从API提取位置信息
  const getWeatherAndLocation = async (latitude, longitude) => {
    try {
      const API_KEY = '847915028262f4981a07546eb43696ce';
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

  // 修改位置获取函数以使用缓存的天气数据
  const getLocationAndWeather = async () => {
    setLoading(true);
    try {
      // 首先尝试从 AsyncStorage 获取缓存的天气数据
      const savedWeatherData = await AsyncStorage.getItem('currentWeatherData');
      
      if (savedWeatherData) {
        const parsedWeatherData = JSON.parse(savedWeatherData);
        setWeather(parsedWeatherData.weather);
        setTemperature(parsedWeatherData.temperature);
        setLocation(parsedWeatherData.location);
        setLoading(false);
        return;
      }
      
      // 如果没有缓存数据，则获取位置和天气
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

  // 修改 useEffect，优先使用传递的参数
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
            if (todayJournal.mood) setMood(todayJournal.mood);
          }
        }
      } catch (error) {
        console.error('Failed to load journal metadata:', error);
      }
    };

    const initialize = async () => {
      if (viewOnly) {
        // 如果是查看模式，使用传入的数据
        setLocation(routeLocation || '');
        setWeather(routeWeather || '');
        setTemperature(routeTemperature || null);
        setMood(routeMood || null);
        setLoading(false);
        return;
      }
      
      // 否则尝试从 AsyncStorage 加载或获取新数据
      await loadJournalMeta();
      
      // 如果没有位置或天气数据，则尝试获取
      if (!location || !weather) {
        await getLocationAndWeather();
      } else {
        setLoading(false);
      }
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
        mood: mood,
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
      
      // 保存后跳转到预览模式
      navigation.setParams({
        viewOnly: true,
        fromSave: true // 标记是从保存操作过来的
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

  // 获取心情图标
  const getMoodIcon = (moodType) => {
    switch(moodType) {
      case 'happy': return 'emoticon-happy-outline';
      case 'calm': return 'emoticon-neutral-outline';
      case 'sad': return 'emoticon-sad-outline';
      default: return null;
    }
  };

  // 选择心情
  const selectMood = (selectedMood) => {
    setMood(mood === selectedMood ? null : selectedMood);
  };

  // 自定义Markdown解析器配置
  const markdownParserOptions = {
    typographer: true,
    breaks: true,
  };

// Markdown 样式
const markdownStyles = {
  body: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'PingFang SC' : 'sans-serif',
  },
  // 标题 - 使用 heading1, heading2 等键名
  heading1: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    lineHeight: 36,
    fontFamily: Platform.OS === 'ios' ? 'PingFang SC' : 'sans-serif',
  },
  heading2: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 12,
    lineHeight: 32,
  },
  heading3: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
    lineHeight: 28,
  },
  heading4: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 6,
    lineHeight: 26,
  },
  heading5: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 4,
    lineHeight: 24,
  },
  heading6: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginVertical: 4,
    lineHeight: 24,
  },
  // 其他元素
  paragraph: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 28,
    marginVertical: 8,
  },
  // 修改列表项样式
  bullet_list: {
    marginLeft: 10,
  },
  ordered_list: {
    marginLeft: 10,
  },
  // React Native Markdown Display使用这些键名
  bullet_list_item: {
    color: '#FFF', 
    fontSize: 16,
    lineHeight: 28,
    marginVertical: 4,
    flexDirection: 'row',
  },
  ordered_list_item: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 28,
    marginVertical: 4,
    flexDirection: 'row',
  },
  bullet_list_content: {
    flex: 1,
    color: '#FFF',
  },
  ordered_list_content: {
    flex: 1,
    color: '#FFF',
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  link: {
    color: '#5E9EFF',
    textDecorationLine: 'underline',
  },
  code_inline: {
    backgroundColor: '#222',
    color: '#FFD700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 2,
    borderRadius: 3,
  },
  code_block: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 5,
    color: '#FFD700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#666',
    paddingLeft: 10,
    color: '#CCC',
    fontStyle: 'italic',
    marginVertical: 8,
  },
};

// 创建自定义渲染规则
const markdownRules = {
  heading1: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={[styles.heading1, { textAlign: 'left', letterSpacing: 0.5 }]}>
        {children}
      </Text>
    </View>
  ),
  heading2: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading2}>{children}</Text>
    </View>
  ),
  heading3: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading3}>{children}</Text>
    </View>
  ),
  heading4: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading4}>{children}</Text>
    </View>
  ),
  heading5: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading5}>{children}</Text>
    </View>
  ),
  heading6: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading6}>{children}</Text>
    </View>
  ),
};

// Markdown 组件使用
<ScrollView style={styles.contentScrollView} contentContainerStyle={{ paddingBottom: 20 }}>
  <Markdown
    style={markdownStyles}
    rules={markdownRules}
    markdownitOptions={{
      typographer: true,
      breaks: true,
    }}
  >
    {journalText}
  </Markdown>
</ScrollView>

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (viewOnly) {
            // 在预览模式下，返回按钮使用goBack()而非navigate
            navigation.goBack();
          } else {
            // 在编辑模式下，正常返回
            navigation.goBack();
          }
        }}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewOnly ? 'Journal Review' : 'Edit Journal'}
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
      
      {/* 日期和心情显示 - 仅在查看模式显示 */}
      {viewOnly && (
        <View style={styles.dateContainer}>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long',
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            {mood && (
              <MaterialCommunityIcons 
                name={getMoodIcon(mood)} 
                size={20} 
                color="#FFFFFF" 
                style={styles.dateMoodIcon}
              />
            )}
          </View>
        </View>
      )}
      
      {/* 主要输入/展示区域 */}
      {viewOnly ? (
        <ScrollView style={styles.contentScrollView} contentContainerStyle={{paddingBottom: 20}}>
          <Markdown 
            style={markdownStyles}
            rules={markdownRules}
            options={markdownParserOptions}
            mergeStyle={false}
          >{journalText}</Markdown>
        </ScrollView>
      ) : (
        <ScrollView 
          style={{flex: 1}} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1, 
            paddingBottom: keyboardVisible ? keyboardHeight + 60 : 20
          }}
        >
          <TextInput
            style={styles.editor}
            multiline
            autoFocus
            keyboardAppearance="dark"
            placeholder="Write your journal entry here... (supports markdown)"
            placeholderTextColor="#666"
            value={journalText}
            onChangeText={setJournalText}
          />
        </ScrollView>
      )}
      
      {/* 底部显示区域 */}
      <View style={[
        styles.infoBar, 
        keyboardVisible && !viewOnly ? {
          position: 'absolute', 
          bottom: keyboardHeight, 
          left: 0, 
          right: 0, 
          backgroundColor: '#000',
          borderTopWidth: 1,
          borderTopColor: '#222',
        } : {}
      ]}>
        {loading ? (
          <Text style={styles.loadingText}>Loading location and weather...</Text>
        ) : (
          <View style={styles.infoContainer}>
            <View style={styles.metaInfoContainer}>
              {location ? (
                <View style={styles.infoItem}>
                  <Feather name="map-pin" size={16} color="#AAAAAA" />
                  <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">{location}</Text>
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
                  <Text style={styles.infoText} numberOfLines={1}>
                    {weather}, {temperature}°C
                  </Text>
                </View>
              ) : weather ? (
                <View style={styles.infoItem}>
                  <Ionicons name={getWeatherIcon(weather)} size={16} color="#AAAAAA" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {weather}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* 预览模式下保持一致的布局 */}
            {viewOnly ? (
              <View style={{width: 90, height: 26}} />
            ) : (
              <View style={styles.moodSelector}>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood('happy')}
                >
                  <MaterialCommunityIcons 
                    name="emoticon-happy-outline" 
                    size={20} 
                    color={mood === 'happy' ? '#FFFFFF' : '#666666'} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood('calm')}
                >
                  <MaterialCommunityIcons 
                    name="emoticon-neutral-outline" 
                    size={20} 
                    color={mood === 'calm' ? '#FFFFFF' : '#666666'} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood('sad')}
                >
                  <MaterialCommunityIcons 
                    name="emoticon-sad-outline" 
                    size={20} 
                    color={mood === 'sad' ? '#FFFFFF' : '#666666'} 
                  />
                </TouchableOpacity>
              </View>
            )}
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
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#222',
    padding: 15,
    minHeight: 60, // 保持最小高度
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // 两端对齐
    alignItems: 'center', // 垂直居中
    width: '100%',
  },
  metaInfoContainer: {
    flexDirection: 'row', 
    alignItems: 'center', // 垂直居中
    flexShrink: 1, // 允许收缩
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
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
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  dateMoodIcon: {
    marginLeft: 10,
  },
  moodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodItem: {
    marginLeft: 10,
    padding: 3,
  },
  contentScrollView: {
    flex: 1,
    padding: 15,
  },
  contentText: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default JournalEditScreen;