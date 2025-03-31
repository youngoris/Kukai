# Google Sign-in Integration Guide

This guide explains how to set up Google Sign-in in your Expo/React Native application.

## Files Organization

- **`config/plugins/google-signin-plugin.js`**: Expo config plugin for Google Sign-in configuration
- **`scripts/fix-google-signin.sh`**: Post-prebuild script to fix Google Sign-in configuration
- **`src/services/auth/GoogleSignInService.js`**: Service for Google Sign-in authentication
- **`src/services/GoogleDriveService.js`**: Service for Google Drive integration

## Environment Variables

Add the following variables to your `.env` file:

```
GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

## Setup Steps

### 1. Configure app.json

Add the Google Sign-in plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "./config/plugins/google-signin-plugin.js"
    ],
    "ios": {
      "infoPlist": {
        "GIDClientID": "550142175159-g68otva0ota8927c7tjl3qhv21hp4v88.apps.googleusercontent.com"
      }
    }
  }
}
```

### 2. Run the prebuild process

```bash
npx expo prebuild --clean
```

### 3. Fix Google Sign-in configuration

```bash
chmod +x scripts/fix-google-signin.sh
./scripts/fix-google-signin.sh
```

### 4. Install CocoaPods

```bash
cd ios && pod install && cd ..
```

### 5. Build and run the app

```bash
npm run ios
```

## Verification

Check that the following configurations are correct:

### iOS

1. **Info.plist**:
   - Contains `GIDClientID` key with your Google client ID
   - Contains URL scheme in `CFBundleURLTypes` matching your client ID

2. **AppDelegate.mm**:
   - Contains imports for Google Sign-in:
     ```objc
     #import <GoogleSignIn/GIDSignIn.h>
     #import <GoogleSignIn/GIDConfiguration.h>
     ```
   - Contains configuration code for Google Sign-in:
     ```objc
     NSString *clientID = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GIDClientID"];
     if (clientID) {
       GIDConfiguration *config = [[GIDConfiguration alloc] initWithClientID:clientID];
       [GIDSignIn.sharedInstance setConfiguration:config];
     }
     ```

## Common Issues

- **Cannot import GIDConfiguration**: Make sure both `GIDSignIn.h` and `GIDConfiguration.h` are imported in `AppDelegate.mm`
- **URL scheme not found**: Make sure the URL scheme in Info.plist matches your client ID format
- **Sign-in fails silently**: Check your client IDs in the `.env` file and make sure they match what's in your Google Developer Console

## Initialization in JavaScript

Initialize Google Sign-in early in your app:

```javascript
import googleSignInService from "./services/auth/GoogleSignInService";

// In your app initialization code
await googleSignInService.initialize();
```

## Testing Google Sign-in

Use the `GoogleSignInService` to sign in:

```javascript
const signInResult = await googleSignInService.signIn();
if (signInResult.success) {
  console.log("Signed in user:", signInResult.user);
} else {
  console.log("Sign-in failed:", signInResult.error);
}
``` 