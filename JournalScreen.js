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
import { MaterialIcons } from '@expo/vector-icons';
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
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);

      const days = [];
      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(currentYear, currentMonth, i + 1);
        const dateString = date.toISOString().split('T')[0];
        const hasEntry = await AsyncStorage.getItem(`journal_${dateString}`);
        days[i] = !!hasEntry;
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
            temperature: todayJournal.temperature
          });
        } else {
          setSavedJournal('');
          setSavedToday(false);
        }
      }

      let currentStreak = 0;
      for (let i = 0; i < days.length; i++) {
        if (days[i]) currentStreak++;
        else break;
      }
      setStreak(currentStreak);

      const monthCounts = Array(12).fill(0);
      const journalKeys = await AsyncStorage.getAllKeys();
      const journalEntries = journalKeys.filter(key => key.startsWith('journal_'));
      
      journalEntries.forEach(key => {
        const date = key.replace('journal_', '');
        const year = parseInt(date.split('-')[0]);
        if (year === currentYear) {
          const month = parseInt(date.split('-')[1]) - 1;
          monthCounts[month]++;
        }
      });
      setEntriesByMonth(monthCounts);
    } catch (error) {
      console.error('Error loading journal data:', error);
    }
  };

  const renderDayDots = () => {
    const todayDate = new Date().getDate();
    return entriesByDay.map((hasEntry, index) => {
      const isToday = index === todayDate - 1;
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

  // Rest of the component (saveJournal, clearJournal, renderMonthBars, etc.) remains unchanged

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
                  {entriesByMonth.map((count, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.monthDot,
                        count > 0 && styles.monthDotActive
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
            
            <View style={styles.calendarContainer}>
              <Text style={styles.calendarLabel}>This Month</Text>
              <View style={styles.calendarDots}>
                {renderDayDots()}
              </View>
            </View>
            
            <View style={styles.journalContainer}>
              <Text style={styles.journalLabel}>Today's Reflections</Text>
              <TouchableOpacity 
                style={styles.journalButton}
                onPress={() => navigation.navigate('JournalEdit', {
                  savedJournal: savedJournal,
                  date: today
                })}
              >
                <MaterialIcons name="edit" size={22} color="#CCCCCC" />
                <Text style={styles.journalButtonText}>
                  {savedJournal ? 'Edit today\'s journal' : 'Write in your journal'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.sectionTitle}>Journal Entries</Text>
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
              viewOnly: true
            })}
          >
            <View style={styles.journalItemContent}>
              <Text style={styles.journalItemDate}>
                {new Date(item.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
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
  monthDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', margin: 4 },
  monthDotActive: { backgroundColor: '#FFFFFF' },
  calendarContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30 },
  calendarLabel: { color: '#aaa', fontSize: 14, marginBottom: 12 },
  calendarDots: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDot: { width: CALENDAR_DOT_SIZE, height: CALENDAR_DOT_SIZE, borderRadius: CALENDAR_DOT_SIZE / 2, margin: 3 },
  emptyDot: { backgroundColor: '#222' },
  filledDot: { backgroundColor: '#FFFFFF' },
  todayDot: { borderWidth: 2, borderColor: '#FFFFFF' },
  journalContainer: { backgroundColor: '#111', borderRadius: 12, padding: 20, marginBottom: 40 },
  journalLabel: { color: '#aaa', fontSize: 14, marginBottom: 15 },
  journalButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
  journalButtonText: { color: '#CCCCCC', fontSize: 16, marginLeft: 10 },
  sectionTitle: { color: '#aaa', fontSize: 16, fontWeight: '500', marginBottom: 15 },
  journalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 10 },
  journalItemContent: { flex: 1 },
  journalItemDate: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  journalItemPreview: { color: '#aaa', fontSize: 14 },
  emptyText: { color: '#666', fontSize: 14, textAlign: 'center', padding: 20 },
  flatListContent: { paddingHorizontal: 20, paddingBottom: 40 }
});

export default JournalScreen;