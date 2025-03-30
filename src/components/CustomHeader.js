import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * CustomHeader - A unified header component for all screens
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title to display in the header
 * @param {Function} props.onBackPress - Function to call when back button is pressed
 * @param {Object} props.rightButton - Optional right button configuration
 * @param {string} props.rightButton.icon - Icon name for the right button (MaterialIcons)
 * @param {Function} props.rightButton.onPress - Function to call when right button is pressed
 * @param {boolean} props.hideBackButton - Whether to hide the back button
 * @param {boolean} props.showBottomBorder - Whether to show the bottom border (default: false)
 * @returns {JSX.Element} The CustomHeader component
 */
const CustomHeader = ({ 
  title, 
  onBackPress, 
  rightButton, 
  hideBackButton = false,
  extraButton = null,
  showBottomBorder = false
}) => {
  return (
    <View style={[
      styles.customHeader,
      showBottomBorder && styles.headerWithBorder
    ]}>
      {/* Left button (back button) */}
      {!hideBackButton ? (
        <TouchableOpacity 
          style={styles.headerBackButton}
          onPress={onBackPress}
          hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
      
      {/* Title */}
      <Text style={styles.headerTitle}>
        {title}
      </Text>
      
      {/* Right buttons container */}
      <View style={styles.headerRightContainer}>
        {/* Extra button if provided */}
        {extraButton}
        
        {/* Right button */}
        {rightButton && (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={rightButton.onPress}
            hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
          >
            <MaterialIcons 
              name={rightButton.icon} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 30,
    marginHorizontal: 10,
    backgroundColor: "#000",
    zIndex: 100,
    marginBottom: 10,
  },
  headerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerBackButton: {
    position: "absolute",
    left: 15,
    height: 44,
    width: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerPlaceholder: {
    position: "absolute",
    left: 15,
    height: 44,
    width: 44,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerRightContainer: {
    position: "absolute",
    right: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionButton: {
    height: 44,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default CustomHeader; 