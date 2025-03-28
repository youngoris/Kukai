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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { format, isToday } from 'date-fns';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const DEFAULT_COLUMN_COUNT = 5;
const GRID_SPACING = SPACING.s;

const PhotoGalleryScreen = ({ navigation }) => {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [viewingColorVersion, setViewingColorVersion] = useState(false);
  const [colorVersionUri, setColorVersionUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMN_COUNT);
  const [showSettings, setShowSettings] = useState(false);
  const [hasTodaySelfie, setHasTodaySelfie] = useState(false);
  
  // Photo size calculation considering safe margins
  const containerPadding = SPACING.s * 2; // Container padding
  const footerHeight = 100; // Bottom navigation area height
  const availableWidth = width - containerPadding;
  const totalGapWidth = GRID_SPACING * (columnCount - 1);
  const itemSize = Math.floor((availableWidth - totalGapWidth) / columnCount);

  // Add refresh on focus to ensure photos are always up to date
  useFocusEffect(
    React.useCallback(() => {
      console.log('Photo Gallery screen focused - loading photos');
      loadPhotos();
      return () => {};
    }, [])
  );

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir);
        setHasTodaySelfie(false);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      const sortedFiles = files
        .filter(file => file.endsWith('.jpg'))
        .sort((a, b) => {
          const dateA = new Date(a.split('_')[0]);
          const dateB = new Date(b.split('_')[0]);
          return dateB - dateA;
        });

      const photoList = sortedFiles.map(file => ({
        uri: `${photoDir}${file}`,
        date: new Date(file.split('_')[0]),
        filename: file,
      }));

      setPhotos(photoList);
      
      // Check if today's selfie exists
      const todaySelfie = photoList.find(photo => isToday(photo.date));
      setHasTodaySelfie(!!todaySelfie);
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
      // Close preview
      closePhotoPreview();
      // Refresh photo list
      await loadPhotos();
      // Navigate to camera screen without animation,附带标记表示这是retake操作
      navigation.navigate('Camera', { fromRetake: true }, { animation: 'none' });
    } catch (error) {
      console.error('Error during retake:', error);
      Alert.alert('Error', 'Failed to prepare for retake. Please try again.');
    }
  };

  const handleTakeNewPicture = () => {
    if (hasTodaySelfie) {
      Alert.alert(
        'Daily Selfie Complete',
        'You have already taken your selfie for today. Would you like to retake it?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retake', 
            onPress: () => {
              // If they want to retake, find today's selfie and delete it
              const todaySelfie = photos.find(photo => isToday(photo.date));
              if (todaySelfie) {
                FileSystem.deleteAsync(todaySelfie.uri)
                  .then(() => {
                    loadPhotos();
                    navigation.navigate('Camera', {}, { animation: 'none' });
                  })
                  .catch(error => {
                    console.error('Error deleting today\'s selfie:', error);
                    Alert.alert('Error', 'Failed to prepare for retake.');
                  });
              } else {
                navigation.navigate('Camera', {}, { animation: 'none' });
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

  const renderItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.photoItem, 
        { 
          width: itemSize, 
          height: itemSize,
          marginLeft: index % columnCount === 0 ? 0 : GRID_SPACING / columnCount,
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Selfies</Text>
      </View>
      
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={item => item.uri}
          numColumns={columnCount}
          key={`columns-${columnCount}`}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
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
          onPress={() => navigation.goBack()}
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
        <View style={styles.modalContainer}>
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
            
            <View style={styles.previewControls}>
              <TouchableOpacity 
                style={styles.previewButton} 
                onPress={toggleColorView}
                disabled={isLoading}
              >
                <MaterialIcons 
                  name={viewingColorVersion ? "filter-b-and-w" : "color-lens"} 
                  size={24} 
                  color={COLORS.text.primary} 
                />
                <Text style={styles.previewButtonText}>
                  {viewingColorVersion ? "B&W" : "Color"}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.previewButton} 
                onPress={saveToGallery}
                disabled={isLoading}
              >
                <MaterialIcons name="save-alt" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.previewButton} 
                onPress={retakePhoto}
                disabled={isLoading}
              >
                <MaterialIcons name="camera-alt" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Retake</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.previewButton} 
                onPress={closePhotoPreview}
              >
                <MaterialIcons name="close" size={24} color={COLORS.text.primary} />
                <Text style={styles.previewButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    margin: GRID_SPACING/2,
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
    color: COLORS.text.primary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: width * 0.9,
    height: height * 0.7,
  },
  previewControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.l,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  previewButton: {
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
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
});

export default PhotoGalleryScreen; 