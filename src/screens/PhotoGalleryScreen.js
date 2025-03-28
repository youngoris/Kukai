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
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { format } from 'date-fns';
import { COLORS, SPACING, FONT_SIZE } from '../constants/DesignSystem';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const GRID_SPACING = SPACING.s;
const ITEM_SIZE = (width - (COLUMN_COUNT + 1) * GRID_SPACING) / COLUMN_COUNT;

const PhotoGalleryScreen = () => {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const photoDir = `${FileSystem.documentDirectory}selfies/`;
      const dirInfo = await FileSystem.getInfoAsync(photoDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photoDir);
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
      }));

      setPhotos(photoList);
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.photoItem}>
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Selfies</Text>
      {photos.length > 0 ? (
        <FlatList
          data={photos}
          renderItem={renderItem}
          keyExtractor={item => item.uri}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySubtext}>Take your first daily selfie!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: SPACING.l,
    paddingHorizontal: SPACING.l,
  },
  gridContainer: {
    padding: GRID_SPACING,
  },
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GRID_SPACING,
    borderRadius: 12,
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
  },
});

export default PhotoGalleryScreen; 