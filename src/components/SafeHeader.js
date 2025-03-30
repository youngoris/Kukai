import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from './CustomHeader';

/**
 * SafeHeader - A header component that properly handles safe areas across platforms
 * This component wraps CustomHeader and adds appropriate padding for status bars
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title to display in the header
 * @param {Function} props.onBackPress - Function to call when back button is pressed
 * @param {Object} props.rightButton - Optional right button configuration
 * @param {string} props.rightButton.icon - Icon name for the right button (MaterialIcons)
 * @param {Function} props.rightButton.onPress - Function to call when right button is pressed
 * @param {boolean} props.hideBackButton - Whether to hide the back button
 * @param {boolean} props.showBottomBorder - Whether to show the bottom border (default: false)
 * @param {React.ReactNode} props.extraButton - Optional extra button to display in the header
 * @returns {JSX.Element} The SafeHeader component
 */
const SafeHeader = ({ 
  title, 
  onBackPress, 
  rightButton, 
  hideBackButton = false,
  extraButton = null,
  showBottomBorder = false 
}) => {
  const insets = useSafeAreaInsets();
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;

  return (
    <View style={[
      styles.safeHeaderContainer,
      { 
        paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT : insets.top > 0 ? insets.top : 20,
      }
    ]}>
      <CustomHeader
        title={title}
        onBackPress={onBackPress}
        rightButton={rightButton}
        hideBackButton={hideBackButton}
        extraButton={extraButton}
        showBottomBorder={showBottomBorder}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeHeaderContainer: {
    width: '100%',
    backgroundColor: '#000000',
    paddingBottom: 5,
  }
});

export default SafeHeader; 