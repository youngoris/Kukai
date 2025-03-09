import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  HEADER_HEIGHT, 
  HEADER_COLORS, 
  HEADER_TEXT, 
  HEADER_BUTTON,
  HEADER_PADDING
} from '../constants/HeaderStyles';

/**
 * HeaderBar - A unified header component for all screens
 * 
 * IMPORTANT USAGE NOTES:
 * 1. Each screen using this component MUST define an appTheme state variable
 * 2. Each screen should load the user's theme preference from AsyncStorage
 * 3. Always pass the appTheme prop to this component
 * 4. Define isLightTheme = appTheme === 'light' in each screen
 * 
 * Example implementation in a screen:
 * ```
 * const [appTheme, setAppTheme] = useState('dark');
 * const isLightTheme = appTheme === 'light';
 * 
 * // Load user settings including theme
 * useEffect(() => {
 *   const loadUserSettings = async () => {
 *     try {
 *       const userSettings = await AsyncStorage.getItem('userSettings');
 *       if (userSettings) {
 *         const settings = JSON.parse(userSettings);
 *         if (settings.appTheme) {
 *           setAppTheme(settings.appTheme);
 *         }
 *       }
 *     } catch (error) {
 *       console.error('Error loading user settings:', error);
 *     }
 *   };
 *   
 *   loadUserSettings();
 * }, []);
 * 
 * // In render:
 * <HeaderBar 
 *   title="SCREEN_TITLE"
 *   onBackPress={() => navigation.navigate("Home")}
 *   appTheme={appTheme}
 * />
 * ```
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - The title to display in the header
 * @param {Function} props.onBackPress - Function to call when back button is pressed
 * @param {Object} props.rightButton - Optional right button configuration
 * @param {string} props.rightButton.icon - Icon name for the right button (MaterialIcons)
 * @param {Function} props.rightButton.onPress - Function to call when right button is pressed
 * @param {string} props.rightButton.text - Optional text to display instead of an icon
 * @param {boolean} props.hideBackButton - Whether to hide the back button
 * @param {string} props.appTheme - The current app theme ('light' or 'dark')
 * @returns {JSX.Element} The HeaderBar component
 */
const HeaderBar = ({ 
  title, 
  onBackPress, 
  rightButton, 
  hideBackButton = false,
  appTheme = 'dark'
}) => {
  const insets = useSafeAreaInsets();
  const isLightTheme = appTheme === 'light';
  
  // Calculate statusBarHeight for Android
  const statusBarHeight = Platform.OS === 'android' ? insets.top : 0;
  
  // Determine colors based on theme
  const backgroundColor = isLightTheme ? HEADER_COLORS.LIGHT.BACKGROUND : HEADER_COLORS.DARK.BACKGROUND;
  const textColor = isLightTheme ? HEADER_COLORS.LIGHT.TEXT : HEADER_COLORS.DARK.TEXT;
  const iconColor = isLightTheme ? HEADER_COLORS.LIGHT.ICON : HEADER_COLORS.DARK.ICON;
  
  return (
    <View style={[
      styles.headerContainer,
      { 
        paddingTop: statusBarHeight,
        backgroundColor
      }
    ]}>
      {/* Left button (back button) */}
      {!hideBackButton ? (
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onBackPress}
          hitSlop={HEADER_BUTTON.HITSLOP}
        >
          <MaterialIcons 
            name="arrow-back" 
            size={24} 
            color={iconColor} 
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.buttonPlaceholder} />
      )}
      
      {/* Title - absolutely centered */}
      <View style={styles.titleContainer}>
        <Text style={[
          styles.title,
          { color: textColor }
        ]}>
          {title}
        </Text>
      </View>
      
      {/* Right button or placeholder */}
      {rightButton ? (
        <TouchableOpacity 
          style={styles.rightButton} 
          onPress={rightButton.onPress}
          hitSlop={HEADER_BUTTON.HITSLOP}
        >
          {rightButton.icon ? (
            <MaterialIcons 
              name={rightButton.icon} 
              size={24} 
              color={iconColor} 
            />
          ) : (
            <Text style={[
              styles.rightButtonText,
              { color: textColor }
            ]}>
              {rightButton.text || ''}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.buttonPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: HEADER_HEIGHT.STANDARD,
    width: '100%',
    paddingHorizontal: HEADER_PADDING.HORIZONTAL,
    position: 'relative',
    zIndex: 10,
  },
  backButton: {
    width: HEADER_BUTTON.SIZE,
    height: HEADER_BUTTON.SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  buttonPlaceholder: {
    width: HEADER_BUTTON.SIZE,
    height: HEADER_BUTTON.SIZE,
  },
  titleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  title: {
    ...HEADER_TEXT.TITLE,
  },
  rightButton: {
    width: HEADER_BUTTON.SIZE,
    height: HEADER_BUTTON.SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  rightButtonText: {
    ...HEADER_TEXT.BUTTON,
  },
});

export default HeaderBar; 