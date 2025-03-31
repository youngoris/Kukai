# Google Sign-in Integration

This document explains the Google Sign-in integration for the Kukai app.

## File Structure

### Configuration Files

- **`config/plugins/google-signin-plugin.js`**
  - Expo config plugin for Google Sign-in configuration
  - Automatically adds necessary entries to Info.plist and AppDelegate.mm during prebuild

### Scripts

- **`scripts/fix-google-signin.sh`**
  - Post-prebuild script to ensure proper Google Sign-in configuration
  - Updates Info.plist and AppDelegate.mm with necessary imports and configurations

- **`scripts/setup-google-signin.sh`**
  - Complete setup script that runs all necessary steps to configure Google Sign-in
  - Checks for environment variables, runs prebuild, applies fixes, and installs CocoaPods

- **`scripts/google-signin-check.sh`**
  - Diagnostic script to verify Google Sign-in configuration
  - Checks Info.plist and AppDelegate.mm for required entries

### JavaScript Services

- **`src/services/auth/GoogleSignInService.js`**
  - Main service for Google Sign-in authentication
  - Handles initialization, sign-in, sign-out, and token management
  - Provides a consistent API for Google Sign-in operations

- **`src/services/GoogleDriveService.js`**
  - Service for Google Drive operations
  - Uses GoogleSignInService for authentication
  - Handles backup folder management, file uploads/downloads, etc.

### UI Components

- **`src/components/GoogleSignInButton.js`**
  - Reusable button component for Google Sign-in
  - Displays sign-in button, loading state, and signed-in user info
  - Handles sign-in and sign-out operations

## Documentation

- **`config/README.md`**
  - Detailed guide for setting up Google Sign-in
  - Includes step-by-step instructions, verification steps, and troubleshooting tips

## Setup Process

1. Ensure necessary environment variables are set in `.env` file:
   ```
   GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
   GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
   GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

2. Run the setup script:
   ```bash
   chmod +x scripts/setup-google-signin.sh
   ./scripts/setup-google-signin.sh
   ```

3. Test the integration:
   ```bash
   npm run ios
   ```

For detailed documentation, refer to `config/README.md`.

## Using Google Sign-in in Components

```javascript
import React from 'react';
import { View } from 'react-native';
import GoogleSignInButton from '../components/GoogleSignInButton';

const LoginScreen = () => {
  const handleSignInSuccess = (user) => {
    console.log('Signed in user:', user);
    // Navigate to next screen or update app state
  };

  const handleSignInFailure = (error) => {
    console.log('Sign-in failed:', error);
    // Show error message
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <GoogleSignInButton 
        onSignInSuccess={handleSignInSuccess}
        onSignInFailure={handleSignInFailure}
        buttonText="Continue with Google"
      />
    </View>
  );
};

export default LoginScreen;
``` 