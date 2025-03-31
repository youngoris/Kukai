#!/bin/bash

# Google Sign-in Configuration Checker
# Run this script after a clean build to ensure Google Sign-in is properly configured

echo "Checking Google Sign-in Configuration..."

# Check environment variables
if [ -f .env ]; then
  echo "✅ .env file exists"
  
  # Check for Google Client IDs in .env
  grep -q "GOOGLE_IOS_CLIENT_ID" .env && echo "✅ GOOGLE_IOS_CLIENT_ID found in .env" || echo "❌ GOOGLE_IOS_CLIENT_ID not found in .env"
  grep -q "GOOGLE_WEB_CLIENT_ID" .env && echo "✅ GOOGLE_WEB_CLIENT_ID found in .env" || echo "❌ GOOGLE_WEB_CLIENT_ID not found in .env"
  grep -q "GOOGLE_ANDROID_CLIENT_ID" .env && echo "✅ GOOGLE_ANDROID_CLIENT_ID found in .env" || echo "❌ GOOGLE_ANDROID_CLIENT_ID not found in .env"
else
  echo "❌ .env file not found. Please create it using .env.example as a template."
fi

# Check Expo config for Google Sign-in plugin
if [ -f app.json ]; then
  echo "✅ app.json file exists"
  
  # Check for Google Sign-in plugin in app.json
  grep -q "@react-native-google-signin/google-signin" app.json && echo "✅ Google Sign-in plugin found in app.json" || echo "❌ Google Sign-in plugin not found in app.json"
  grep -q "iosUrlScheme" app.json && echo "✅ iOS URL Scheme found in app.json" || echo "❌ iOS URL Scheme not found in app.json"
else
  echo "❌ app.json file not found."
fi

# Check iOS Info.plist
if [ -f ios/kukai/Info.plist ]; then
  echo "✅ Info.plist file exists"
  
  # Check for Google Sign-in configuration in Info.plist
  grep -q "GIDClientID" ios/kukai/Info.plist && echo "✅ GIDClientID found in Info.plist" || echo "❌ GIDClientID not found in Info.plist"
  grep -q "com.googleusercontent.apps" ios/kukai/Info.plist && echo "✅ Google URL Scheme found in Info.plist" || echo "❌ Google URL Scheme not found in Info.plist"
else
  echo "❌ Info.plist file not found."
fi

# Check AppDelegate.mm
if [ -f ios/kukai/AppDelegate.mm ]; then
  echo "✅ AppDelegate.mm file exists"
  
  # Check for Google Sign-in imports and configuration in AppDelegate.mm
  grep -q "GoogleSignIn/GIDSignIn.h" ios/kukai/AppDelegate.mm && echo "✅ Google Sign-in import found in AppDelegate.mm" || echo "❌ Google Sign-in import not found in AppDelegate.mm"
  grep -q "GIDConfiguration" ios/kukai/AppDelegate.mm && echo "✅ GIDConfiguration setup found in AppDelegate.mm" || echo "❌ GIDConfiguration setup not found in AppDelegate.mm"
else
  echo "❌ AppDelegate.mm file not found."
fi

echo ""
echo "Instructions for fixing Google Sign-in issues:"
echo "1. Make sure you have valid Google Client IDs in your .env file"
echo "2. Ensure the Google Sign-in plugin is properly configured in app.json with the correct iosUrlScheme"
echo "3. Verify that Info.plist contains the GIDClientID key and proper URL Scheme entries"
echo "4. Check that AppDelegate.mm imports GoogleSignIn and sets up the GIDConfiguration"
echo "5. Run 'npx expo prebuild --clean' to regenerate native projects"
echo "6. Run 'cd ios && pod install' to update iOS dependencies"
echo "7. Build and run the app again"

echo ""
echo "Checklist complete!" 