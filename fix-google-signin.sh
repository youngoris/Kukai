#!/bin/bash

# Log function
log() {
  echo "[Fix Google Sign-in] $1"
}

log "Applying Google Sign-in fixes..."

# Check if iOS directory exists
if [ ! -d "ios" ]; then
  log "ERROR: iOS directory not found. Make sure you're in the root of your project."
  exit 1
fi

# Path to Info.plist
INFO_PLIST="ios/kukai/Info.plist"

# Path to AppDelegate.mm
APP_DELEGATE="ios/kukai/AppDelegate.mm"

# Check if Info.plist exists
if [ ! -f "$INFO_PLIST" ]; then
  log "ERROR: Info.plist not found at $INFO_PLIST"
  exit 1
fi

# Check if AppDelegate.mm exists
if [ ! -f "$APP_DELEGATE" ]; then
  log "ERROR: AppDelegate.mm not found at $APP_DELEGATE"
  exit 1
fi

# Add GIDClientID to Info.plist if it doesn't exist
if ! grep -q "GIDClientID" "$INFO_PLIST"; then
  log "Adding GIDClientID to Info.plist"
  
  # Get line number of the closing dict tag
  DICT_END_LINE=$(grep -n "</dict>" "$INFO_PLIST" | head -1 | cut -d: -f1)
  
  # Insert GIDClientID before the closing dict tag
  sed -i '' "${DICT_END_LINE}i\\
	<key>GIDClientID</key>\\
	<string>550142175159-g68otva0ota8927c7tjl3qhv21hp4v88.apps.googleusercontent.com</string>
  " "$INFO_PLIST"
else
  log "WARNING: GIDClientID already exists in Info.plist"
fi

# Add URL scheme to Info.plist if it doesn't exist
if ! grep -q "com.googleusercontent.apps.550142175159-g68otva0ota8927c7tjl3qhv21hp4v88" "$INFO_PLIST"; then
  log "Adding URL scheme for Google Sign-in to Info.plist"
  
  # Check if CFBundleURLTypes already exists
  if grep -q "CFBundleURLTypes" "$INFO_PLIST"; then
    # Get line number of the closing array tag for CFBundleURLTypes
    ARRAY_END_LINE=$(grep -n "</array>" "$INFO_PLIST" | head -1 | cut -d: -f1)
    
    # Insert new URL type before the closing array tag
    sed -i '' "${ARRAY_END_LINE}i\\
		<dict>\\
			<key>CFBundleURLSchemes</key>\\
			<array>\\
				<string>com.googleusercontent.apps.550142175159-g68otva0ota8927c7tjl3qhv21hp4v88</string>\\
			</array>\\
		</dict>
    " "$INFO_PLIST"
  else
    # Add new CFBundleURLTypes section
    DICT_END_LINE=$(grep -n "</dict>" "$INFO_PLIST" | head -1 | cut -d: -f1)
    
    sed -i '' "${DICT_END_LINE}i\\
	<key>CFBundleURLTypes</key>\\
	<array>\\
		<dict>\\
			<key>CFBundleURLSchemes</key>\\
			<array>\\
				<string>com.googleusercontent.apps.550142175159-g68otva0ota8927c7tjl3qhv21hp4v88</string>\\
			</array>\\
		</dict>\\
	</array>
    " "$INFO_PLIST"
  fi
else
  log "URL scheme for Google Sign-in already exists in Info.plist"
fi

# Add GoogleSignIn import to AppDelegate.mm if it doesn't exist
IMPORT_LINE_ADDED=false
if ! grep -q "#import <GoogleSignIn/GIDSignIn.h>" "$APP_DELEGATE"; then
  log "Adding GoogleSignIn import to AppDelegate.mm"
  
  # Add import after RCTLinkingManager import
  sed -i '' 's/#import <React\/RCTLinkingManager.h>/#import <React\/RCTLinkingManager.h>\n#import <GoogleSignIn\/GIDSignIn.h>\n#import <GoogleSignIn\/GIDConfiguration.h>/' "$APP_DELEGATE"
  IMPORT_LINE_ADDED=true
else
  # Check if GIDConfiguration import is missing
  if ! grep -q "#import <GoogleSignIn/GIDConfiguration.h>" "$APP_DELEGATE"; then
    log "Adding GIDConfiguration import to AppDelegate.mm"
    sed -i '' 's/#import <GoogleSignIn\/GIDSignIn.h>/#import <GoogleSignIn\/GIDSignIn.h>\n#import <GoogleSignIn\/GIDConfiguration.h>/' "$APP_DELEGATE"
    IMPORT_LINE_ADDED=true
  fi
fi

# Add Google Sign-in configuration to AppDelegate.mm if it doesn't exist
if ! grep -q "GIDConfiguration" "$APP_DELEGATE"; then
  log "Adding Google Sign-in configuration to AppDelegate.mm"
  
  # Add configuration after initialProps = @{};
  sed -i '' 's/self.initialProps = @{};/self.initialProps = @{};\n  \n  \/\/ Configure Google Sign-In\n  NSString \*clientID = \[\[NSBundle mainBundle\] objectForInfoDictionaryKey:@"GIDClientID"\];\n  if \(clientID\) {\n    GIDConfiguration \*config = \[\[GIDConfiguration alloc\] initWithClientID:clientID\];\n    \[GIDSignIn.sharedInstance setConfiguration:config\];\n  }/' "$APP_DELEGATE"
elif ! grep -q "GIDSignIn.sharedInstance setConfiguration" "$APP_DELEGATE"; then
  log "WARNING: GIDConfiguration exists but configuration code may be incomplete"
  
  # Search for the line with GIDConfiguration and add the missing line after it
  CONFIG_LINE=$(grep -n "GIDConfiguration" "$APP_DELEGATE" | cut -d: -f1)
  NEXT_LINE=$((CONFIG_LINE + 1))
  
  # Add the missing line if it doesn't contain setConfiguration
  if ! sed -n "${NEXT_LINE}p" "$APP_DELEGATE" | grep -q "setConfiguration"; then
    sed -i '' "${CONFIG_LINE}a\\
    [GIDSignIn.sharedInstance setConfiguration:config];
    " "$APP_DELEGATE"
  fi
else
  log "Google Sign-in configuration already exists in AppDelegate.mm"
fi

# Check if any changes were made
if [ "$IMPORT_LINE_ADDED" = true ] || ! grep -q "GIDSignIn.sharedInstance setConfiguration" "$APP_DELEGATE" || ! grep -q "GIDClientID" "$INFO_PLIST" || ! grep -q "com.googleusercontent.apps.550142175159-g68otva0ota8927c7tjl3qhv21hp4v88" "$INFO_PLIST" ]; then
  log "Google Sign-in fixes applied successfully!"
else
  log "No changes needed, Google Sign-in already configured correctly."
fi

log "All done! Run 'cd ios && pod install && cd ..' to finalize the setup." 