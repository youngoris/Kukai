import React, { useState, useEffect, useRef } from 'react';
import { 
  Animated, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  Dimensions,
  Platform
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * ErrorToast - A toast notification component for displaying non-critical errors
 * 
 * @param {Object} props Component props
 * @param {string} props.message Error message to display
 * @param {string} props.type Type of toast ('error', 'warning', 'info')
 * @param {number} props.duration Duration in ms to show the toast
 * @param {Function} props.onClose Callback when toast is closed
 * @param {Function} props.onPress Callback when toast is pressed
 * @param {Object} props.style Additional styles for the toast
 */
const ErrorToast = ({ 
  message, 
  type = 'error', 
  duration = 3000, 
  onClose, 
  onPress,
  style
}) => {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  
  // Set visible to true when component mounts
  useEffect(() => {
    if (message) {
      setVisible(true);
    }
  }, [message]);
  
  // Show/hide animations
  useEffect(() => {
    if (visible) {
      // Show the toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [visible]);
  
  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (onClose) onClose();
    });
  };
  
  // Determine background color based on type
  const getBackgroundColor = () => {
    switch (type) {
      case 'error':
        return 'rgba(255, 0, 0, 0.9)'; // Red with opacity
      case 'warning':
        return 'rgba(255, 153, 0, 0.9)'; // Orange with opacity
      case 'info':
        return 'rgba(0, 122, 255, 0.9)'; // Blue with opacity
      default:
        return 'rgba(51, 51, 51, 0.9)'; // Dark gray with opacity
    }
  };
  
  if (!visible || !message) {
    return null;
  }
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateY }], 
          opacity,
          backgroundColor: getBackgroundColor(),
          marginTop: insets.top,
        },
        style
      ]}
    >
      <TouchableOpacity 
        style={styles.content} 
        activeOpacity={0.8}
        onPress={() => {
          if (onPress) onPress();
          hideToast();
        }}
      >
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Global toast management
 */
const toastQueue = [];
let isShowingToast = false;

export const showErrorToast = (message, options = {}) => {
  const toastItem = {
    id: Date.now(),
    message,
    ...options
  };
  
  toastQueue.push(toastItem);
  processToastQueue();
};

const processToastQueue = () => {
  if (isShowingToast || toastQueue.length === 0) return;
  
  isShowingToast = true;
  const currentToast = toastQueue.shift();
  
  // Call global toast manager or dispatch event
  // This is a stub - implementation depends on how you manage global state
  // For example: EventEmitter.emit('SHOW_TOAST', currentToast);
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: SPACING.s,
    zIndex: 9999,
    elevation: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: width,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
  },
  message: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: '500',
    flex: 1,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  closeButtonText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
  },
});

export default ErrorToast; 