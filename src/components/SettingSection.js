import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * SettingSection component for grouping related settings
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Section title
 * @param {React.ReactNode} props.children - Child components (setting items)
 * @param {string} [props.theme='dark'] - UI theme ('dark' or 'light')
 */
const SettingSection = ({ title, children, theme = 'dark' }) => {
  const isDarkTheme = theme === 'dark';
  
  return (
    <View style={styles.settingSection}>
      <Text style={[
        styles.sectionTitle,
        !isDarkTheme && styles.lightSectionTitle
      ]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  settingSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    letterSpacing: 1,
  },
  sectionContent: {
    backgroundColor: '#111111',
    borderRadius: 10,
    overflow: 'hidden',
  },
  lightSectionTitle: {
    color: '#000000',
  },
});

export default SettingSection; 