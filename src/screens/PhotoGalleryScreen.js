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

  // Photo size calculation considering safe margins
  const containerPadding = SPACING.s * 2; // Container padding
  const footerHeight = 100; // Bottom navigation area height
  const availableWidth = width - containerPadding;
  const totalGapWidth = GRID_SPACING * (columnCount - 1);
  const itemSize = Math.floor((availableWidth - totalGapWidth) / columnCount);

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

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
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
    
    return {
      dateTime,
      deviceInfo,
      shotInfo,
      resolution,
      location
    };
  };

  // Get photo title (month day, year)
  const getPhotoTitle = (photo) => {
    if (!photo) return '';
    
    return format(photo.date, 'MMMM d, yyyy'); // Month day, year format
  };

  // Toggle photo info display
  const togglePhotoInfo = () => {
    setShowPhotoInfo(!showPhotoInfo);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Selfies</Text>
      </View>
      
      {photosGrouped.length > 0 ? (
        <SectionList
          sections={photosGrouped}
          keyExtractor={(item) => item.uri}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          numColumns={columnCount}
          columnWrapperStyle={{
            justifyContent: 'flex-start',
            flexDirection: 'row',
            flexWrap: 'wrap'
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySubtext}>Take your first daily selfie!</Text>
          <TouchableOpacity
            style={styles.takePictureButton}
            onPress={handleTakeNewPicture}
          >
            <Text style={styles.takePictureButtonText}>Take Picture</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Footer with navigation buttons */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Home', {}, { animation: 'none' })}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <MaterialIcons name="settings" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Settings Modal */}
      {showSettings && (
        <View style={styles.settingsContainer}>
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsTitle}>Photos per row</Text>
            <View style={styles.columnOptions}>
              {[3, 4, 5, 6].map(count => renderColumnOption(count))}
            </View>
          </View>
        </View>
      )}
      
      {/* Photo Preview Modal */}
      <Modal
        visible={selectedPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closePhotoPreview}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Title */}
          {selectedPhoto && (
            <Text style={styles.previewTitle}>
              {getPhotoTitle(selectedPhoto)}
            </Text>
          )}
          
          {/* Photo preview area */}
          <View style={styles.previewContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.text.primary} />
            ) : (
              <Image 
                source={{ 
                  uri: viewingColorVersion ? colorVersionUri : selectedPhoto?.uri 
                }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </View>
          
          {/* Photo info display */}
          {showPhotoInfo && selectedPhoto && (
            <View style={styles.photoInfoContainer}>
              <View style={styles.photoInfoRow}>
                <View style={styles.photoInfoItem}>
                  <MaterialIcons name="access-time" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.photoInfoText}>
                    {getPhotoInfo(selectedPhoto).dateTime}
                  </Text>
                </View>
                
                <View style={styles.photoInfoItem}>
                  <MaterialIcons name="high-quality" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.photoInfoText}>
                    {getPhotoInfo(selectedPhoto).resolution}
                  </Text>
                </View>
              </View>
              
              <View style={styles.photoInfoRow}>
                <View style={styles.photoInfoItem}>
                  <MaterialIcons name="phone-android" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.photoInfoText}>
                    {getPhotoInfo(selectedPhoto).deviceInfo}
                  </Text>
                </View>
              </View>
              
              {getPhotoInfo(selectedPhoto).shotInfo && (
                <View style={styles.photoInfoRow}>
                  <View style={styles.photoInfoItem}>
                    <MaterialIcons name="camera" size={16} color={COLORS.text.secondary} />
                    <Text style={styles.photoInfoText}>
                      {getPhotoInfo(selectedPhoto).shotInfo}
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.photoInfoRow}>
                <View style={styles.photoInfoItem}>
                  <MaterialIcons name="location-on" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.photoInfoText}>
                    {getPhotoInfo(selectedPhoto).location}
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          {/* Bottom control bar */}
          <View style={styles.previewControls}>
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={togglePhotoInfo}
              disabled={isLoading}
            >
              <MaterialIcons 
                name={showPhotoInfo ? "info-outline" : "info"} 
                size={26} 
                color={showPhotoInfo ? COLORS.text.primary : COLORS.text.secondary} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={saveToGallery}
              disabled={isLoading}
            >
              <MaterialIcons name="save-alt" size={26} color={COLORS.text.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={retakePhoto}
              disabled={isLoading}
            >
              <MaterialIcons name="rotate-right" size={26} color={COLORS.text.secondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.previewButton} 
              onPress={closePhotoPreview}
              disabled={isLoading}
            >
              <MaterialIcons name="close" size={26} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    marginTop: -130, // Fine-tune photo position
  },
  previewImage: {
    width: width * 0.85,
    height: width * 0.85, 
    maxHeight: height * 0.6,
    borderRadius: 8,
  },
  photoInfoContainer: {
    width: '85%',
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    padding: SPACING.m,
    borderRadius: 12,
    position: 'absolute',
    bottom: 180, // Increase distance from bottom control bar
  },
  photoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs, // Reduce row spacing
  },
  photoInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: SPACING.s,
  },
  photoInfoText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
    marginLeft: SPACING.xs, // Reduce icon and text spacing
    flexShrink: 1,
  },
  previewControls: {
    position: 'absolute',
    bottom: 40, // Raise bottom position
    width: '85%',
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
    // paddingHorizontal: SPACING.m,
    // marginVertical: SPACING.xs,
    borderRadius: 4,
    alignItems: 'flex-start',
  },
  sectionHeaderText: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.s,
    fontWeight: '600',
    textAlign: 'left',
  },
});

export default PhotoGalleryScreen; 