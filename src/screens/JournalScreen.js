/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  FlatList,
  Animated,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import storageService from "../services/storage/StorageService";
import { useFocusEffect } from "@react-navigation/native";
import { getSettingsWithDefaults } from "../utils/defaultSettings";
import CustomHeader from "../components/CustomHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJournalContext } from "../context/JournalContext";
import JournalDAO from "../dao/JournalDAO";

const CALENDAR_DOT_SIZE = 8;

const JournalScreen = ({ navigation }) => {
  const [today] = useState(new Date().toISOString().split("T")[0]);
  const [entriesByDay, setEntriesByDay] = useState([]);
  const [entriesByMonth, setEntriesByMonth] = useState(Array(12).fill(0));
  const [streak, setStreak] = useState(0);
  const [savedJournal, setSavedJournal] = useState("");
  const [savedJournalMeta, setSavedJournalMeta] = useState(null);
  const [savedToday, setSavedToday] = useState(false);
  const [allJournals, setAllJournals] = useState([]);
  const [appTheme, setAppTheme] = useState('dark');
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState("all"); // 'all', 'year', 'month', 'week'
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Define isLightTheme based on appTheme
  const isLightTheme = appTheme === 'light';

  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Get status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      try {
        const settings = await getSettingsWithDefaults();
        if (settings.appTheme) {
          setAppTheme(settings.appTheme);
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };
    
    loadUserSettings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadJournalData();
      return () => {
        // Cleanup function (if needed)
      };
    }, []),
  );

  useEffect(() => {
    RNStatusBar.setHidden(true);
    return () => RNStatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    loadJournalData();
  }, []);

  // 使用JournalContext
  const {
    entries,
    templates,
    loading: journalLoading,
    error: journalError,
    getEntriesInRange,
    deleteEntry,
    refreshJournal
  } = useJournalContext();

  // 在组件挂载和filterMode变化时加载日志条目
  useEffect(() => {
    loadJournals();
  }, [filterMode]);

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const loadJournalData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDate = now.getDate();
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);

      // 1. First, update the journal entries from the database via context
      await refreshJournal();
      
      // 2. Find today's entry from the entries list
      const todayEntry = entries.find(entry => entry.date === today);
      if (todayEntry) {
        setSavedJournal(todayEntry.text || "");
        setSavedToday(true);
        setSavedJournalMeta({
          location: todayEntry.location || null,
          weather: todayEntry.weather || null,
          temperature: todayEntry.temperature || null,
          mood: todayEntry.mood || null,
        });
      } else {
        setSavedJournal("");
        setSavedToday(false);
        setSavedJournalMeta(null);
      }
      
      // 3. Calculate the monthly calendar dots
      const days = Array(daysInMonth).fill(false);
      
      // Loop through all entries to mark days that have entries
      for (const entry of entries) {
        if (entry.date) {
          const entryDate = new Date(entry.date);
          // Check if it's for current month/year
          if (entryDate.getFullYear() === currentYear && entryDate.getMonth() === currentMonth) {
            const day = entryDate.getDate();
            if (day >= 1 && day <= daysInMonth) {
              days[day - 1] = true;
            }
          }
        }
      }
      setEntriesByDay(days);
      
      // 4. Load streak from AsyncStorage
      try {
        const storedStreak = await storageService.getItem("journal_streak");
        const parsedStreak = storedStreak ? parseInt(storedStreak, 10) : 0;
        setStreak(parsedStreak || 0);
      } catch (e) {
        console.error("Failed to load streak from storage:", e);
        setStreak(0);
      }
      
      // 5. Calculate new streak
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      
      let currentStreak = 0;
      let checkDate = new Date(now);
      
      // Check if there's an entry for today
      if (todayEntry) {
        // If there's an entry for today, streak is at least 1
        currentStreak = 1;
        // Check consecutive entries starting from yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // If no entry for today, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayFormatted = formatDate(checkDate);
        const yesterdayEntry = entries.find(entry => entry.date === yesterdayFormatted);
        
        if (yesterdayEntry) {
          // If there's an entry for yesterday, streak is 1
          currentStreak = 1;
          // Check consecutive entries starting from the day before yesterday
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
      
      // If streak is already started, continue checking earlier dates
      if (currentStreak > 0) {
        while (true) {
          const dateStr = formatDate(checkDate);
          const hasEntry = entries.some(entry => entry.date === dateStr);
          
          if (hasEntry) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
      
      // Save streak to AsyncStorage
      await storageService.setItem("journal_streak", currentStreak.toString());
      setStreak(currentStreak);
      
      // 6. Calculate entries by month for current year
      const monthCounts = Array(12).fill(0);
      
      for (const entry of entries) {
        if (entry.date) {
          const entryDate = new Date(entry.date);
          if (entryDate.getFullYear() === currentYear) {
            const month = entryDate.getMonth();
            if (month >= 0 && month < 12) {
              monthCounts[month]++;
            }
          }
        }
      }
      
      // Save monthly stats to AsyncStorage
      await storageService.setItem("journal_monthly_stats", JSON.stringify(monthCounts));
      setEntriesByMonth(monthCounts);
      
      // Finally, load journals for display
      await loadJournals();
    } catch (error) {
      console.error("Error loading journal data:", error);
    } finally {
      setLoading(false);
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
            isToday ? styles.todayDot : null,
          ]}
        />
      );
    });
  };

  // Get mood icon
  const getMoodIcon = (moodType) => {
    switch (moodType) {
      case "happy":
        return "emoticon-happy-outline";
      case "calm":
        return "emoticon-neutral-outline";
      case "sad":
        return "emoticon-sad-outline";
      default:
        return null;
    }
  };

  // Load journal entries based on filter mode
  const loadJournals = async () => {
    try {
      setLoading(true);
      
      // Get date range based on filter mode
      const { startDate, endDate } = getDateRange(filterMode);
      
      // Use Context to get entries in the specified date range
      const fetchedEntries = await getEntriesInRange(startDate, endDate);
      
      // Sort entries (by date descending)
      const sortedEntries = [...fetchedEntries].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
      });
      
      setJournalEntries(sortedEntries);
    } catch (error) {
      console.error("Error loading journals:", error);
    } finally {
      setLoading(false);
    }
  };

  // 根据筛选模式获取日期范围
  const getDateRange = (mode) => {
    const now = new Date();
    let startDate = new Date();
    const endDate = new Date();
    
    if (mode === "week") {
      // 设置为一周前
      startDate.setDate(now.getDate() - 7);
    } else if (mode === "month") {
      // 设置为一个月前
      startDate.setMonth(now.getMonth() - 1);
    } else if (mode === "year") {
      // 设置为一年前
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      // all - 设置为很久以前
      startDate = new Date(2000, 0, 1);
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // 切换筛选模式
  const toggleFilterMode = (mode) => {
    setFilterMode(mode);
  };

  // 处理删除日志条目
  const handleDeleteJournal = async (entryId) => {
    Alert.alert(
      "确认删除",
      "确定要删除这篇日志吗？此操作无法撤销。",
      [
        {
          text: "取消",
          style: "cancel"
        },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEntry(entryId);
              // 删除后刷新列表
              loadJournals();
            } catch (error) {
              console.error("删除日志时出错:", error);
              Alert.alert("错误", "删除日志时发生错误，请稍后再试。");
            }
          }
        }
      ]
    );
  };

  // 创建新日志
  const createNewJournal = () => {
    const today = new Date().toISOString().split("T")[0];
    navigation.navigate("JournalEdit", { date: today });
  };

  const renderJournalItem = ({ item }) => {
    // 现有的渲染项目代码
    // 但需要修改onPress和onLongPress处理，以包含entryId
    return (
      <TouchableOpacity
        style={styles.journalItem}
        onPress={() => {
          navigation.navigate("JournalEdit", {
            savedJournal: item.text,
            date: item.date,
            viewOnly: true,
            location: item.location,
            weather: item.weather,
            temperature: item.temperature,
            mood: item.mood
          });
        }}
        onLongPress={() => handleDeleteJournal(item.id)}
      >
        <View style={styles.journalItemContent}>
          <View style={styles.journalItemHeader}>
            <Text style={styles.journalItemDate}>
              {new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {item.mood && (
              <>
                <Text style={{ color: "#666", marginHorizontal: 1 }}>
                  ·
                </Text>
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
    );
  };

  // 下拉刷新
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refreshJournal();
      await loadJournals();
    } catch (error) {
      console.error("刷新日志时出错:", error);
    } finally {
      setRefreshing(false);
    }
  }, [filterMode]);

  // 如果加载中，显示加载指示器
  if (loading || journalLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>加载日志...</Text>
      </View>
    );
  }

  // 如果出错，显示错误消息
  if (journalError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>错误: {journalError}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => loadJournals()}
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[
      styles.container, 
      isLightTheme && styles.lightContainer,
      { 
        paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
      }
    ]}>
      <CustomHeader 
        title="JOURNAL"
        onBackPress={() => navigation.navigate("Home")}
        showBottomBorder={false}
      />
      
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>CURRENT STREAK</Text>
                <Text style={styles.statValue}>
                  {streak} <Text style={styles.statUnit}>days</Text>
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statTitle}>RECORDS THIS YEAR</Text>
                <Text style={styles.statValue}>
                  {entriesByMonth.reduce((a, b) => a + b, 0)}{" "}
                  <Text style={styles.statUnit}>entries</Text>
                </Text>
              </View>
            </View>

            <View style={styles.calendarContainer}>
              <Text style={styles.calendarLabel}>THIS MONTH</Text>
              <View style={styles.calendarDots}>{renderDayDots()}</View>
            </View>

            <View style={styles.journalContainer}>
              <Text style={styles.journalLabel}>TODAY'S REFLECTIONS</Text>
              <TouchableOpacity
                style={styles.journalButton}
                onPress={() =>
                  navigation.navigate("JournalEdit", {
                    date: today,
                  })
                }
              >
                <MaterialIcons name="edit" size={22} color="#CCCCCC" />
                <Text style={styles.journalButtonText}>
                  {savedToday
                    ? "EDIT TODAY'S JOURNAL"
                    : "WRITE IN YOUR JOURNAL"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>JOURNAL LIST</Text>

            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterMode === "all" && styles.activeFilterButton,
                ]}
                onPress={() => toggleFilterMode("all")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterMode === "all" && styles.activeFilterButtonText,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterMode === "year" && styles.activeFilterButton,
                ]}
                onPress={() => toggleFilterMode("year")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterMode === "year" && styles.activeFilterButtonText,
                  ]}
                >
                  Year
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterMode === "month" && styles.activeFilterButton,
                ]}
                onPress={() => toggleFilterMode("month")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterMode === "month" && styles.activeFilterButtonText,
                  ]}
                >
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  filterMode === "week" && styles.activeFilterButton,
                ]}
                onPress={() => toggleFilterMode("week")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterMode === "week" && styles.activeFilterButtonText,
                  ]}
                >
                  Week
                </Text>
              </TouchableOpacity>
            </View>
          </>
        }
        data={journalEntries}
        keyExtractor={(item) => item.date}
        renderItem={renderJournalItem}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>no journal written yet</Text>
          </View>
        )}
        contentContainerStyle={styles.flatListContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      {/* Diagnostic button */}
      <TouchableOpacity
        style={styles.diagnosticButton}
        onPress={async () => {
          // Initialize the DAO directly to run diagnostics
          const journalDAO = new JournalDAO();
          
          try {
            // Start with a loading indicator
            Alert.alert("Database Check", "Running database diagnostics...");
            
            // Run database verification
            const dbStatus = await journalDAO.verifyDatabase();
            
            // Create a readable diagnostic message
            let diagnosticMessage = `Database initialized: ${dbStatus.initialized ? 'Yes' : 'No'}\n`;
            diagnosticMessage += `Tables created: ${dbStatus.tablesCreated ? 'Yes' : 'No'}\n`;
            diagnosticMessage += `Tables found: ${dbStatus.tables.join(', ')}\n`;
            diagnosticMessage += `Journal table exists: ${dbStatus.hasJournalTable ? 'Yes' : 'No'}\n`;
            diagnosticMessage += `Journal entries count: ${dbStatus.journalCount}\n`;
            diagnosticMessage += `Write operations test: ${dbStatus.writeOperationsWorking ? 'Passed' : 'Failed'}\n\n`;
            
            // Add UI state information
            diagnosticMessage += `UI Journal entries: ${entries.length}\n`;
            diagnosticMessage += `Today's entry found: ${savedToday ? 'Yes' : 'No'}\n`;
            diagnosticMessage += `Monthly entries: ${entriesByMonth.reduce((a, b) => a + b, 0)}\n`;
            
            // Add errors if any
            if (dbStatus.errors && dbStatus.errors.length > 0) {
              diagnosticMessage += "\nErrors detected:\n";
              dbStatus.errors.forEach(err => {
                diagnosticMessage += `- ${err}\n`;
              });
            }
            
            // Display the diagnostic results
            Alert.alert(
              "Database Diagnostic Results",
              diagnosticMessage,
              [
                { 
                  text: "Reset Journal DB", 
                  style: "destructive",
                  onPress: () => {
                    Alert.alert(
                      "Confirm Database Reset",
                      "Are you sure you want to reset the journal database? This will delete all entries and rebuild the tables.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Reset", 
                          style: "destructive",
                          onPress: async () => {
                            try {
                              // Force rebuild of the database tables
                              await journalDAO._rebuildTableIfNeeded(true);
                              Alert.alert("Success", "Database tables have been reset. Please restart the app.");
                            } catch (error) {
                              Alert.alert("Error", `Failed to reset database: ${error.message}`);
                            }
                          }
                        }
                      ]
                    )
                  }
                },
                { 
                  text: "Repair Database", 
                  style: "default",
                  onPress: async () => {
                    Alert.alert(
                      "Database Repair",
                      "This will attempt to fix database connection issues. Continue?",
                      [
                        { text: "Cancel", style: "cancel" },
                        { 
                          text: "Repair", 
                          style: "default",
                          onPress: async () => {
                            try {
                              Alert.alert("Repairing...", "Attempting to repair database. Please wait...");
                              const repairResult = await journalDAO.fixDatabaseIssues();
                              if (repairResult) {
                                Alert.alert(
                                  "Repair Successful", 
                                  "Database has been repaired successfully. The app will reload journal data now.",
                                  [
                                    { 
                                      text: "OK", 
                                      onPress: () => {
                                        // Reload journal data
                                        refreshJournal();
                                        loadJournalData();
                                      }
                                    }
                                  ]
                                );
                              } else {
                                Alert.alert(
                                  "Repair Failed", 
                                  "Database repair was not successful. You may need to reinstall the app."
                                );
                              }
                            } catch (error) {
                              Alert.alert("Error", `Failed to repair database: ${error.message}`);
                            }
                          }
                        }
                      ]
                    );
                  }
                },
                { text: "OK", style: "default" }
              ]
            );
          } catch (error) {
            Alert.alert(
              "Diagnostic Error",
              `Failed to run database diagnostics: ${error.message}`
            );
          }
        }}
      >
        <Text style={styles.diagnosticButtonText}>Database Diagnostic</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  lightContainer: {
    backgroundColor: "#fff",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  statCard: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 15,
    width: "48%",
    height: 100,
    justifyContent: "space-between",
  },
  statTitle: { color: "#aaa", fontSize: 14, fontWeight: "500" },
  statValue: { color: "#fff", fontSize: 36, fontWeight: "300" },
  statUnit: { color: "#666", fontSize: 14 },
  monthDotsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  monthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#333",
    margin: 4,
    overflow: "hidden",
    position: "relative",
  },
  monthDotActive: { backgroundColor: "#FFFFFF" },
  monthDotPartial: { backgroundColor: "#333" },
  monthDotHalfFilled: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 6,
    height: 12,
    backgroundColor: "#FFFFFF",
  },
  calendarContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom:20,
    paddingHorizontal: 15,
  },
  calendarLabel: { color: "#aaa", fontSize: 14, marginBottom: 12 },
  calendarDots: { flexDirection: "row", flexWrap: "wrap" },
  calendarDot: {
    width: CALENDAR_DOT_SIZE,
    height: CALENDAR_DOT_SIZE,
    borderRadius: CALENDAR_DOT_SIZE / 2,
    margin: 3,
  },
  emptyDot: { backgroundColor: "#222" },
  filledDot: { backgroundColor: "#FFFFFF" },
  todayDot: { borderWidth: 2, borderColor: "#FFFFFF" },
  journalContainer: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  journalLabel: { color: "#aaa", fontSize: 14, marginBottom: 15 },
  journalButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 10,
  },
  journalButtonText: { color: "#CCCCCC", fontSize: 16, marginLeft: 10 },
  sectionTitle: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  journalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  journalItemContent: { flex: 1 },
  journalItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  journalItemDate: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  journalItemMoodIcon: {
    marginLeft: 6,
  },
  journalItemPreview: { color: "#aaa", fontSize: 14 },
  emptyContainer: {
    backgroundColor: '#171717',
    borderRadius: 10,
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  flatListContent: { paddingHorizontal: 20, paddingBottom: 40 },
  journalItemMeta: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorText: {
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
    paddingHorizontal: 15,
  },
  filterButton: {
    padding: 12,
    backgroundColor: "#111",
    borderRadius: 8,
  },
  activeFilterButton: {
    backgroundColor: "#FFFFFF",
  },
  filterButtonText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "500",
  },
  activeFilterButtonText: {
    color: "#000000",
  },
  diagnosticButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#222',
    borderRadius: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  diagnosticButtonText: {
    color: '#999',
    fontSize: 12,
  },
});

export default JournalScreen;
