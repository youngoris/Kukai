import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import googleDriveService from '../services/GoogleDriveService';

const CloudBackupSection = ({ navigation, onBackupComplete }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState('daily');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showBackupListModal, setShowBackupListModal] = useState(false);
  const [backups, setBackups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Initialize
  useEffect(() => {
    initializeGoogleDrive();
  }, []);

  // Initialize Google Drive service
  const initializeGoogleDrive = async () => {
    setIsLoading(true);
    try {
      // Initialize service
      const initialized = await googleDriveService.initialize();
      setIsAuthenticated(initialized);

      // Load auto sync settings
      if (initialized) {
        loadSyncSettings();
        loadLastSyncTime();
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load sync settings
  const loadSyncSettings = async () => {
    try {
      const settings = await googleDriveService.getAutoSyncSettings();
      setAutoSyncEnabled(settings.enabled);
      setSyncFrequency(settings.frequency || 'daily');
    } catch (error) {
      console.error('Failed to load sync settings:', error);
    }
  };

  // Load last sync time
  const loadLastSyncTime = async () => {
    try {
      const lastSync = await googleDriveService.getLastSyncTime();
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  };

  // Handle Google authentication
  const handleAuthenticate = async () => {
    setIsLoading(true);
    try {
      const success = await googleDriveService.authenticate();
      setIsAuthenticated(success);
      
      if (success) {
        loadSyncSettings();
        Alert.alert('Success', 'Successfully connected to Google Drive');
      } else {
        Alert.alert('Error', 'Failed to connect to Google Drive');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from Google Drive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const success = await googleDriveService.signOut();
              if (success) {
                setIsAuthenticated(false);
                setAutoSyncEnabled(false);
                Alert.alert('Success', 'Disconnected from Google Drive');
              } else {
                Alert.alert('Error', 'Failed to disconnect');
              }
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'An error occurred during disconnection');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle create backup
  const handleCreateBackup = async () => {
    if (!isAuthenticated) {
      Alert.alert('Note', 'Please connect to Google Drive first');
      return;
    }

    Alert.prompt(
      'Create Backup',
      'Enter backup description (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (description) => {
            setIsLoading(true);
            try {
              const result = await googleDriveService.createBackup({ description });
              
              if (result.success) {
                Alert.alert('Success', 'Backup created successfully');
                loadLastSyncTime();
                if (onBackupComplete) onBackupComplete();
              } else {
                Alert.alert('Error', `Failed to create backup: ${result.error}`);
              }
            } catch (error) {
              console.error('Backup creation error:', error);
              Alert.alert('Error', 'An error occurred during backup creation');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  // Handle restore backup
  const handleRestoreBackup = async () => {
    if (!isAuthenticated) {
      Alert.alert('Note', 'Please connect to Google Drive first');
      return;
    }

    setIsLoading(true);
    try {
      const backupList = await googleDriveService.getBackups();
      setBackups(backupList);
      setIsLoading(false);
      
      if (backupList.length === 0) {
        Alert.alert('Note', 'No backups available');
        return;
      }
      
      setShowBackupListModal(true);
    } catch (error) {
      console.error('Error loading backups:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to load backup list');
    }
  };

  // Confirm restore specific backup
  const confirmRestore = (backup) => {
    Alert.alert(
      'Restore Backup',
      'This will replace all current data with the selected backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setShowBackupListModal(false);
            setIsLoading(true);
            
            try {
              const result = await googleDriveService.restoreBackup(backup.id);
              
              if (result.success) {
                Alert.alert(
                  'Success', 
                  `Backup restored successfully. ${result.restoredItems} items restored.`,
                  [{ 
                    text: 'OK', 
                    onPress: () => {
                      if (onBackupComplete) onBackupComplete();
                    } 
                  }]
                );
              } else {
                Alert.alert('Error', `Failed to restore backup: ${result.error}`);
              }
            } catch (error) {
              console.error('Restore error:', error);
              Alert.alert('Error', 'An error occurred during restoration');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle delete backup
  const handleDeleteBackup = (backup) => {
    Alert.alert(
      'Delete Backup',
      'Are you sure you want to delete this backup?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await googleDriveService.deleteBackup(backup.id);
              
              if (success) {
                // Remove deleted backup from list
                setBackups(backups.filter(b => b.id !== backup.id));
                Alert.alert('Success', 'Backup deleted');
              } else {
                Alert.alert('Error', 'Failed to delete backup');
              }
            } catch (error) {
              console.error('Delete backup error:', error);
              Alert.alert('Error', 'An error occurred during backup deletion');
            }
          }
        }
      ]
    );
  };

  // Handle auto sync toggle
  const handleAutoSyncToggle = async (value) => {
    setAutoSyncEnabled(value);
    
    try {
      await googleDriveService.setAutoSync(value, syncFrequency);
      
      if (value) {
        // If auto sync is enabled, check if immediate sync is needed
        googleDriveService.checkAndPerformAutoSync().then(performed => {
          if (performed) {
            loadLastSyncTime();
          }
        });
      }
    } catch (error) {
      console.error('Failed to set auto sync:', error);
      Alert.alert('Error', 'Failed to set auto sync');
    }
  };

  // Handle sync frequency change
  const handleFrequencyChange = async (frequency) => {
    setSyncFrequency(frequency);
    
    try {
      await googleDriveService.setAutoSync(autoSyncEnabled, frequency);
    } catch (error) {
      console.error('Failed to set sync frequency:', error);
      Alert.alert('Error', 'Failed to set sync frequency');
    }
  };

  // Refresh backup list
  const refreshBackups = async () => {
    setRefreshing(true);
    try {
      const backupList = await googleDriveService.getBackups();
      setBackups(backupList);
    } catch (error) {
      console.error('Error refreshing backups:', error);
      Alert.alert('Error', 'Failed to refresh backup list');
    } finally {
      setRefreshing(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render backup list modal
  const renderBackupListModal = () => {
    return (
      <Modal
        visible={showBackupListModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBackupListModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Backup</Text>
            
            <FlatList
              data={backups}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.backupItem}>
                  <TouchableOpacity
                    style={styles.backupInfo}
                    onPress={() => confirmRestore(item)}
                  >
                    <Text style={styles.backupName}>{item.name}</Text>
                    <Text style={styles.backupDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                    {item.description && (
                      <Text style={styles.backupDescription}>{item.description}</Text>
                    )}
                    <Text style={styles.backupSize}>{formatSize(item.size)}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteBackup(item)}
                  >
                    <MaterialIcons name="delete" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No backups available</Text>
              }
              refreshing={refreshing}
              onRefresh={refreshBackups}
            />
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBackupListModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Cloud Backup</Text>
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
      
      {/* Google Drive connection status */}
      <View style={styles.settingItem}>
        <View style={styles.settingContent}>
          <View style={styles.settingLabelContainer}>
            <MaterialIcons name="cloud" size={22} color="#FFFFFF" style={styles.settingIcon} />
            <Text style={styles.settingLabel}>Google Drive</Text>
          </View>
          <Text style={styles.settingDescription}>
            {isAuthenticated 
              ? 'Connected, ready for backup and sync' 
              : 'Not connected, tap to enable cloud backup'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.actionButton,
            isAuthenticated ? styles.disconnectButton : styles.connectButton
          ]}
          onPress={isAuthenticated ? handleSignOut : handleAuthenticate}
        >
          <MaterialIcons 
            name={isAuthenticated ? "link-off" : "link"} 
            size={16} 
            color="#FFFFFF" 
            style={styles.actionButtonIcon} 
          />
          <Text style={styles.actionButtonText}>
            {isAuthenticated ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {isAuthenticated && (
        <>
          {/* Last sync time */}
          {lastSyncTime && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Last sync:</Text>
              <Text style={styles.infoValue}>{formatDate(lastSyncTime)}</Text>
            </View>
          )}
          
          {/* Backup and restore buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleCreateBackup}
            >
              <MaterialIcons name="backup" size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Create Backup</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.button}
              onPress={handleRestoreBackup}
            >
              <MaterialIcons name="restore" size={24} color="#FFFFFF" />
              <Text style={styles.buttonText}>Restore Backup</Text>
            </TouchableOpacity>
          </View>
          
          {/* Auto sync settings */}
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Auto Sync</Text>
              <Text style={styles.settingDescription}>
                Automatically backup data to Google Drive periodically
              </Text>
            </View>
            
            <Switch
              trackColor={{ false: "#222222", true: "#777777" }}
              thumbColor={autoSyncEnabled ? "#FFFFFF" : "#888888"}
              ios_backgroundColor="#222222"
              onValueChange={handleAutoSyncToggle}
              value={autoSyncEnabled}
            />
          </View>
          
          {/* Sync frequency selector */}
          {autoSyncEnabled && (
            <View style={styles.frequencySelector}>
              <Text style={styles.frequencyLabel}>Sync frequency:</Text>
              <View style={styles.frequencyOptions}>
                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    syncFrequency === 'daily' && styles.frequencyOptionSelected
                  ]}
                  onPress={() => handleFrequencyChange('daily')}
                >
                  <Text style={styles.frequencyText}>Daily</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    syncFrequency === 'weekly' && styles.frequencyOptionSelected
                  ]}
                  onPress={() => handleFrequencyChange('weekly')}
                >
                  <Text style={styles.frequencyText}>Weekly</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    syncFrequency === 'monthly' && styles.frequencyOptionSelected
                  ]}
                  onPress={() => handleFrequencyChange('monthly')}
                >
                  <Text style={styles.frequencyText}>Monthly</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
      
      {renderBackupListModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  settingContent: {
    flex: 1,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 8,
  },
  settingLabel: {
    color: '#CCC',
    fontSize: 16,
  },
  settingDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#444',
  },
  disconnectButton: {
    backgroundColor: '#555',
  },
  actionButtonIcon: {
    marginRight: 5,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
    marginRight: 5,
  },
  infoValue: {
    color: '#CCC',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 8,
  },
  frequencySelector: {
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  frequencyLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  frequencyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  frequencyOption: {
    flex: 1,
    backgroundColor: '#222',
    padding: 10,
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 5,
  },
  frequencyOptionSelected: {
    backgroundColor: '#444',
  },
  frequencyText: {
    color: '#CCC',
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  backupInfo: {
    flex: 1,
  },
  backupName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  backupDate: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 5,
  },
  backupDescription: {
    color: '#888',
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  backupSize: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  deleteButton: {
    padding: 5,
  },
  closeButton: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  emptyListText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
});

export default CloudBackupSection; 