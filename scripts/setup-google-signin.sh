#!/bin/bash

# Setup Google Sign-in for the app
# This script automates all the steps needed to set up Google Sign-in

# Log function
log() {
  echo "[Setup Google Sign-in] $1"
}

log "Starting Google Sign-in setup..."

# Check if .env file exists and has Google client IDs
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  log "WARNING: No .env file found. Creating one..."
  touch "$ENV_FILE"
fi

# Check for Google client IDs in .env
if ! grep -q "GOOGLE_IOS_CLIENT_ID" "$ENV_FILE" || ! grep -q "GOOGLE_WEB_CLIENT_ID" "$ENV_FILE"; then
  log "Adding Google client IDs to .env file..."
  echo "# Google Sign-in configuration" >> "$ENV_FILE"
  echo "GOOGLE_IOS_CLIENT_ID=550142175159-g68otva0ota8927c7tjl3qhv21hp4v88.apps.googleusercontent.com" >> "$ENV_FILE"
  echo "GOOGLE_WEB_CLIENT_ID=550142175159-g68otva0ota8927c7tjl3qhv21hp4v88.apps.googleusercontent.com" >> "$ENV_FILE"
  echo "GOOGLE_ANDROID_CLIENT_ID=550142175159-..." >> "$ENV_FILE"
  log "Added Google client IDs to .env file. Please update with your own client IDs."
else
  log "Google client IDs already exist in .env file."
fi

# Run Expo prebuild
log "Running Expo prebuild..."
npx expo prebuild --clean

# Check if prebuild was successful
if [ $? -ne 0 ]; then
  log "ERROR: Expo prebuild failed. Please fix the issues and run this script again."
  exit 1
fi

# Run fix script
log "Running Google Sign-in fix script..."
chmod +x scripts/fix-google-signin.sh
./scripts/fix-google-signin.sh

# Install CocoaPods
log "Installing CocoaPods..."
cd ios && pod install && cd ..

log "Google Sign-in setup completed successfully!"
log "You can now run 'npm run ios' to test the app."
log ""
log "NOTE: If you encounter any issues, please refer to config/README.md for troubleshooting." 