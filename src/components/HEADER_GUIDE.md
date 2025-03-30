# Header Height Consistency Guide

This guide explains how to maintain consistent header heights across all screens in the Kukai app.

## Using SafeHeader

Always use the `SafeHeader` component instead of `CustomHeader` directly. `SafeHeader` properly handles:

- Status bar heights on Android
- Safe area insets on iOS (for notches)
- Consistent padding and spacing

```jsx
import SafeHeader from '../components/SafeHeader';

// In your render function:
<SafeHeader 
  title="SCREEN TITLE"
  onBackPress={() => navigation.goBack()}
  showBottomBorder={false}
/>
```

## Container Styling

When using `SafeHeader`, your screen container should **NOT** include any top padding or margin adjustments:

```jsx
// CORRECT
<View style={[
  styles.container, 
  isLightTheme && styles.lightContainer
]}>
  <SafeHeader title="SCREEN TITLE" onBackPress={handleBackPress} />
  {/* Content */}
</View>

// INCORRECT - don't add paddingTop based on insets or StatusBar height
<View style={[
  styles.container, 
  { 
    paddingTop: Platform.OS === 'android' ? STATUSBAR_HEIGHT + 40 : insets.top > 0 ? insets.top + 10 : 20,
  }
]}>
  <SafeHeader title="SCREEN TITLE" onBackPress={handleBackPress} />
  {/* Content */}
</View>
```

## Special Cases

### HomeScreen

The HomeScreen has a custom header layout with date and weather. Adjust only the `marginTop` in its `headerContainer` style to maintain consistent spacing:

```jsx
headerContainer: {
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  marginTop: 40,  // This value ensures consistent height with SafeHeader
  marginBottom: 30,
},
```

### Meditation Module

For the meditation screen, always wrap `SafeHeader` in a parent container with the `headerContainer` style:

```jsx
<View style={styles.headerContainer}>
  <SafeHeader 
    title="MEDITATION"
    onBackPress={() => goBackToHome(navigation)}
    showBottomBorder={false}
  />
</View>
```

With style:
```jsx
headerContainer: {
  width: '100%',
},
```

### Focus Module

The Focus screen conditionally shows the header. When shown, use `SafeHeader` directly:

```jsx
{!isActive && (
  <SafeHeader 
    title="FOCUS"
    onBackPress={handleBackPress}
    hideBackButton={false}
    showBottomBorder={false}
  />
)}
```

## Testing Header Heights

To ensure consistent header heights:

1. Check the header appearance on both iOS and Android
2. Verify the layout works with different device notches and status bar heights
3. Make sure header content is properly aligned and visible
4. Compare the header height visually across different screens

## Implementation Details

- The `SafeHeader` wrapper uses `useSafeAreaInsets()` to get platform-specific insets
- The `CustomHeader` component has a fixed height of 60px
- For testing consistency, use the iOS simulator with iPhone 16 or newer models 