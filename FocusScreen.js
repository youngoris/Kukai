import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Vibration,
  AppState,
  Modal,
  Pressable,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Progress from 'react-native-progress';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define focus and break times (in seconds)
const FOCUS_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 1 * 60; // 5 minutes

export default function FocusScreen({ navigation }) {
  // State variables
  const [timeRemaining, setTimeRemaining] = useState(FOCUS_TIME);
  const [isActive, setIsActive] = useState(false); 
  const [isBreak, setIsBreak] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasStartedBefore, setHasStartedBefore] = useState(false); // Track if user has started focus before

  // Reference variables
  const timer = useRef(null);
  const sessionStartTime = useRef(null);
  const appState = useRef(AppState.currentState);

  // Initialize notification permissions and app state listener
  useEffect(() => {
    const registerForNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(status === 'granted');
    };
    registerForNotifications();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isActive
      ) {
        handleAppForeground();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [isActive]);

  // Handle logic when app returns to foreground
  const handleAppForeground = () => {
    if (!sessionStartTime.current) return;
    const now = new Date();
    const elapsedSeconds = Math.floor((now - sessionStartTime.current) / 1000);
    const totalTime = isBreak ? BREAK_TIME : FOCUS_TIME;
    if (elapsedSeconds >= totalTime) {
      if (!isBreak) handleFocusComplete();
      else handleBreakComplete();
    } else {
      setTimeRemaining(totalTime - elapsedSeconds);
      setProgress(1 - (totalTime - elapsedSeconds) / totalTime);
    }
  };

  // Timer logic
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      timer.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          const totalTime = isBreak ? BREAK_TIME : FOCUS_TIME;
          setProgress(1 - newTime / totalTime);
          return newTime;
        });
      }, 1000);
    } else if (isActive && timeRemaining <= 0) {
      clearInterval(timer.current);
      if (!isBreak) handleFocusComplete();
      else handleBreakComplete();
      if (notificationPermission) triggerNotification();
    }
    return () => clearInterval(timer.current);
  }, [isActive, timeRemaining, isBreak, notificationPermission]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Toggle timer state
  const toggleTimer = () => {
    if (!isActive) {
      if (!hasStartedBefore) {
        setShowConfirmation(true);
      } else {
        resumeFocusSession();
      }
    } else {
      setIsActive(false);
      clearInterval(timer.current);
    }
  };

  // Start focus session
  const startFocusSession = () => {
    setIsActive(true);
    setTimeRemaining(isBreak ? BREAK_TIME : FOCUS_TIME);
    sessionStartTime.current = new Date();
    setHasStartedBefore(true);
  };

  // Resume focus session
  const resumeFocusSession = () => {
    setIsActive(true);
    const totalTime = isBreak ? BREAK_TIME : FOCUS_TIME;
    const elapsedTime = totalTime - timeRemaining;
    const now = new Date();
    sessionStartTime.current = new Date(now.getTime() - (elapsedTime * 1000));
  };

  // Confirm and start focus mode
  const confirmFocusMode = () => {
    setShowConfirmation(false);
    startFocusSession();
  };

  // Cancel focus mode
  const cancelFocusMode = () => {
    setShowConfirmation(false);
  };

  // Handle focus time completion
  const handleFocusComplete = () => {
    setIsActive(false);
    setShowChoice(true);
    setPomodoroCount((prev) => prev + 1);
    Vibration.vibrate(500);
  };

  // Handle break time completion
  const handleBreakComplete = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeRemaining(FOCUS_TIME);
    setProgress(0);
    setShowChoice(false);
    Vibration.vibrate(500);
    setHasStartedBefore(false);
  };

  // Start break
  const startBreak = () => {
    setShowChoice(false);
    setIsBreak(true);
    setTimeRemaining(BREAK_TIME);
    setProgress(0);
    setIsActive(true);
    sessionStartTime.current = new Date();
  };

  // Start next focus session
  const startNextFocus = () => {
    setShowChoice(false);
    setIsBreak(false);
    setTimeRemaining(FOCUS_TIME);
    setProgress(0);
    setIsActive(true);
    sessionStartTime.current = new Date();
  };

  // Trigger notification
  const triggerNotification = async () => {
    await Notifications.presentNotificationAsync({
      content: {
        title: isBreak ? 'Break Time Ended' : 'Focus Time Ended',
        body: isBreak
          ? 'Your break is over! Ready to start another focus session?'
          : 'Focus complete! Time to take a break or continue?',
        sound: true,
      },
    });
  };

  // Render interface
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>FOCUS</Text>
      </View>

      {/* Main content area */}
      <View style={styles.contentContainer}>
        {showChoice ? (
          <View style={styles.choiceContainer}>
            <Text style={styles.choiceText}>Focus Complete!</Text>
            <Text style={styles.choiceSubtext}>You've completed {pomodoroCount} pomodoros</Text>
            <TouchableOpacity style={styles.actionButton} onPress={startBreak}>
              <Text style={styles.actionButtonText}>Take a 5 min Break</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={startNextFocus}>
              <Text style={styles.actionButtonText}>Next 25 min Focus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.subHeaderText}>
              SESSION {pomodoroCount + (isBreak ? 1 : 1)}
            </Text>
            <Text style={styles.subText}>
              {isActive ? 
                (isBreak ? 'Taking a break...' : 'Stay focused...') : 
                (isBreak ? 'Break time' : 'Ready to focus?')}
            </Text>
            <View style={styles.timerContainer}>
              <View style={styles.progressContainer}>
                <Progress.Circle
                  size={240}
                  thickness={8}
                  color="#FFFFFF"
                  unfilledColor="rgba(255, 255, 255, 0.2)"
                  progress={progress}
                />
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
              
              <TouchableOpacity style={styles.timerButton} onPress={toggleTimer}>
                <Text style={styles.timerButtonText}>
                  {isActive ? 'PAUSE' : (hasStartedBefore ? 'RESUME' : 'START')}
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.timerInfoText}>
                {isBreak ? 'Break: 5 minutes' : 'Focus: 25 minutes'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Confirmation modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showConfirmation}
        onRequestClose={cancelFocusMode}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalText}>Enter Focus Mode?</Text>
            <Text style={styles.modalSubtext}>This will start a 25-minute focus session.</Text>
            <View style={styles.modalButtonContainer}>
              <Pressable style={styles.modalButton} onPress={cancelFocusMode}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.confirmButton]} onPress={confirmFocusMode}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.statsText}>Pomodoros: {pomodoroCount}</Text>
      </View>
    </SafeAreaView>
  );
}

// Style definitions
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    position: 'relative',
    width: '100%',
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: 'center',
    // marginBottom: 20,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 10,
    zIndex: 10,
  },
  headerButtonText: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' },
  headerText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subHeaderText: { color: '#FFFFFF', fontSize: 30, fontWeight: 'bold', marginBottom: 20 },
  subText: { color: '#666666', fontSize: 18, marginBottom: 20, textAlign: 'center' },
  timerContainer: { alignItems: 'center' },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 100,
  },
  timerText: { 
    position: 'absolute',
    color: '#FFFFFF', 
    fontSize: 60, 
    fontWeight: '200',
  },
  timerButton: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 40 },
  timerButtonText: { color: '#000000', fontSize: 20, fontWeight: 'bold' },
  timerInfoText: { 
    color: '#666666', 
    fontSize: 14, 
    marginVertical: 20
  },
  choiceContainer: { alignItems: 'center' },
  choiceText: { color: '#FFFFFF', fontSize: 24, fontWeight: '500', marginBottom: 10 },
  choiceSubtext: { color: '#666666', fontSize: 16, marginBottom: 20 },
  actionButton: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 8, marginTop: 10 },
  actionButtonText: { color: '#000000', fontSize: 16, fontWeight: '500' },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
    marginTop: 'auto'
  },
  statsText: { 
    color: '#666666', 
    fontSize: 14
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  modalText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalSubtext: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#000000',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});