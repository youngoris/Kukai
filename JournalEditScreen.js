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
import useWeather from './utils/useWeather'; // 导入天气Hook

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

  // 使用自定义Hook获取天气数据，但不自动获取
  const { 
    fetchWeather: fetchWeatherData,
    getWeatherIcon
  } = useWeather({ autoFetch: false });

  // 键盘监听器
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 获取位置和天气数据
  const getLocationAndWeather = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // 使用useWeather Hook获取天气数据
      const weatherResult = await fetchWeatherData(forceRefresh);
      
      if (weatherResult && !weatherResult.error) {
        // 设置天气数据，确保格式一致性
        setWeather(weatherResult.weather);
        setTemperature(weatherResult.temperature);
        setLocation(weatherResult.location);
      } else if (weatherResult && weatherResult.error) {
        setLocationError(weatherResult.error);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError({
        type: 'UNKNOWN_ERROR',
        message: 'Unable to fetch location',
        details: error.message
      });
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
      
      // 修改：即使有位置或天气数据，也尝试获取最新数据
      // 但不强制刷新，如果缓存有效则使用缓存
      await getLocationAndWeather(false);
    };
    
    initialize();
  }, []);

  // 添加刷新天气数据的函数
  const refreshWeatherData = async () => {
    if (viewOnly) return; // 在查看模式下不刷新
    await getLocationAndWeather(true); // 强制刷新
  };

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

  // 获取心情图标
  const getMoodIcon = (moodType) => {
    switch(moodType) {
      case 'happy': return 'emoticon-outline';
      case 'sad': return 'emoticon-sad-outline';
      case 'angry': return 'emoticon-angry-outline';
      case 'neutral': return 'emoticon-neutral-outline';
      case 'excited': return 'emoticon-excited-outline';
      default: return 'emoticon-outline';
    }
  };

  // 选择心情
  const selectMood = (selectedMood) => {
    setMood(selectedMood);
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
                  <MaterialCommunityIcons name={`weather-${getWeatherIcon(weather)}`} size={16} color="#AAAAAA" />
                  <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                    {weather}, {temperature}°C
                  </Text>
                  {!viewOnly && (
                    <TouchableOpacity 
                      onPress={refreshWeatherData}
                      style={styles.refreshButton}
                    >
                      <Feather name="refresh-cw" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : weather ? (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons name={`weather-${getWeatherIcon(weather)}`} size={16} color="#AAAAAA" />
                  <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                    {weather}
                  </Text>
                  {!viewOnly && (
                    <TouchableOpacity 
                      onPress={refreshWeatherData}
                      style={styles.refreshButton}
                    >
                      <Feather name="refresh-cw" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                !viewOnly && (
                  <TouchableOpacity 
                    onPress={refreshWeatherData}
                    style={styles.infoItem}
                  >
                    <Feather name="cloud" size={16} color="#AAAAAA" />
                    <Text style={styles.infoText}>Update weather</Text>
                  </TouchableOpacity>
                )
              )}
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
    flexWrap: 'nowrap', // 防止换行
    maxWidth: '80%', // 限制最大宽度
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 1, // 允许收缩
  },
  infoText: {
    color: '#CCCCCC',
    marginLeft: 5,
    fontSize: 14,
    flexShrink: 1, // 允许文本收缩
    maxWidth: 180, // 限制最大宽度
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
    marginLeft: 5,
  },
  moodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodItem: {
    marginLeft: 5,
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
  refreshButton: {
    marginLeft: 8,
    padding: 3,
  },
});

export default JournalEditScreen;