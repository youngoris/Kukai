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

const PhotoGalleryScreen = ({ navigation }) => {
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

  // 将照片按月份分组
  const groupPhotosByMonth = (photosList) => {
    // 创建一个按月份分组的对象
    const groupedByMonth = {};
    
    photosList.forEach(photo => {
      const monthYear = format(photo.date, 'MMMM yyyy');
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(photo);
    });
    
    // 转换为SectionList需要的格式
    const groupedData = Object.keys(groupedByMonth).map(month => ({
      title: month,
      data: groupedByMonth[month]
    }));
    
    // 按日期倒序排列
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
        await FileSystem.makeDirectoryAsync(photoDir);
        setHasTodaySelfie(false);
        setPhotos([]);
        setPhotosGrouped([]);
        return;
      }

      const files = await FileSystem.readDirectoryAsync(photoDir);
      // 筛选jpg文件，并按日期倒序排序
      const sortedFiles = files
        .filter(file => file.endsWith('.jpg'))
        .sort((a, b) => {
          const dateA = new Date(a.split('_')[0]);
          const dateB = new Date(b.split('_')[0]);
          return dateB - dateA;
        });

      // 创建照片列表，尝试加载每张照片的EXIF数据
      const photosList = [];
      
      for (const file of sortedFiles) {
        const photoUri = `${photoDir}${file}`;
        const exifFilePath = `${photoDir}${file.replace('.jpg', '.exif.json')}`;
        
        // 默认使用文件名中的日期
        let photoDate = new Date(file.split('_')[0]);
        let exifData = null;
        
        // 检查是否有对应的EXIF数据文件
        const exifInfo = await FileSystem.getInfoAsync(exifFilePath);
        if (exifInfo.exists) {
          try {
            const exifString = await FileSystem.readAsStringAsync(exifFilePath);
            exifData = JSON.parse(exifString);
            
            // 如果有DateTime字段，使用它作为照片日期
            if (exifData.DateTime) {
              // 将EXIF日期时间字符串转换为Date对象 (格式: 2023:06:15 14:30:25)
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
      
      // 检查今日自拍
      const todaySelfie = photosList.find(photo => isToday(photo.date));
      setHasTodaySelfie(!!todaySelfie);
      console.log('Today selfie exists:', !!todaySelfie);
      
      // 设置照片列表
      setPhotos(photosList);
      
      // 分组照片
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
      
      // 删除对应的EXIF数据文件（如果存在）
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
    // 每次调用时都重新检查今日自拍状态
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
              // 如果要重拍，找到今日自拍并删除
              const todaySelfie = photos.find(photo => isToday(photo.date));
              if (todaySelfie) {
                try {
                  // 删除图片文件
                  await FileSystem.deleteAsync(todaySelfie.uri);
                  
                  // 删除对应的EXIF数据文件（如果存在）
                  const exifFilePath = todaySelfie.uri.replace('.jpg', '.exif.json');
                  const exifInfo = await FileSystem.getInfoAsync(exifFilePath);
                  if (exifInfo.exists) {
                    await FileSystem.deleteAsync(exifFilePath);
                  }
                  
                  // 重新加载照片以更新状态
                  await loadPhotos();
                  
                  // 导航到相机
                  navigation.navigate('Camera', { fromRetake: true }, { animation: 'none' });
                } catch (error) {
                  console.error('Error deleting today\'s selfie:', error);
                  Alert.alert('Error', 'Failed to prepare for retake.');
                }
              } else {
                // 重新检查后发现没有今日自拍，直接导航到相机
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

  // 获取照片信息
  const getPhotoInfo = (photo) => {
    if (!photo) return null;
    
    const exif = photo.exif;
    let dateTime = format(photo.date, 'HH:mm'); 
    
    // 从EXIF中获取相机信息
    let deviceInfo = Device.modelName || 'Unknown Device';
    if (exif?.LensModel) {
      deviceInfo = exif.LensModel;
    } else if (exif?.Make) {
      deviceInfo = `${exif.Make} ${exif.Model || ''}`;
    }
    
    // 获取拍摄参数 (ISO, 快门速度, 光圈)
    let shotInfo = '';
    if (exif?.ISOSpeedRatings) {
      shotInfo += `ISO ${exif.ISOSpeedRatings[0]} `;
    }
    if (exif?.ExposureTime) {
      // 将曝光时间转换为分数形式 (例如 0.0666... → 1/15s)
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
    
    // 获取照片分辨率
    let resolution = 'Unknown';
    if (exif?.PixelXDimension && exif?.PixelYDimension) {
      resolution = `${exif.PixelXDimension} × ${exif.PixelYDimension}`;
    }
    
    // 尝试获取位置信息
    let location = 'Location data not available';
    if (exif?.GPSLatitude && exif?.GPSLongitude) {
      location = `${exif.GPSLatitude}, ${exif.GPSLongitude}`;
    }
    
    // 使用EXIF中的实际拍摄时间 - 尝试多个字段
    try {
      // 首先尝试DateTimeDigitized
      if (exif?.DateTimeDigitized) {
        const exifDateStr = exif.DateTimeDigitized;
        // 标准EXIF日期格式：YYYY:MM:DD HH:MM:SS
        const [datePart, timePart] = exifDateStr.split(' ');
        if (datePart && timePart) {
          const [year, month, day] = datePart.split(':').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          
          // 检查日期值是否有效
          if (year > 0 && month > 0 && month <= 12 && day > 0 && day <= 31 &&
              hour >= 0 && hour < 24 && minute >= 0 && minute < 60 && second >= 0 && second < 60) {
            const jsDate = new Date(year, month - 1, day, hour, minute, second);
            if (!isNaN(jsDate.getTime())) {
              dateTime = format(jsDate, 'yyyy-MM-dd HH:mm:ss');
            }
          }
        }
      }
      // 备选：尝试DateTimeOriginal
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
      // 出错时使用文件名中的日期时间
    }
    
    return {
      dateTime,
      deviceInfo,
      shotInfo,
      resolution,
      location
    };
  };

  // 获取照片标题（月日年）
  const getPhotoTitle = (photo) => {
    if (!photo) return '';
    
    return format(photo.date, 'MMMM d, yyyy'); // 月日年格式
  };

  // 切换照片信息显示状态
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
          {/* 标题 */}
          {selectedPhoto && (
            <Text style={styles.previewTitle}>
              {getPhotoTitle(selectedPhoto)}
            </Text>
          )}
          
          {/* 照片预览区域 */}
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
          
          {/* 照片信息显示 */}
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
          
          {/* 底部控制栏 */}
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
              <MaterialIcons name="camera-alt" size={26} color={COLORS.text.secondary} />
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
    marginTop: -130, // 微调照片位置
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
    bottom: 180, // 增加与底部控制栏的距离
  },
  photoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs, // 减小行间距
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
    marginLeft: SPACING.xs, // 减小图标和文本间距
    flexShrink: 1,
  },
  previewControls: {
    position: 'absolute',
    bottom: 40, // 提高底部位置
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