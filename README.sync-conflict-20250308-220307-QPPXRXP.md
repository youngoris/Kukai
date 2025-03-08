# Kukai App

Kukai is a multifunctional application focused on personal life management and spiritual growth, integrating meditation, task management, focus mode, journaling, and statistical summaries to help users improve their quality of life and work efficiency.



## Prerequisites

Before installing and running Kukai, ensure your development environment meets the following requirements:

- Node.js (recommended v16.0.0 or higher)
- npm (v8.0.0 or higher) or yarn (v1.22.0 or higher)

## Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kukai.git
cd kukai
```

### 2. Install Dependencies

Using npm:

```bash
npm install
```

Or using yarn:

```bash
yarn install
```

### 3. Environment Configuration (Optional)

Create a `.env` file and configure the necessary environment variables if you need the following features:
- Weather API key: Required for weather information display
- Google API credentials: Required for Google Drive synchronization

```
WEATHER_API_KEY=your_weather_api_key
GOOGLE_EXPO_CLIENT_ID=your_google_client_id
GOOGLE_IOS_CLIENT_ID=your_ios_client_id
GOOGLE_ANDROID_CLIENT_ID=your_android_client_id
GOOGLE_WEB_CLIENT_ID=your_web_client_id
```

The app will still function without these environment variables, but certain features will be limited or unavailable.

## Running the Application

### Using the Expo Development Server

Start the Expo development server using one of the following commands:

```bash
# Using npm script
npm start

# Using npx (recommended if you don't have expo-cli installed globally)
npx expo start
```

After executing this command:

- Press `i` to run in the iOS simulator (macOS only)
- Press `a` to run on an Android emulator or connected device
- Scan the QR code with a physical device (requires the Expo Go app)

### Running on Specific Platforms

#### iOS

```bash
# Using npm script
npm run ios

# Using npx
npx expo run:ios
```

#### Android

```bash
# Using npm script
npm run android

# Using npx
npx expo run:android
```

### Using the Expo Go App

1. Install the [Expo Go](https://expo.dev/client) app on your iOS or Android device
2. Ensure your phone is on the same Wi-Fi network as your development computer
3. Start the project: `npm start`
4. Scan the QR code in the terminal or web page with the Expo Go app

**Note:** You do not need to log in to an Expo account when developing or testing with Expo Go in development mode.



## Troubleshooting

### Common Issues

1. **Cannot start Metro server**
   - Try clearing the cache: `npm start -- --reset-cache`

2. **iOS build fails**
   - Ensure all CocoaPods dependencies are correctly installed
   - Check if your Xcode version is compatible

3. **Android type conversion errors**
   - String types on Android platforms do not automatically convert to double types; ensure all values are explicitly converted to number types (using parseFloat) before passing them to animation and style properties
   - Use Platform.OS to detect the platform and provide different implementations

4. **Notifications not working**
   - Check application permission settings
   - On Android, ensure notification channels are properly created

5. **Google Drive synchronization issues**
   - Verify that OAuth client ID configuration is correct
   - Check network connection

## Project Structure

```
kukai/
├── README.md                # Project documentation
├── app.json                 # Expo configuration
├── babel.config.js          # Babel transpiler configuration
├── eas.json                 # EAS Build configuration
├── index.js                 # JavaScript entry point
├── metro.config.js          # Metro bundler configuration
├── package.json             # NPM dependencies and scripts
├── assets/                  # Static resources
│   ├── adaptive-icon.png
│   ├── brownnoise.m4a       # Meditation sound files
│   ├── favicon.png
│   ├── fire.m4a
│   ├── forest.m4a
│   ├── frog.svg
│   ├── icon.png
│   ├── ocean.m4a
│   ├── plane.m4a
│   ├── rain.m4a
│   ├── splash-icon.png
│   └── whitenoise.m4a
├── android/                 # Android-specific files
│   ├── app/
│   ├── build/
│   ├── build.gradle
│   ├── gradle/
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   └── settings.gradle
├── ios/                     # iOS-specific files
│   ├── Podfile
│   ├── Podfile.lock
│   ├── Pods/
│   ├── kukai/
│   ├── kukai.xcodeproj/
│   └── kukai.xcworkspace/
└── src/                     # Source code directory
    ├── App.js               # Main application component
    ├── assets/              # Application assets
    ├── components/          # Reusable UI components
    ├── constants/           # Application constants and configuration
    ├── hooks/               # Custom React hooks
    ├── navigation/          # Navigation configuration
    ├── screens/             # Screen components
    │   ├── HomeScreen.js       # Home screen
    │   ├── MeditationScreen.js # Meditation functionality
    │   ├── TaskScreen.js       # Task management
    │   ├── FocusScreen.js      # Pomodoro focus timer
    │   ├── SummaryScreen.js    # Daily summary and statistics
    │   ├── JournalScreen.js    # Journal entry list
    │   ├── JournalEditScreen.js # Journal editing interface
    │   └── SettingsScreen.js   # App settings
    ├── services/            # Service modules
    │   ├── NotificationService.js  # Notifications management
    │   └── GoogleDriveService.js   # Google Drive integration
    ├── store/               # State management
    └── utils/               # Utility functions
        └── useWeather.js        # Weather API integration hook
```

The application follows a well-organized structure:

1. **src/**: Contains all the source code of the application
   - **screens/**: Each major feature has its own screen component
   - **components/**: Reusable UI components used across screens
   - **services/**: Backend service integrations and API wrappers
   - **navigation/**: Navigation configuration and routing
   - **hooks/**: Custom React hooks for shared functionality
   - **constants/**: Application-wide constants and configuration
   - **utils/**: Helper functions and utilities
   - **store/**: State management for the application

2. **assets/**: Contains static resources like sounds, images, and icons

3. **Platform-specific directories**:
   - **android/**: Contains Android-specific configuration and build files
   - **ios/**: Contains iOS-specific configuration and build files

## License

[Detailed License Information]
