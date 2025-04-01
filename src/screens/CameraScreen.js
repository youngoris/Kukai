import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  Animated,
  Alert,
  Linking,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { format, isToday } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';
import { pressAnimation } from '../utils/AnimationUtils';
import { errorLogger } from '../services/errorLogger';
import { withErrorBoundary } from '../components/ErrorBoundary';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const VIEWFINDER_SIZE = screenWidth * 0.8; // 80% of screen width for the square

// Selfie quotes array
const SELFIE_QUOTES = [
  "Capture today's self, tomorrow's memory.",
  "A selfie a day keeps forgetting away.",
  "Your face today, your history tomorrow.",
  "Moments fade, selfies remain.",
  "In every selfie, a story is told.",
  "A daily glimpse of your evolving story.",
];

const CameraScreen = ({ navigation, route }) => {
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  
  const insets = useSafeAreaInsets();
  
  // Randomly select a quote
  const [quote] = useState(
    SELFIE_QUOTES[Math.floor(Math.random() * SELFIE_QUOTES.length)]
  );
  
  // Check if coming from retake operation
  const fromRetake = route.params?.fromRetake || false;

  // Check if a selfie has already been taken today
  const checkTodaySelfie = async () => {
    try {
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        return false;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      const todayPhotos = files.filter(file => {
        const date = new Date(file.split('_')[0]);
        return isToday(date);
      });

      return todayPhotos.length > 0;
    } catch (error) {
      console.error('Error checking today\'s selfie:', error);
      errorLogger.logError(error, { 
        componentStack: 'CameraScreen.checkTodaySelfie',
        extraInfo: 'Failed to check if today\'s selfie exists'
      });
      return false;
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const onCameraReady = () => {
    setIsCameraReady(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current || !isCameraReady || isProcessing) return;

    try {
      // Check if a selfie has already been taken today
      const hasTodaySelfie = await checkTodaySelfie();
      
      if (hasTodaySelfie) {
        // Show alert if a selfie has already been taken today
        Alert.alert(
          'Daily Selfie Complete',
          'You have already taken your selfie for today. Would you like to replace it?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
            { text: 'Replace', onPress: () => captureAndSave() }
          ]
        );
      } else {
        // Proceed with taking a picture
        captureAndSave();
      }
    } catch (error) {
      console.error('Error in takePicture:', error);
      errorLogger.logError(error, { 
        componentStack: 'CameraScreen.takePicture',
        extraInfo: 'Failed to check or take picture'
      });
      Alert.alert(
        'Error',
        'Failed to process the photo. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const captureAndSave = async () => {
    try {
      setIsProcessing(true); // Prevent multiple captures
      pressAnimation(scaleAnim);
      
      // Take the photo with 1:1 aspect ratio, add exif option to get EXIF data
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        skipProcessing: true,
        exif: true, // Get EXIF data
      });

      // Log photo dimensions for debugging
      console.log(`Original photo dimensions: ${photo.width}x${photo.height}`);
      console.log('EXIF data:', photo.exif); // Print EXIF data for debugging
      
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        try {
          await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
        } catch (dirError) {
          // If directory already exists or cannot be created, log and continue
          console.log(`Directory creation issue: ${dirError.message}`);
          // Do not return, try to continue with saving photo
        }
      }

      // Delete any existing selfies from today
      try {
        const files = await FileSystem.readDirectoryAsync(photoDir);
        const todayFiles = files.filter(file => {
          const date = new Date(file.split('_')[0]);
          return isToday(date);
        });
        
        for (const file of todayFiles) {
          await FileSystem.deleteAsync(`${photoDir}${file}`);
        }
      } catch (fileError) {
        console.log(`Error managing existing files: ${fileError.message}`);
        // Continue with saving the new photo
      }

      // Use actual capture time (if available) or current time for filename
      const timestamp = photo.exif?.DateTime 
        ? new Date(photo.exif.DateTime.replace(/:/g, '-').replace(' ', 'T'))
        : new Date();
      
      const fileName = `${format(new Date(), 'yyyy-MM-dd')}_${Date.now()}_exif.jpg`;
      const newPhotoUri = `${photoDir}${fileName}`;
      
      // Save EXIF data to a separate file for later access
      if (photo.exif) {
        const exifFilePath = `${photoDir}${fileName.replace('.jpg', '.exif.json')}`;
        await FileSystem.writeAsStringAsync(exifFilePath, JSON.stringify(photo.exif));
      }
      
      // Crop to square if not already square
      const minSize = Math.min(photo.width, photo.height);
      const offsetX = (photo.width - minSize) / 2;
      const offsetY = (photo.height - minSize) / 2;
      
      // Apply crop and black and white effect - ensure strong B&W effect is applied
      const processedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          { 
            crop: { 
              originX: offsetX, 
              originY: offsetY, 
              width: minSize, 
              height: minSize 
            } 
          }
        ],
        {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.7, // Set compression rate to achieve black and white effect
        }
      );

      // Log processed photo dimensions
      console.log(`Processed photo dimensions: ${processedPhoto.width}x${processedPhoto.height}`);

      // Save photo to disk
      await FileSystem.moveAsync({
        from: processedPhoto.uri,
        to: newPhotoUri,
      });

      console.log('Photo saved successfully, navigating to gallery');
      
      // Always navigate to PhotoGallery directly instead of using goBack()
      // This ensures we go to the gallery regardless of where we came from
      navigation.navigate('PhotoGallery', { 
        fromRetake: fromRetake  // Pass the fromRetake flag to PhotoGallery
      }, { animation: 'none' });
      
      // No need for fallback as we're directly navigating to PhotoGallery
    } catch (error) {
      console.error('Error taking picture:', error);
      errorLogger.logError(error, { 
        componentStack: 'CameraScreen.captureAndSave',
        extraInfo: 'Failed during photo capture, processing, or saving'
      });
      setIsProcessing(false);
      Alert.alert(
        'Error',
        'Failed to take picture. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle close button, decide return location based on source
  const handleClose = () => {
    try {
      if (fromRetake) {
        // If coming from retake, return to home to refresh state
        navigation.navigate('Home', {}, { animation: 'none' });
      } else {
        // Otherwise normal return
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error handling close:', error);
      errorLogger.logError(error, { 
        componentStack: 'CameraScreen.handleClose',
        extraInfo: 'Failed to navigate during close'
      });
      // Fallback to navigating home on error
      navigation.navigate('Home', {}, { animation: 'none' });
    }
  };

  // Camera permissions are still loading
  if (!permission) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  // Camera permissions are not granted yet
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, { marginTop: SPACING.m }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar area */}
      <View style={[
        styles.topBar,
        { paddingTop: insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 40 : 20 }
      ]}>
        <Text style={styles.quoteText}>"{quote}"</Text>
      </View>
      
      {/* Camera viewfinder area */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={onCameraReady}
          enableZoomGesture
          ratio="1:1"
        >
          {/* Grid overlay - helps with alignment */}
          <View style={styles.gridOverlay}>
            <View style={styles.gridHorizontalTop} />
            <View style={styles.gridHorizontalBottom} />
            <View style={styles.gridVerticalLeft} />
            <View style={styles.gridVerticalRight} />
          </View>
        </CameraView>
      </View>
      
      {/* Bottom bar area */}
      <View style={[
        styles.bottomBar,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === 'ios' ? 20 : 10 }
      ]}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={() => navigation.navigate('PhotoGallery')}
          >
            <MaterialIcons name="photo-library" size={28} color="white" />
          </TouchableOpacity>

          <Animated.View style={[styles.captureButtonContainer, {
            transform: [{ scale: scaleAnim }]
          }]}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                (!isCameraReady || isProcessing) && styles.captureButtonDisabled
              ]}
              onPress={takePicture}
              disabled={!isCameraReady || isProcessing}
            />
          </Animated.View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
          >
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    height: '15%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
  },
  quoteText: {
    color: 'white',
    fontSize: FONT_SIZE.m,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 20,
  },
  cameraContainer: {
    width: screenWidth,
    height: screenWidth, 
    overflow: 'hidden',
    marginTop: 70,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  bottomBar: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    padding: SPACING.m,
  },
  captureButtonContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.l,
    marginBottom: SPACING.m,
  },
  loadingText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    marginBottom: SPACING.m,
  },
  permissionButton: {
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridHorizontalTop: {
    position: 'absolute',
    top: '33%',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridHorizontalBottom: {
    position: 'absolute',
    top: '66%',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridVerticalLeft: {
    position: 'absolute',
    left: '33%',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  gridVerticalRight: {
    position: 'absolute',
    left: '66%',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

// Wrap component with error boundary
export default withErrorBoundary(CameraScreen); 