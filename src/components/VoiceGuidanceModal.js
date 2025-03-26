import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  Pressable
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

const VoiceGuidanceModal = ({
  visible,
  onClose,
  settings,
  onSettingChange,
  setSettingsChanged,
}) => {
  // Handle slider value for display purposes
  const formatVoiceSpeed = (value) => {
    return `${value.toFixed(2)}x`;
  };

  // Update this component to add a save button at the bottom
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.overlay} 
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Voice Guidance</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Voice Guidance Switch */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Voice Guidance</Text>
                <Text style={styles.settingDescription}>
                  Enable spoken guidance during meditation
                </Text>
              </View>
              <Switch
                value={settings.voiceGuidanceEnabled}
                onValueChange={(value) => {
                  onSettingChange('voiceGuidanceEnabled', value);
                  setSettingsChanged(true);
                }}
                trackColor={{ false: '#333', true: '#444' }}
                thumbColor={settings.voiceGuidanceEnabled ? '#FFF' : '#888'}
              />
            </View>

            {/* Guidance Type */}
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => onSettingChange('guidanceTypeSelector', true)}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Guidance Type</Text>
                <Text style={styles.settingDescription}>
                  Choose the meditation guidance script
                </Text>
              </View>
              <View style={styles.valueContainer}>
                <Text style={styles.valueText}>
                  {settings.guidanceType === 'dailyFocus' ? 'Daily Focus' : 
                   settings.guidanceType === 'quickFocus' ? 'Quick Focus' :
                   settings.guidanceType === 'stressRelief' ? 'Stress Relief' :
                   settings.guidanceType === 'bedtime' ? 'Bedtime' : 'Daily Focus'}
                </Text>
                <MaterialIcons name="chevron-right" size={24} color="#AAA" />
              </View>
            </TouchableOpacity>

            {/* Voice Selection */}
            <TouchableOpacity 
              style={styles.settingRow} 
              onPress={() => onSettingChange('voiceSelector', true)}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Voice</Text>
                <Text style={styles.settingDescription}>
                  Select the voice for meditation guidance
                </Text>
              </View>
              <View style={styles.valueContainer}>
                <Text style={styles.valueText}>
                  {settings.selectedVoice === 'en-US-JennyMultilingualNeural' ? 'Jenny (Default)' :
                   settings.selectedVoice === 'en-US-GuyNeural' ? 'Guy' :
                   settings.selectedVoice === 'en-US-AriaNeural' ? 'Aria' :
                   settings.selectedVoice === 'en-US-ChristopherNeural' ? 'Christopher' : 'Jenny (Default)'}
                </Text>
                <MaterialIcons name="chevron-right" size={24} color="#AAA" />
              </View>
            </TouchableOpacity>

            {/* Voice Volume */}
            <View style={styles.settingItemVertical}>
              <View style={styles.settingTitleRow}>
                <Text style={styles.settingLabel}>Voice Volume</Text>
                <Text style={styles.settingValue}>{Math.round(settings.voiceVolume * 100)}%</Text>
              </View>
              <Text style={styles.settingDescription}>
                Adjust the volume of the guidance voice
              </Text>
              <View style={styles.sliderContainer}>
                <MaterialIcons name="volume-down" size={22} color="#888" />
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={settings.voiceVolume}
                  onValueChange={(value) => {
                    onSettingChange('voiceVolume', value);
                    setSettingsChanged(true);
                  }}
                  minimumTrackTintColor="#FFFFFF"
                  maximumTrackTintColor="#333333"
                  thumbTintColor="#FFFFFF"
                />
                <MaterialIcons name="volume-up" size={22} color="#888" />
              </View>
            </View>

            {/* Voice Speed */}
            <View style={styles.settingItemVertical}>
              <View style={styles.settingTitleRow}>
                <Text style={styles.settingLabel}>Voice Speed</Text>
                <Text style={styles.settingValue}>{formatVoiceSpeed(settings.voiceSpeed)}</Text>
              </View>
              <Text style={styles.settingDescription}>
                Adjust how fast the guidance voice speaks
              </Text>
              <View style={styles.sliderContainer}>
                <MaterialIcons name="slow-motion-video" size={22} color="#888" />
                <Slider
                  style={styles.slider}
                  minimumValue={0.7}
                  maximumValue={1.4}
                  step={0.05}
                  value={settings.voiceSpeed}
                  onValueChange={(value) => {
                    onSettingChange('voiceSpeed', value);
                    setSettingsChanged(true);
                  }}
                  minimumTrackTintColor="#FFFFFF"
                  maximumTrackTintColor="#333333"
                  thumbTintColor="#FFFFFF"
                />
                <MaterialIcons name="fast-forward" size={22} color="#888" />
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
  },
  settingItemVertical: {
    paddingVertical: 16,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    marginBottom: 10,
  },
  settingContent: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 4,
  },
  settingValue: {
    color: '#FFF',
    fontSize: 16,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    color: '#FFF',
    marginRight: 5,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
});

export default VoiceGuidanceModal; 