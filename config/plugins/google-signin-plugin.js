const { withInfoPlist, withAppDelegate, ConfigPlugin, createRunOncePlugin } = require('@expo/config-plugins');

// Custom config plugin to handle Google Sign-in configuration
const withGoogleSignIn = (config) => {
  // Add GIDClientID to Info.plist
  config = withInfoPlist(config, (config) => {
    // Get client ID from environment or use hardcoded one
    const clientId = process.env.GOOGLE_IOS_CLIENT_ID || '550142175159-g68otva0ota8927c7tjl3qhv21hp4v88.apps.googleusercontent.com';
    
    // Log for debugging
    console.log(`[GoogleSignInPlugin] Setting GIDClientID: ${clientId}`);
    
    // Add GIDClientID
    config.modResults.GIDClientID = clientId;
    
    // Ensure the URL scheme exists
    const URLTypes = config.modResults.CFBundleURLTypes || [];
    
    // Add the Google URL type if not present
    const googleURLScheme = URLTypes.find((entry) => 
      entry.CFBundleURLSchemes && 
      entry.CFBundleURLSchemes.some(scheme => scheme.includes('googleusercontent'))
    );
    
    if (!googleURLScheme) {
      // Extract client ID part only for the scheme
      const clientIdWithoutSuffix = clientId.split('.')[0];
      const urlScheme = `com.googleusercontent.apps.${clientIdWithoutSuffix}`;
      
      console.log(`[GoogleSignInPlugin] Adding URL scheme: ${urlScheme}`);
      
      URLTypes.push({
        CFBundleURLSchemes: [urlScheme]
      });
      
      config.modResults.CFBundleURLTypes = URLTypes;
    }
    
    return config;
  });
  
  // Modify AppDelegate to set up Google Sign-in
  config = withAppDelegate(config, (config) => {
    const appDelegateContent = config.modResults.contents;
    
    console.log('[GoogleSignInPlugin] Modifying AppDelegate');
    
    // Add the import if it doesn't exist
    let modifiedContent = appDelegateContent;
    if (!appDelegateContent.includes('#import <GoogleSignIn/GIDSignIn.h>')) {
      modifiedContent = appDelegateContent.replace(
        '#import <React/RCTLinkingManager.h>',
        '#import <React/RCTLinkingManager.h>\n#import <GoogleSignIn/GIDSignIn.h>\n#import <GoogleSignIn/GIDConfiguration.h>'
      );
    }
    
    // Add the Google Sign-in configuration if it doesn't exist
    if (!appDelegateContent.includes('GIDConfiguration')) {
      modifiedContent = modifiedContent.replace(
        'self.initialProps = @{};',
        `self.initialProps = @{};\n
  // Configure Google Sign-In
  NSString *clientID = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GIDClientID"];
  if (clientID) {
    GIDConfiguration *config = [[GIDConfiguration alloc] initWithClientID:clientID];
    [GIDSignIn.sharedInstance setConfiguration:config];
  }`
      );
    }
    
    config.modResults.contents = modifiedContent;
    return config;
  });
  
  return config;
};

// Create a plugin that runs only once
module.exports = createRunOncePlugin(
  withGoogleSignIn,
  'google-signin-plugin',
  '1.0.0'
); 