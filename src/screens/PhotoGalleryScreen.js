import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { format, isToday, parseISO } from 'date-fns';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';
import { MaterialIcons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const DEFAULT_COLUMN_COUNT = 5;
const GRID_SPACING = SPACING.s;

const PhotoGalleryScreen = ({ navigation, route }) => {
  const [photos, setPhotos] = useState([]);
  const [photosGrouped, setPhotosGrouped] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [viewingColorVersion, setViewingColorVersion] = useState(false);
  const [colorVersionUri, setColorVersionUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMN_COUNT);
  const [showSettings, setShowSettings] = useState(false);
  const [hasTodaySelfie, setHasTodaySelfie] = useState(false);
  const [showPhotoInfo, setShowPhotoInfo] = useState(false);
  
  // Check if we came from a retake operation
  const fromRetake = route.params?.fromRetake || false;

  // Photo size calculation ensuring equal margins on both sides
  const screenPadding = SPACING.m; // Padding applied to entire screen edges
  const availableWidth = width - (screenPadding * 2); // Available width for photos
  const totalGapWidth = GRID_SPACING * (columnCount - 1); // Total width of gaps between photos
  const itemSize = Math.floor((availableWidth - totalGapWidth) / columnCount); // Size of each photo
  const rowWidth = (itemSize * columnCount) + totalGapWidth; // Total width of all photos in a row with gaps
  const rowMargin = (width - rowWidth) / 2; // Equal margin on both sides to center the photos

  // 获取设备安全区域尺寸
  const insets = useSafeAreaInsets();

  // Override hardware back button behavior if coming from retake
  useFocusEffect(
    React.useCallback(() => {
      if (fromRetake) {
        const onBackPress = () => {
          navigation.navigate('Home', {}, { animation: 'none' });
          return true; // Prevent default behavior
        };

        // Add back button handler for Android
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        // For iOS gesture navigation, we'll handle in componentDidMount below
        return () => subscription.remove();
      }
      return () => {}; // No override if not from retake
    }, [fromRetake])
  );

  // Handle navigation overrides when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('Photo Gallery screen focused - loading photos');
      loadPhotos();

      // Override navigation behavior if coming from retake
      if (fromRetake) {
        // Add a listener for beforeRemove to override the destination
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
          // If it's a gesture-triggered navigation (swipe back)
          if (e.data.action.type === 'GO_BACK') {
            // Prevent default navigation
            e.preventDefault();
            
            // Navigate to home instead
            navigation.navigate('Home', {}, { animation: 'none' });
          }
        });
        
        return unsubscribe;
      }
      
      return () => {};
    }, [fromRetake])
  );

  useEffect(() => {
    loadPhotos();
  }, []);

  // Group photos by month
  const groupPhotosByMonth = (photosList) => {
    // Create an object to group by month
    const groupedByMonth = {};
    
    photosList.forEach(photo => {
      const monthYear = format(photo.date, 'MMMM yyyy');
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(photo);
    });
    
    // Convert to format needed by SectionList
    const groupedData = Object.keys(groupedByMonth).map(month => ({
      title: month,
      data: groupedByMonth[month]
    }));
    
    // Sort in descending date order
    groupedData.sort((a, b) => {
      const dateA = new Date(a.data[0].date);
      const dateB = new Date(b.data[0].date);
      return dateB - dateA;
    });
    
    return groupedData;
  };

  const loadPhotos = async () => {
    try {
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        try {
          await FileSystem.makeDirectoryAsync(photoDir);
          console.log('Created selfies directory successfully in PhotoGalleryScreen');
        } catch (dirError) {
          console.log(`Directory creation issue in PhotoGalleryScreen: ${dirError.message}`);
          // Even if directory creation fails, still set these states to empty
        }
        setHasTodaySelfie(false);
        setPhotos([]);
        setPhotosGrouped([]);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      // Filter jpg files and sort by date in descending order
      const sortedFiles = files
        .filter(file => file.endsWith('.jpg'))
        .sort((a, b) => {
          const dateA = new Date(a.split('_')[0]);
          const dateB = new Date(b.split('_')[0]);
          return dateB - dateA;
        });

      // Create photo list and try to load EXIF data for each photo
      const photosList = [];
      
      for (const file of sortedFiles) {
        const photoUri = `${photoDir}${file}`;
        const exifFilePath = `${photoDir}${file.replace('.jpg', '.exif.json')}`;
        
        // Default to using date from filename
        let photoDate = new Date(file.split('_')[0]);
        let exifData = null;
        
        // Check if there's a corresponding EXIF data file
        const exifInfo = await FileSystem.getInfoAsync(exifFilePath);
        if (exifInfo.exists) {
          try {
            const exifString = await FileSystem.readAsStringAsync(exifFilePath);
            exifData = JSON.parse(exifString);
            
            // If there's a DateTime field, use it as the photo date
            if (exifData.DateTime) {
              // Convert EXIF date time string to Date object (format: 2023:06:15 14:30:25)
              const exifDate = exifData.DateTime.replace(/:/g, '-').replace(' ', 'T');
              photoDate = new Date(exifDate);
            }
          } catch (e) {
            console.error('Failed to parse EXIF data:', e);
          }
        }
        
        photosList.push({
          uri: photoUri,
          date: photoDate,
          filename: file,
          exif: exifData
        });
      }
      
      // Check for today's selfie
      const todaySelfie = photosList.find(photo => isToday(photo.date));
      setHasTodaySelfie(!!todaySelfie);
      console.log('Today selfie exists:', !!todaySelfie);
      
      // Set photo list
      setPhotos(photosList);
      
      // Group photos
      const groupedPhotos = groupPhotosByMonth(photosList);
      setPhotosGrouped(groupedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      setHasTodaySelfie(false);
    }
  };

  const openPhotoPreview = (photo) => {
    setSelectedPhoto(photo);
    setViewingColorVersion(false);
    setColorVersionUri(null);
  };

  const closePhotoPreview = () => {
    setSelectedPhoto(null);
    setViewingColorVersion(false);
    setColorVersionUri(null);
  };

  const generateColorVersion = async () => {
    if (!selectedPhoto || colorVersionUri) return;
    
    setIsLoading(true);
    try {
      // Use supported operation: resize to generate "color" version
      // Note: Since we can't directly apply color filters, we adjust size and clarity
      const imageInfo = await FileSystem.getInfoAsync(selectedPhoto.uri);
      
      // Increase quality and brightness to simulate color effect
      const colorVersion = await ImageManipulator.manipulateAsync(
        selectedPhoto.uri,
        [{ resize: { width: 1200, height: 1200 } }], // Change size to increase clarity
        {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.95, // Higher quality for brighter effect
        }
      );
      
      setColorVersionUri(colorVersion.uri);
      setViewingColorVersion(true);
    } catch (error) {
      console.error('Error generating color version:', error);
      Alert.alert('Error', 'Failed to show color version.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleColorView = async () => {
    if (!viewingColorVersion && !colorVersionUri) {
      await generateColorVersion();
    } else {
      setViewingColorVersion(!viewingColorVersion);
    }
  };

  const saveToGallery = async () => {
    try {
      // Request permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library permissions to save photos.');
        return;
      }
      
      setIsLoading(true);
      // Save whichever version is currently being viewed
      const uriToSave = viewingColorVersion ? colorVersionUri : selectedPhoto.uri;
      
      const asset = await MediaLibrary.createAssetAsync(uriToSave);
      await MediaLibrary.createAlbumAsync('Kukai', asset, false);
      
      Alert.alert('Success', 'Photo saved to your gallery.');
    } catch (error) {
      console.error('Error saving to gallery:', error);
      Alert.alert('Error', 'Failed to save photo to gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  // Modified retake logic: Delete current photo and navigate to camera
  const retakePhoto = async () => {
    if (!selectedPhoto) return;
    
    try {
      // Delete current photo
      await FileSystem.deleteAsync(selectedPhoto.uri);
      
      // Delete corresponding EXIF data file if it exists
      const exifFilePath = selectedPhoto.uri.replace('.jpg', '.exif.json');
      const exifInfo = await FileSystem.getInfoAsync(exifFilePath);
      if (exifInfo.exists) {
        await FileSystem.deleteAsync(exifFilePath);
      }
      
      // Close preview
      closePhotoPreview();
      
      // Refresh photo list to update hasTodaySelfie state
      await loadPhotos();
      
      // Navigate to camera screen without animation
      navigation.navigate('Camera', { fromRetake: true }, { animation: 'none' });
    } catch (error) {
      console.error('Error during retake:', error);
      Alert.alert('Error', 'Failed to prepare for retake. Please try again.');
    }
  };

  const handleTakeNewPicture = async () => {
    // Check today's selfie status each time
    await loadPhotos();
    
    if (hasTodaySelfie) {
      Alert.alert(
        'Daily Selfie Complete',
        'You have already taken your selfie for today. Would you like to retake it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retake', 
            onPress: async () => {
              // If retaking, find and delete today's selfie
              const todaySelfie = photos.find(photo => isToday(photo.date));
              if (todaySelfie) {
                try {
                  // Delete image file
                  await FileSystem.deleteAsync(todaySelfie.uri);
                  
                  // Delete corresponding EXIF data file if it exists
                  const exifFilePath = todaySelfie.uri.replace('.jpg', '.exif.json');
                  const exifInfo = await FileSystem.getInfoAsync(exifFilePath);
                  if (exifInfo.exists) {
                    await FileSystem.deleteAsync(exifFilePath);
                  }
                  
                  // Reload photos to update state
                  await loadPhotos();
                  
                  // Navigate to camera
                  navigation.navigate('Camera', { fromRetake: true }, { animation: 'none' });
                } catch (error) {
                  console.error('Error deleting today\'s selfie:', error);
                  Alert.alert('Error', 'Failed to prepare for retake.');
                }
              } else {
                // After rechecking, if no selfie for today, navigate directly to camera
                navigation.navigate('Camera', { fromRetake: true }, { animation: 'none' });
              }
            }
          }
        ]
      );
    } else {
      // No selfie today, go directly to camera
      navigation.navigate('Camera', {}, { animation: 'none' });
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.photoItem, 
        { 
          width: itemSize, 
          height: itemSize,
          margin: GRID_SPACING/2,
        }
      ]}
      onPress={() => openPhotoPreview(item)}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.photo}
        resizeMode="cover"
      />
      <Text style={styles.dateText}>
        {format(item.date, 'MMM d')}
      </Text>
    </TouchableOpacity>
  );

  const renderColumnOption = (count) => (
    <TouchableOpacity 
      key={`column-option-${count}`}
      style={[
        styles.columnOption, 
        columnCount === count && styles.columnOptionSelected
      ]}
      onPress={() => {
        setColumnCount(count);
        setShowSettings(false);
      }}
    >
      <Text style={[
        styles.columnOptionText,
        columnCount === count && styles.columnOptionTextSelected
      ]}>
        {count}
      </Text>
    </TouchableOpacity>
  );

  // Get photo information
  const getPhotoInfo = (photo) => {
    if (!photo) return null;
    
    const exif = photo.exif;
    let dateTime = format(photo.date, 'HH:mm'); 
    
    // Get camera information from EXIF
    let deviceInfo = Device.modelName || 'Unknown Device';
    if (exif?.LensModel) {
      deviceInfo = exif.LensModel;
    } else if (exif?.Make) {
      deviceInfo = `${exif.Make} ${exif.Model || ''}`;
    }
    
    // Get shooting parameters (ISO, shutter speed, aperture)
    let shotInfo = '';
    if (exif?.ISOSpeedRatings) {
      shotInfo += `ISO ${exif.ISOSpeedRatings[0]} `;
    }
    if (exif?.ExposureTime) {
      // Convert exposure time to fraction format (e.g., 0.0666... → 1/15s)
      const exposureTime = exif.ExposureTime;
      if (exposureTime < 1) {
        const denominator = Math.round(1 / exposureTime);
        shotInfo += `1/${denominator}s `;
      } else {
        shotInfo += `${exposureTime}s `;
      }
    }
    if (exif?.FNumber) {
      shotInfo += `f/${exif.FNumber}`;
    }
    
    // Get photo resolution
    let resolution = 'Unknown';
    if (exif?.PixelXDimension && exif?.PixelYDimension) {
      resolution = `${exif.PixelXDimension} × ${exif.PixelYDimension}`;
    }
    
    // Try to get location information
    let location = 'Location data not available';
    if (exif?.GPSLatitude && exif?.GPSLongitude) {
      location = `${exif.GPSLatitude}, ${exif.GPSLongitude}`;
    }
    
    // Use actual capture time from EXIF - try multiple fields
    try {
      // First try DateTimeDigitized
      if (exif?.DateTimeDigitized) {
        const exifDateStr = exif.DateTimeDigitized;
        // Standard EXIF date format: YYYY:MM:DD HH:MM:SS
        const [datePart, timePart] = exifDateStr.split(' ');
        if (datePart && timePart) {
          const [year, month, day] = datePart.split(':').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          
          // Check if date values are valid
          if (year > 0 && month > 0 && month <= 12 && day > 0 && day <= 31 &&
              hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
            const jsDate = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(jsDate.getTime())) {
              dateTime = format(jsDate, 'yyyy-MM-dd HH:mm:ss');
            }
          }
        }
      }
      // Alternative: try DateTimeOriginal
      else if (exif?.DateTimeOriginal) {
        const exifDateStr = exif.DateTimeOriginal;
        const [datePart, timePart] = exifDateStr.split(' ');
        if (datePart && timePart) {
          const [year, month, day] = datePart.split(':').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          
          if (year > 0 && month > 0 && month <= 12 && day > 0 && day <= 31 &&
              hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
            const jsDate = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(jsDate.getTime())) {
              dateTime = format(jsDate, 'yyyy-MM-dd HH:mm:ss');
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to format EXIF date:', e);
      // Use date from filename if error occurs
    }
    
    return (
      <View style={styles.photoInfoContent}>
        <View style={styles.photoInfoRow}>
          <View style={styles.photoInfoItem}>
            <MaterialIcons name="schedule" size={18} color={COLORS.text.primary} />
            <Text style={styles.photoInfoText}>{dateTime}</Text>
          </View>
        </View>
        
        <View style={styles.photoInfoRow}>
          <View style={styles.photoInfoItem}>
            <MaterialIcons name="photo-camera" size={18} color={COLORS.text.primary} />
            <Text style={styles.photoInfoText}>{deviceInfo}</Text>
          </View>
        </View>
        
        {shotInfo ? (
          <View style={styles.photoInfoRow}>
            <View style={styles.photoInfoItem}>
              <MaterialIcons name="tune" size={18} color={COLORS.text.primary} />
              <Text style={styles.photoInfoText}>{shotInfo}</Text>
            </View>
          </View>
        ) : null}
        
        <View style={styles.photoInfoRow}>
          <View style={styles.photoInfoItem}>
            <MaterialIcons name="aspect-ratio" size={18} color={COLORS.text.primary} />
            <Text style={styles.photoInfoText}>{resolution}</Text>
          </View>
        </View>
        
        <View style={styles.photoInfoRow}>
          <View style={styles.photoInfoItem}>
            <MaterialIcons name="location-on" size={18} color={COLORS.text.primary} />
            <Text style={styles.photoInfoText}>{location}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Get photo title (month day, year)
  const getPhotoTitle = (photo) => {
    if (!photo) return '';
    
    return format(photo.date, 'MMMM d, yyyy'); // Month day, year format
  };

  // Check if photo was taken today - used for retake button logic
  const isPhotoFromToday = (photo) => {
    if (!photo) return false;
    return isToday(photo.date);
  };

  // Toggle photo info display
  const togglePhotoInfo = () => {
    setShowPhotoInfo(!showPhotoInfo);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => fromRetake 
            ? navigation.navigate('Home', {}, { animation: 'none' })
            : navigation.goBack()
          }
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo Gallery</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <MaterialIcons name="tune" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Main content - Photo Grid */}
      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          {/* Placeholder photo grid background */}
          <View style={[styles.placeholderGrid, { paddingLeft: rowMargin, paddingRight: rowMargin }]}>
            {/* Create 15 rows with exact number of columns in each row */}
            {Array(15).fill().map((_, rowIndex) => (
              <View 
                key={`row-${rowIndex}`} 
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                  marginBottom: GRID_SPACING
                }}
              >
                {/* Generate exact number of columns per row */}
                {Array(columnCount).fill().map((_, colIndex) => (
                  <View 
                    key={`placeholder-${rowIndex}-${colIndex}`} 
                    style={[
                      styles.placeholderPhoto, 
                      { 
                        width: itemSize, 
                        height: itemSize,
                        marginLeft: colIndex === 0 ? 0 : GRID_SPACING/2,
                        marginRight: colIndex === columnCount - 1 ? 0 : GRID_SPACING/2,
                      }
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          
          <View style={styles.emptyContentOverlay}>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={handleTakeNewPicture}
            >
              <Text style={styles.emptyButtonText}>Take Your First Selfie</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={photosGrouped}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => (
            <View>
              {/* Section Header */}
              <View style={[styles.sectionHeader, { marginLeft: rowMargin, marginRight: rowMargin }]}>
                <Text style={styles.sectionHeaderText}>{item.title}</Text>
              </View>
              
              {/* Photos in this section */}
              <FlatList
                key={`column-${columnCount}`}
                data={item.data}
                keyExtractor={(photo, index) => photo.uri + index}
                renderItem={renderItem}
                horizontal={false}
                numColumns={columnCount}
                contentContainerStyle={[
                  styles.photosRow,
                  { marginLeft: rowMargin, marginRight: rowMargin }
                ]}
              />
            </View>
          )}
          contentContainerStyle={styles.galleryContainer}
        />
      )}
      
      {/* Footer controls */}
      <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleTakeNewPicture}
        >
          <MaterialIcons name="camera-alt" size={28} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Settings Panel */}
      {showSettings && (
        <View style={[styles.settingsPanel, { 
          position: 'absolute',
          right: SPACING.xl,
          top: insets.top + 50,
          zIndex: 10
        }]}>
          <Text style={styles.settingsTitle}>Grid Size</Text>
          <View style={styles.columnOptions}>
            {renderColumnOption(3)}
            {renderColumnOption(4)}
            {renderColumnOption(5)}
            {renderColumnOption(6)}
          </View>
        </View>
      )}
      
      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <Modal
          transparent={false}
          animationType="fade"
          onRequestClose={closePhotoPreview}
        >
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <Text style={[styles.previewTitle, { top: insets.top > 0 ? insets.top + 60 : 110 }]}>
              {getPhotoTitle(selectedPhoto)}
            </Text>
            
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: viewingColorVersion ? colorVersionUri : selectedPhoto.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
            
            {showPhotoInfo && (
              <View style={[styles.photoInfoContainer, { 
                bottom: insets.bottom > 0 ? insets.bottom + 110 : 100 
              }]}>
                {getPhotoInfo(selectedPhoto)}
              </View>
            )}
            
            <View style={[styles.previewControls, { 
              bottom: insets.bottom > 0 ? insets.bottom + 20 : 40 
            }]}>
              <TouchableOpacity style={styles.previewButton} onPress={togglePhotoInfo}>
                <MaterialIcons name="info-outline" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Info</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.previewButton} onPress={saveToGallery}>
                <MaterialIcons name="save-alt" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.previewButton,
                  // Add disabled styling if photo is not from today
                  !isPhotoFromToday(selectedPhoto) && styles.previewButtonDisabled
                ]} 
                onPress={isPhotoFromToday(selectedPhoto) ? retakePhoto : null}
                // Disable button press for photos not from today
                disabled={!isPhotoFromToday(selectedPhoto)}
              >
                <MaterialIcons 
                  name="camera-alt" 
                  size={24} 
                  // Use disabled color if photo is not from today
                  color={isPhotoFromToday(selectedPhoto) ? COLORS.text.primary : COLORS.text.tertiary} 
                />
                <Text style={[
                  styles.previewButtonText,
                  // Add disabled text styling if photo is not from today
                  !isPhotoFromToday(selectedPhoto) && styles.previewButtonTextDisabled
                ]}>
                  Retake
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.previewButton} onPress={closePhotoPreview}>
                <MaterialIcons name="close" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.text.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 5 : 10,
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  gridContainer: {
    padding: SPACING.s,
    paddingBottom: 100, // Space for footer
  },
  photoItem: {
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  dateText: {
    position: 'absolute',
    bottom: SPACING.xs,
    left: SPACING.xs,
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: 100, // Space for footer
  },
  emptyText: {
    fontSize: FONT_SIZE.l,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: SPACING.s,
  },
  emptySubtext: {
    fontSize: FONT_SIZE.m,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.l,
  },
  takePictureButton: {
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderRadius: 12,
    marginTop: SPACING.m,
  },
  takePictureButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: SPACING.m,
    backgroundColor: COLORS.background,
    zIndex: 2,
  },
  footerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: {
    position: 'absolute',
    top: 110,
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.l,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  previewContainer: {
    width: '100%',
    height: width,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -200, // Fine-tune photo position
  },
  previewImage: {
    width: width * 0.9,
    height: width * 0.9, 
    maxHeight: height * 0.6,
    borderRadius: 8,
  },
  photoInfoContainer: {
    width: '90%',
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    padding: SPACING.s,
    borderRadius: 12,
    position: 'absolute',
    bottom: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  photoInfoContent: {
    width: '100%',
    marginBottom: SPACING.s,
  },
  photoInfoRow: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  photoInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  photoInfoText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    marginLeft: SPACING.s,
    flex: 1,
  },
  previewControls: {
    position: 'absolute',
    bottom: 240, // Raise bottom position
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.s,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 30,
  },
  previewButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
  },
  settingsContainer: {
    position: 'absolute',
    bottom: 80,
    right: SPACING.xl,
    backgroundColor: 'transparent',
  },
  settingsPanel: {
    backgroundColor: COLORS.card,
    padding: SPACING.m,
    borderRadius: 12,
    width: 200,
  },
  settingsTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
    marginBottom: SPACING.m,
  },
  columnOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  columnOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  columnOptionSelected: {
    backgroundColor: COLORS.text.primary,
  },
  columnOptionText: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.m,
  },
  columnOptionTextSelected: {
    color: COLORS.background,
  },
  sectionHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: SPACING.s,
    marginBottom: SPACING.xs,
    borderRadius: 4,
    alignItems: 'flex-start',
  },
  sectionHeaderText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
    fontWeight: '600',
    textAlign: 'left',
  },
  backButton: {
    position: 'absolute',
    left: SPACING.m,
    top: Platform.OS === 'ios' ? 5 : 10,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  settingsButton: {
    position: 'absolute',
    right: SPACING.m,
    top: Platform.OS === 'ios' ? 5 : 10,
  },
  cameraButton: {
    position: 'absolute',
    right: SPACING.m,
    bottom: Platform.OS === 'ios' ? 30 : 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryContainer: {
    paddingBottom: 100, // Space for footer
    paddingTop: SPACING.s,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 0,
  },
  previewButtonDisabled: {
    opacity: 0.5,
  },
  previewButtonTextDisabled: {
    color: COLORS.text.tertiary,
  },
  placeholderGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    padding: 0,
    paddingTop: SPACING.s,
    opacity: 0.5,
    zIndex: 1,
    pointerEvents: 'none',
  },
  placeholderPhoto: {
    margin: GRID_SPACING/2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
  },
  emptyContentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.xl,
    zIndex: 2,
  },
  emptyButton: {
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZE.m,
    fontWeight: '600',
  },
});

export default PhotoGalleryScreen; 