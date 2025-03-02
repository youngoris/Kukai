import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Dimensions,
  Animated
} from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CALENDAR_DOT_SIZE = 8;

const JournalScreen = ({ navigation }) => {
  const [journalText, setJournalText] = useState('');
  const [today] = useState(new Date().toISOString().split('T')[0]);
  const [entriesByDay, setEntriesByDay] = useState([]);
  const [entriesByMonth, setEntriesByMonth] = useState(Array(12).fill(0));
  const [savedToday, setSavedToday] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [streak, setStreak] = useState(0);
  const [savedJournal, setSavedJournal] = useState('');
  const [savedJournalMeta, setSavedJournalMeta] = useState(null);
  const [allJournals, setAllJournals] = useState([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true })
    ]).start();
  }, []);

  useEffect(() => {
    loadJournalData();
  }, []);

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const loadJournalData = async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDate = now.getDate();
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);

      const days = Array(daysInMonth).fill(false);
      
      for (let i = 1; i <= daysInMonth; i++) {
        const month = String(currentMonth + 1).padStart(2, '0');
        const day = String(i).padStart(2, '0');
        const dateString = `${currentYear}-${month}-${day}`;
        
        const hasEntry = await AsyncStorage.getItem(`journal_${dateString}`);
        days[i-1] = !!hasEntry;
      }
      
      setEntriesByDay(days);

      const journalData = await AsyncStorage.getItem('journal');
      if (journalData) {
        const journals = JSON.parse(journalData);
        journals.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAllJournals(journals);

        const todayJournal = journals.find(j => j.date === today);
        if (todayJournal) {
          setSavedJournal(todayJournal.text);
          setSavedToday(true);
          setSavedJournalMeta({
            location: todayJournal.location,
            weather: todayJournal.weather,
            temperature: todayJournal.temperature,
            mood: todayJournal.mood
          });
        } else {
          setSavedJournal('');
          setSavedToday(false);
        }
      }

      // 修复连续记录计算
      // 使用相同的日期格式化函数获取今天的日期
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const todayFormatted = formatDate(now);
      const todayEntry = await AsyncStorage.getItem(`journal_${todayFormatted}`);
      let currentStreak = todayEntry ? 1 : 0;
      
      if (currentStreak > 0) {
        // 从昨天开始向前检查
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() - 1);
        
        while (true) {
          const dateStr = formatDate(checkDate);
          const hasEntry = await AsyncStorage.getItem(`journal_${dateStr}`);
          
          if (hasEntry) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
      
      setStreak(currentStreak);

      const monthStatus = Array(12).fill(0);
      const journalKeys = await AsyncStorage.getAllKeys();
      const journalEntries = journalKeys.filter(key => key.startsWith('journal_'));
      
      // 用于月度统计的计数数组
      const monthCounts = Array(12).fill(0);
      
      // 使用正确的日期格式分析journal键
      journalEntries.forEach(key => {
        const dateString = key.replace('journal_', '');
        // 确保日期格式正确：YYYY-MM-DD
        const dateParts = dateString.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1; // 月份从0开始
          
          if (year === currentYear && month >= 0 && month < 12) {
            monthCounts[month]++;
          }
        }
      });
      
      // 确定每个月的状态
      for (let i = 0; i < 12; i++) {
        if (monthCounts[i] === 0) {
          // 无日志
          monthStatus[i] = 0;
        } else {
          const daysInThisMonth = getDaysInMonth(currentYear, i);
          if (monthCounts[i] >= daysInThisMonth) {
            // 全部完成
            monthStatus[i] = 2;
          } else {
            // 部分完成
            monthStatus[i] = 1;
          }
        }
      }
      
      setEntriesByMonth(monthStatus);
    } catch (error) {
      console.error('Error loading journal data:', error);
    }
  };

  const renderDayDots = () => {
    const today = new Date();
    const todayDate = today.getDate();
    
    return entriesByDay.map((hasEntry, index) => {
      const day = index + 1;
      const isToday = day === todayDate;
      
      return (
        <View 
          key={index}
          style={[
            styles.calendarDot,
            hasEntry ? styles.filledDot : styles.emptyDot,
            isToday ? styles.todayDot : null
          ]}
        />
      );
    });
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

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.headerButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.headerText}>JOURNAL</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>CURRENT STREAK</Text>
                <Text style={styles.statValue}>{streak} <Text style={styles.statUnit}>days</Text></Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>RECORDS THIS YEAR</Text>
                <View style={styles.monthDotsContainer}>
                  {entriesByMonth.map((status, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.monthDot,
                        status === 1 ? styles.monthDotPartial : null,
                        status === 2 ? styles.monthDotActive : null
                      ]}
                    >
                      {status === 1 && (
                        <View style={styles.monthDotHalfFilled} />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
            
            <View style={styles.calendarContainer}>
              <Text style={styles.calendarLabel}>THIS MONTH</Text>
              <View style={styles.calendarDots}>
                {renderDayDots()}
              </View>
            </View>
            
            <View style={styles.journalContainer}>
              <Text style={styles.journalLabel}>TODAY'S REFLECTIONS</Text>
              <TouchableOpacity 
                style={styles.journalButton}
                onPress={() => navigation.navigate('JournalEdit', {
                  savedJournal: savedJournal,
                  date: today,
                  location: savedJournalMeta?.location,
                  weather: savedJournalMeta?.weather,
                  temperature: savedJournalMeta?.temperature,
                  mood: savedJournalMeta?.mood
                })}
              >
                <MaterialIcons name="edit" size={22} color="#CCCCCC" />
                <Text style={styles.journalButtonText}>
                  {savedJournal ? 'EDIT TODAY\'S JOURNAL' : 'WRITE IN YOUR JOURNAL'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sectionTitle}>JOURNAL LIST</Text>
          </>
        }
        data={allJournals}
        keyExtractor={item => item.date}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.journalItem}
            onPress={() => navigation.navigate('JournalEdit', {
              savedJournal: item.text,
              date: item.date,
              viewOnly: true,
              location: item.location,
              weather: item.weather,
              temperature: item.temperature,
              mood: item.mood
            })}
          >
            <View style={styles.journalItemContent}>
              <View style={styles.journalItemHeader}>
                <Text style={styles.journalItemDate}>
                  {new Date(item.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                {item.mood && (
                  <>
                    <Text style={{color: '#666', marginHorizontal: 1}}>·</Text>
                    <MaterialCommunityIcons 
                      name={getMoodIcon(item.mood)} 
                      size={16} 
                      color="#CCCCCC" 
                    />
                  </>
                )}
              </View>
              <Text style={styles.journalItemPreview} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#666" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No journal entries yet</Text>}
        contentContainerStyle={styles.flatListContent}
      />
    </SafeAreaView>
  );
};

// Styles remain unchanged
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 30, backgroundColor: '#000' },
  backButton: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  headerText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  headerSpacer: { width: 24 },
  headerButtonText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { backgroundColor: '#111', borderRadius: 12, padding: 15, width: '48%', height: 100, justifyContent: 'space-between' },
  statTitle: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  statValue: { color: '#fff', fontSize: 36, fontWeight: '300' },
  statUnit: { color: '#666', fontSize: 14 },
  monthDotsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  monthDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', margin: 4, overflow: 'hidden', position: 'relative' },
  monthDotActive: { backgroundColor: '#FFFFFF' },
  monthDotPartial: { backgroundColor: '#333' },
  monthDotHalfFilled: { 
    position: 'absolute',
    left: 0,
    top: 0,
    width: 6,
    height: 12,
    backgroundColor: '#FFFFFF'
  },
  calendarContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30, paddingHorizontal: 15 },
  calendarLabel: { color: '#aaa', fontSize: 14, marginBottom: 12 },
  calendarDots: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDot: { width: CALENDAR_DOT_SIZE, height: CALENDAR_DOT_SIZE, borderRadius: CALENDAR_DOT_SIZE / 2, margin: 3 },
  emptyDot: { backgroundColor: '#222' },
  filledDot: { backgroundColor: '#FFFFFF' },
  todayDot: { borderWidth: 2, borderColor: '#FFFFFF' },
  journalContainer: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginBottom: 20 },
  journalLabel: { color: '#aaa', fontSize: 14, marginBottom: 15 },
  journalButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  journalButtonText: { color: '#CCCCCC', fontSize: 16, marginLeft: 10 },
  sectionTitle: { color: '#aaa', fontSize: 16, fontWeight: '500', marginBottom: 15, paddingHorizontal: 15 },
  journalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 10 },
  journalItemContent: { flex: 1 },
  journalItemHeader: {
    flexDirection: 'row',
    alignItems: 'center', 
    marginBottom: 4,
  },
  journalItemDate: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '500',
  },
  journalItemMoodIcon: {
    marginLeft: 6,
  },
  journalItemPreview: { color: '#aaa', fontSize: 14 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', padding: 20 },
  flatListContent: { paddingHorizontal: 20, paddingBottom: 40 },
  journalItemMeta: { 
    color: '#888', 
    fontSize: 12, 
    marginBottom: 4 
  }
});

export default JournalScreen;