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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const VIEWFINDER_SIZE = screenWidth * 0.8; // 80% of screen width for the square

// 自拍格言数组
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
  
  // 随机选择一条格言
  const [quote] = useState(
    SELFIE_QUOTES[Math.floor(Math.random() * SELFIE_QUOTES.length)]
  );
  
  // 检查是否来自retake操作
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
  };
  
  const captureAndSave = async () => {
    try {
      setIsProcessing(true); // Prevent multiple captures
      pressAnimation(scaleAnim);
      
      // Take the photo with 1:1 aspect ratio
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        skipProcessing: true,
        exif: false,
      });

      // Log photo dimensions for debugging
      console.log(`Original photo dimensions: ${photo.width}x${photo.height}`);
      
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
      }

      // Delete any existing selfies from today
      const files = await FileSystem.readDirectoryAsync(photoDir);
      const todayFiles = files.filter(file => {
        const date = new Date(file.split('_')[0]);
        return isToday(date);
      });
      
      for (const file of todayFiles) {
        await FileSystem.deleteAsync(`${photoDir}${file}`);
      }

      const fileName = `${format(new Date(), 'yyyy-MM-dd')}_${Date.now()}.jpg`;
      const newPhotoUri = `${photoDir}${fileName}`;
      
      // Crop to square if not already square
      const minSize = Math.min(photo.width, photo.height);
      const offsetX = (photo.width - minSize) / 2;
      const offsetY = (photo.height - minSize) / 2;
      
      // Apply crop and black and white effect
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
      navigation.navigate('PhotoGallery', {}, { animation: 'none' });
      
      // No need for fallback as we're directly navigating to PhotoGallery
    } catch (error) {
      console.error('Error taking picture:', error);
      setIsProcessing(false);
      Alert.alert(
        'Error',
        'Failed to take picture. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // 处理关闭按钮，根据来源决定返回位置
  const handleClose = () => {
    if (fromRetake) {
      // 如果是从retake来的，返回主页以刷新状态
      navigation.navigate('Home', {}, { animation: 'none' });
    } else {
      // 否则正常返回
      navigation.goBack();
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
    <SafeAreaView style={styles.container}>
      {/* 顶部黑边区域 */}
      <View style={styles.topBar}>
        <Text style={styles.quoteText}>{quote}</Text>
      </View>
      
      {/* 相机取景框区域 */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={onCameraReady}
          enableZoomGesture
          ratio="1:1"
        >
          {/* 辅助线框 - 帮助用户对齐 */}
          <View style={styles.gridOverlay}>
            <View style={styles.gridHorizontalTop} />
            <View style={styles.gridHorizontalBottom} />
            <View style={styles.gridVerticalLeft} />
            <View style={styles.gridVerticalRight} />
          </View>
        </CameraView>
      </View>
      
      {/* 底部黑边区域 */}
      <View style={styles.bottomBar}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <MaterialIcons name="flip-camera-ios" size={28} color="white" />
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
    </SafeAreaView>
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
  },
  cameraContainer: {
    width: screenWidth,
    height: screenWidth, // 正方形区域
    overflow: 'hidden',
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
    justifyContent: 'space-around',
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
  flipButton: {
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

export default CameraScreen; 