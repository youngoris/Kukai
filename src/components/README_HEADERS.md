# Header Components Usage Guide

## SafeHeader Component

The `SafeHeader` component is a custom component designed to provide consistent header appearance across both iOS and Android platforms. It properly handles safe areas, status bars, and device notches.

### Key Features

- Consistent header height across all devices
- Proper padding for status bars and notches
- Works on both iOS and Android
- Supports light and dark theme
- Compatible with all screen configurations

### Usage

```jsx
import SafeHeader from '../components/SafeHeader';

// Basic usage
<SafeHeader 
  title="SCREEN TITLE"
  onBackPress={() => navigation.goBack()}
/>

// With right button
<SafeHeader 
  title="SCREEN TITLE"
  onBackPress={() => navigation.goBack()}
  rightButton={{
    icon: "add",
    onPress: handleAddPress
  }}
/>

// Without back button (for home screen)
<SafeHeader 
  title="HOME"
  hideBackButton={true}
/>
```

### Why SafeHeader instead of SafeAreaView + CustomHeader?

The `SafeHeader` component solves several issues:

1. **Platform Inconsistency**: `SafeAreaView` from React Native only works on iOS devices with iOS 11+. 
   Our component works consistently on both iOS and Android.

2. **Status Bar Height**: Using `StatusBar.currentHeight` only works on Android.
   SafeHeader handles both platforms properly.

3. **Header Height**: Ensures consistent header height across all screens.

4. **Simplified Usage**: Reduces boilerplate code when creating new screens.

### Implementation Details

The `SafeHeader` component:

1. Uses `useSafeAreaInsets()` from 'react-native-safe-area-context' to get device-specific insets
2. Applies proper padding based on platform and device characteristics
3. Wraps the `CustomHeader` component with standardized styling

### Migration

When migrating screens to use the new `SafeHeader`:

1. Import `SafeHeader` instead of or alongside `CustomHeader`
2. Replace direct usage of `CustomHeader` with `SafeHeader`
3. Remove custom status bar height calculations and padding
4. Remove separate containers for status bar space

## Example Implementation

Before:
```jsx
<View style={styles.container}>
  {/* Status bar space */}
  <View style={{
    height: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top,
  }} />
  
  {/* Header container */}
  <View style={styles.headerContainer}>
    <CustomHeader 
      title="SCREEN TITLE"
      onBackPress={handleBackPress}
    />
  </View>
  
  {/* Content */}
  <View style={styles.content}>
    {/* Screen content */}
  </View>
</View>
```

After:
```jsx
<View style={styles.container}>
  <SafeHeader 
    title="SCREEN TITLE"
    onBackPress={handleBackPress}
  />
  
  {/* Content */}
  <View style={styles.content}>
    {/* Screen content */}
  </View>
</View>
``` 