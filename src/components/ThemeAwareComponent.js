import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, FONT_SIZE } from '../constants/theme';

// Example component that uses the app context
const ThemeAwareComponent = ({ title, description }) => {
  // Get theme and settings from context
  const { theme, settings } = useApp();
  
  // Get colors based on current theme
  const colors = COLORS[theme];

  // Create dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      padding: SPACING.m,
      borderRadius: 8,
      borderColor: colors.border,
      borderWidth: 1,
    },
    title: {
      color: colors.text.primary,
      fontSize: FONT_SIZE.l,
      fontWeight: 'bold',
      marginBottom: SPACING.s,
    },
    description: {
      color: colors.text.secondary,
      fontSize: FONT_SIZE.m,
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>{title}</Text>
      <Text style={dynamicStyles.description}>{description}</Text>
    </View>
  );
};

export default ThemeAwareComponent; 