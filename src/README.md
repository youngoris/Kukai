# Kukai App - Project Structure

## Directory Structure

```
/src
  /components      - Reusable components
  /screens         - Screen components
  /services        - Service layer (such as notifications, cloud backup, etc.)
  /hooks           - Custom hooks
  /utils           - Utility functions
  /constants       - Constant definitions
  /navigation      - Navigation related
  /store           - State management
  /assets          - Static resources
```

## Component Description

### Core Components

- `App.js` - Application entry point
- `AppNavigator.js` - Navigation configuration

### Screen Components

- `HomeScreen.js` - Home screen
- `MeditationScreen.js` - Meditation function
- `TaskScreen.js` - Task management
- `FocusScreen.js` - Focus mode
- `SummaryScreen.js` - Daily summary
- `JournalScreen.js` - Journal list
- `JournalEditScreen.js` - Journal editing
- `SettingsScreen.js` - Settings page

### Reusable Components

- `MarkdownRenderer.js` - Markdown rendering component
- `SettingItem.js` - Setting item component
- `SettingSection.js` - Setting section component
- `CustomDateTimePicker.js` - Custom date time picker
- `CloudBackupSection.js` - Cloud backup component
- `JournalTemplateManager.js` - Journal template manager

### Services

- `GoogleDriveService.js` - Google Drive integration
- `NotificationService.js` - Notification service

### Custom Hooks

- `useAsyncStorage.js` - AsyncStorage operation hook
- `useWeather.js` - Weather data fetching hook

### Constants

- `Config.js` - Configuration constants
- `DesignSystem.js` - Design system constants
- `JournalTemplates.js` - Journal template definitions

## Development Guide

### Adding New Screens

1. Create a new screen component in the `/src/screens` directory
2. Register the new screen in `/src/navigation/AppNavigator.js`

### Adding New Components

1. Create a new component in the `/src/components` directory
2. Ensure the component is reusable and properly documented

### Adding New Services

1. Create a new service in the `/src/services` directory
2. Initialize the service in `App.js` (if needed)

### Adding New Hooks

1. Create a new hook in the `/src/hooks` directory
2. Ensure the hook follows React Hooks rules

## Code Standards

- Use ES6+ syntax
- Use functional components and React Hooks
- Document functions and components with JSDoc comments
- Use appropriate error handling
- Avoid direct state mutations, use immutable update patterns
