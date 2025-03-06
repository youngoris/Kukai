import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import notificationService from './services/NotificationService';
import { COLORS } from './constants/DesignSystem';

const NotificationHistoryScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load notification history
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const history = await notificationService.getNotificationHistory();
      setNotifications(history);
    } catch (error) {
      console.error('Failed to load notification history:', error);
      Alert.alert('Error', 'Failed to load notification history');
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markNotificationAsRead(notificationId);
      setNotifications(prevNotifications => 
        prevNotifications.map(item => 
          item.id === notificationId ? { ...item, read: true } : item
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notification history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.clearNotificationHistory();
              setNotifications([]);
            } catch (error) {
              console.error('Failed to clear notification history:', error);
              Alert.alert('Error', 'Failed to clear notification history');
            }
          }
        }
      ]
    );
  };

  // Handle notification click
  const handleNotificationPress = (notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // If notification contains navigation info, navigate to appropriate screen
    if (notification.data && notification.data.screen) {
      navigation.navigate(notification.data.screen);
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Get notification type icon
  const getNotificationIcon = (notification) => {
    if (!notification.data || !notification.data.notificationType) {
      return <Ionicons name="notifications" size={24} color={COLORS.PRIMARY} />;
    }
    
    switch (notification.data.notificationType) {
      case 'taskReminder':
        return <MaterialIcons name="assignment" size={24} color={COLORS.PRIMARY} />;
      case 'journalReminder':
        return <MaterialIcons name="book" size={24} color={COLORS.PRIMARY} />;
      case 'immediate':
        if (notification.data.screen === 'Focus') {
          return <MaterialIcons name="timer" size={24} color={COLORS.PRIMARY} />;
        }
        return <Ionicons name="notifications" size={24} color={COLORS.PRIMARY} />;
      default:
        return <Ionicons name="notifications" size={24} color={COLORS.PRIMARY} />;
    }
  };

  // Initial loading
  useEffect(() => {
    loadNotifications();
    
    // Add navigation focus listener to refresh data every time the page is entered
    const unsubscribe = navigation.addListener('focus', () => {
      loadNotifications();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Render notification item
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        {getNotificationIcon(item)}
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>{formatTime(item.timestamp)}</Text>
      </View>
      {!item.read && (
        <View style={styles.unreadIndicator} />
      )}
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off" size={64} color="#666" />
      <Text style={styles.emptyStateText}>No Notifications</Text>
      <Text style={styles.emptyStateSubtext}>When you receive notifications, they will appear here</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification History</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAllNotifications}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={notifications.length === 0 && styles.emptyListContent}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadNotifications}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: COLORS.PRIMARY,
    fontWeight: '500',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    backgroundColor: '#121212',
  },
  unreadNotification: {
    backgroundColor: '#1A1A1A',
  },
  notificationIcon: {
    marginRight: 16,
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888888',
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 8,
    alignSelf: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#888888',
    marginTop: 8,
  },
  emptyListContent: {
    flexGrow: 1,
  },
});

export default NotificationHistoryScreen; 