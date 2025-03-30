import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import googleDriveService from "../services/GoogleDriveService";
import Constants from "expo-constants";
import storageService from "../services/storage/StorageService";

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

const CloudBackupSection = ({
  navigation,
  onBackupComplete,
  theme = "dark",
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState("daily");
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showBackupListModal, setShowBackupListModal] = useState(false);
  const [backups, setBackups] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // light or dark theme
  const isLightTheme = theme === "light";

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
      console.error("Failed to initialize Google Drive:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load sync settings
  const loadSyncSettings = async () => {
    try {
      const settings = await googleDriveService.getAutoSyncSettings();
      setAutoSyncEnabled(settings.enabled);
      setSyncFrequency(settings.frequency || "daily");
    } catch (error) {
      console.error("Failed to load sync settings:", error);
    }
  };

  // Load last sync time
  const loadLastSyncTime = async () => {
    try {
      const lastSync = await googleDriveService.getLastSyncTime();
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error("Failed to load last sync time:", error);
    }
  };

  // Handle Google authentication
  const handleAuthenticate = async () => {
    // Check if running in Expo Go
    if (isExpoGo) {
      Alert.alert(
        "Feature Limitation",
        "Expo Go has very limited support for Google authentication and may cause the app to crash.\n\nYou have the following options:",
        [
          {
            text: "Use Local Backup",
            onPress: () => {
              Alert.alert(
                "Use Local Backup",
                'The local backup feature allows you to export data to a file without needing a Google account. You can find the "Local Backup" feature in the settings menu.',
                [{ text: "Got it" }],
              );
            },
          },
          {
            text: "Use Mock Account",
            onPress: () => {
              useMockGoogleAccount();
            },
          },
          { text: "Cancel", style: "cancel" },
          {
            text: "Try Anyway",
            style: "destructive",
            onPress: () => attemptAuthenticate(),
          },
        ],
      );
      return;
    }

    attemptAuthenticate();
  };

  // Use mock Google account (no actual authentication needed)
  const useMockGoogleAccount = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setAutoSyncEnabled(false);
      setSyncFrequency("daily");
      setLastSyncTime(new Date().toISOString());
      Alert.alert(
        "Connected to Mock Account",
        "You are now connected to a mock Google account. Please note that this is only for interface demonstration, and actual data will not be uploaded to the cloud. Please use local backup to save important data.",
        [{ text: "Got it" }],
      );
      setIsLoading(false);
    }, 1500);
  };

  // Actual authentication attempt
  const attemptAuthenticate = async () => {
    setIsLoading(true);
    try {
      console.log("CloudBackupSection: Starting Google authentication...");
      const success = await googleDriveService.authenticate();
      setIsAuthenticated(success);

      if (success) {
        console.log("CloudBackupSection: Google authentication successful");
        loadSyncSettings();
        Alert.alert("Success", "Successfully connected to Google Drive");
      } else {
        console.log("CloudBackupSection: Google authentication failed");
        Alert.alert(
          "Error",
          "Unable to connect to Google Drive, please try again",
        );
      }
    } catch (error) {
      console.error("CloudBackupSection: Authentication error:", error);

      // Display more specific error message
      let errorMessage = "An error occurred during authentication";

      if (error.message.includes("Error DEVELOPER_ERROR")) {
        errorMessage =
          "Developer Error: Client ID may be invalid or incorrectly configured. Please check app settings.";
      } else if (error.message.includes("access_denied")) {
        errorMessage = "User denied the access request";
      } else if (error.message.includes("network")) {
        errorMessage =
          "Network Error: Please check your network connection and try again";
      } else if (error.message.includes("client_id")) {
        errorMessage = "Client ID Error: Google API configuration is incorrect";
      }

      // If an error occurs in Expo Go, add more guidance
      if (isExpoGo) {
        errorMessage +=
          "\n\nUsing Google authentication in Expo Go may be unstable. Consider creating a development build version for full functionality.";
      }

      Alert.alert("Authentication Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      "Disconnect",
      "Are you sure you want to disconnect from Google Drive?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const success = await googleDriveService.signOut();
              if (success) {
                setIsAuthenticated(false);
                setAutoSyncEnabled(false);
                Alert.alert("Success", "Disconnected from Google Drive");
              } else {
                Alert.alert("Error", "Failed to disconnect");
              }
            } catch (error) {
              console.error("Sign out error:", error);
              Alert.alert("Error", "An error occurred during disconnection");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  // Handle create backup
  const handleCreateBackup = async () => {
    if (!isAuthenticated) {
      Alert.alert("Note", "Please connect to Google Drive first");
      return;
    }

    Alert.prompt(
      "Create Backup",
      "Enter backup description (optional):",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: async (description) => {
            setIsLoading(true);
            try {
              // Collect all application data for backup
              const timestamp = new Date().toISOString();
              
              // Get all types of stored data
              const meditationsData = await storageService.getItem('meditations');
              const tasksData = await storageService.getItem('tasks');
              const journalData = await storageService.getItem('journal');
              const settingsData = await storageService.getItem('settings');
              
              // Prepare complete backup data structure
              const backupData = {
                description: description || `Backup created on ${new Date().toLocaleString()}`,
                timestamp: timestamp,
                data: {
                  meditations: meditationsData ? JSON.parse(meditationsData) : null,
                  tasks: tasksData ? JSON.parse(tasksData) : null,
                  journal: journalData ? JSON.parse(journalData) : null,
                  settings: settingsData ? JSON.parse(settingsData) : null
                }
              };
              
              console.log("Creating backup with data structure:", Object.keys(backupData.data));
              
              // Call backup service
              const result = await googleDriveService.createBackup(backupData);

              console.log("Backup successful:", result);
              Alert.alert("Success", "Backup created successfully");
              loadLastSyncTime();
              
              // Notify parent component when complete
              if (onBackupComplete) {
                onBackupComplete();
              }
            } catch (error) {
              console.error("Backup creation error:", error);
              Alert.alert("Error", `Failed to create backup: ${error.message || "Unknown error"}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      "plain-text",
    );
  };

  // Handle restore backup
  const handleRestoreBackup = async () => {
    if (!isAuthenticated) {
      Alert.alert("Note", "Please connect to Google Drive first");
      return;
    }

    setIsLoading(true);
    try {
      const backupList = await googleDriveService.getBackups();
      setBackups(backupList);
      setIsLoading(false);

      if (backupList.length === 0) {
        Alert.alert("Note", "No backups available");
        return;
      }

      setShowBackupListModal(true);
    } catch (error) {
      console.error("Error loading backups:", error);
      setIsLoading(false);
      Alert.alert("Error", "Failed to load backup list");
    }
  };

  // Confirm restore specific backup
  const confirmRestore = (backup) => {
    Alert.alert(
      "Restore Backup",
      "This will replace all current data with the selected backup. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setShowBackupListModal(false);
            setIsLoading(true);

            try {
              const result = await googleDriveService.restoreBackup(backup.id);

              if (result.success) {
                Alert.alert(
                  "Success",
                  `Backup restored successfully. ${result.restoredItems} items restored.`,
                  [
                    {
                      text: "OK",
                      onPress: () => {
                        if (onBackupComplete) onBackupComplete();
                      },
                    },
                  ],
                );
              } else {
                Alert.alert(
                  "Error",
                  `Failed to restore backup: ${result.error}`,
                );
              }
            } catch (error) {
              console.error("Restore error:", error);
              Alert.alert("Error", "An error occurred during restoration");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  // Handle delete backup
  const handleDeleteBackup = (backup) => {
    Alert.alert(
      "Delete Backup",
      "Are you sure you want to delete this backup?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const success = await googleDriveService.deleteBackup(backup.id);

              if (success) {
                // Remove deleted backup from list
                setBackups(backups.filter((b) => b.id !== backup.id));
                Alert.alert("Success", "Backup deleted");
              } else {
                Alert.alert("Error", "Failed to delete backup");
              }
            } catch (error) {
              console.error("Delete backup error:", error);
              Alert.alert("Error", "An error occurred during backup deletion");
            }
          },
        },
      ],
    );
  };

  // Handle auto sync toggle
  const handleAutoSyncToggle = async (value) => {
    setAutoSyncEnabled(value);

    try {
      await googleDriveService.setAutoSync(value, syncFrequency);

      if (value) {
        // If auto sync is enabled, check if immediate sync is needed
        googleDriveService.checkAndPerformAutoSync().then((performed) => {
          if (performed) {
            loadLastSyncTime();
          }
        });
      }
    } catch (error) {
      console.error("Failed to set auto sync:", error);
      Alert.alert("Error", "Failed to set auto sync");
    }
  };

  // Handle sync frequency change
  const handleFrequencyChange = async (frequency) => {
    setSyncFrequency(frequency);

    try {
      await googleDriveService.setAutoSync(autoSyncEnabled, frequency);
    } catch (error) {
      console.error("Failed to set sync frequency:", error);
      Alert.alert("Error", "Failed to set sync frequency");
    }
  };

  // Refresh backup list
  const refreshBackups = async () => {
    setRefreshing(true);
    try {
      const backupList = await googleDriveService.getBackups();
      setBackups(backupList);
    } catch (error) {
      console.error("Error refreshing backups:", error);
      Alert.alert("Error", "Failed to refresh backup list");
    } finally {
      setRefreshing(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render backup list modal
  const renderBackupListModal = () => {
    return (
      <Modal
        visible={showBackupListModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBackupListModal(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            isLightTheme && styles.lightModalOverlay,
          ]}
        >
          <View
            style={[
              styles.modalContent,
              isLightTheme && styles.lightModalContent,
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  isLightTheme && styles.lightModalTitle,
                ]}
              >
                Backup History
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowBackupListModal(false)}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={isLightTheme ? "#333" : "#FFF"}
                />
              </TouchableOpacity>
            </View>

            {backups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text
                  style={[
                    styles.emptyText,
                    isLightTheme && styles.lightEmptyText,
                  ]}
                >
                  No backups found
                </Text>
              </View>
            ) : (
              <FlatList
                data={backups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.backupItem,
                      isLightTheme && styles.lightBackupItem,
                    ]}
                  >
                    <View style={styles.backupInfo}>
                      <Text
                        style={[
                          styles.backupDate,
                          isLightTheme && styles.lightBackupDate,
                        ]}
                      >
                        {formatDate(item.createdTime)}
                      </Text>
                      <Text
                        style={[
                          styles.backupSize,
                          isLightTheme && styles.lightBackupSize,
                        ]}
                      >
                        {formatSize(item.size)}
                      </Text>
                    </View>
                    <View style={styles.backupActions}>
                      <TouchableOpacity
                        style={[
                          styles.backupAction,
                          isLightTheme && styles.lightBackupAction,
                        ]}
                        onPress={() => confirmRestore(item)}
                      >
                        <MaterialIcons
                          name="restore"
                          size={20}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.backupAction,
                          styles.deleteAction,
                          isLightTheme && styles.lightDeleteAction,
                        ]}
                        onPress={() => handleDeleteBackup(item)}
                      >
                        <MaterialIcons
                          name="delete"
                          size={20}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                refreshing={refreshing}
                onRefresh={refreshBackups}
              />
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, isLightTheme && styles.lightContainer]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={isLightTheme ? "#333" : "#FFF"}
          />
          <Text style={[styles.loadingText, isLightTheme && styles.lightText]}>
            Connecting to Google Drive...
          </Text>
        </View>
      ) : !isAuthenticated ? (
        <View>
          <Text
            style={[
              styles.sectionTitle,
              isLightTheme && styles.lightSectionTitle,
            ]}
          >
            Cloud Backup
          </Text>

          <Text style={[styles.noteText, isLightTheme && styles.lightNoteText]}>
            Backup and sync your app data
          </Text>

          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleAuthenticate}
          >
            <MaterialIcons
              name="cloud"
              size={24}
              color="#FFFFFF"
              style={styles.connectButtonIcon}
            />
            <Text style={styles.connectButtonText}>
              Connect to Google Drive
            </Text>
          </TouchableOpacity>

          {isExpoGo && (
            <TouchableOpacity
              style={[
                styles.mockButton,
                isLightTheme && styles.lightMockButton,
              ]}
              onPress={useMockGoogleAccount}
            >
              <Text
                style={[
                  styles.mockButtonText,
                  isLightTheme && styles.lightMockButtonText,
                ]}
              >
                Use Mock Account (For Testing)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View>
          <View style={styles.headerContainer}>
            <Text
              style={[
                styles.sectionTitle,
                isLightTheme && styles.lightSectionTitle,
              ]}
            >
              Google Drive Backup
            </Text>

            <TouchableOpacity
              style={[
                styles.disconnectButton,
                isLightTheme && styles.lightDisconnectButton,
              ]}
              onPress={handleSignOut}
            >
              <Text
                style={[
                  styles.disconnectButtonText,
                  isLightTheme && styles.lightDisconnectButtonText,
                ]}
              >
                Disconnect
              </Text>
            </TouchableOpacity>
          </View>

          {/* Last sync time */}
          {lastSyncTime && (
            <View style={styles.infoItem}>
              <Text
                style={[
                  styles.infoLabel,
                  isLightTheme && styles.lightInfoLabel,
                ]}
              >
                Last sync time:
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  isLightTheme && styles.lightInfoValue,
                ]}
              >
                {formatDate(lastSyncTime)}
              </Text>
            </View>
          )}

          {/* Backup and restore buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, isLightTheme && styles.lightButton]}
              onPress={handleCreateBackup}
            >
              <MaterialIcons
                name="backup"
                size={24}
                color="#FFFFFF"
              />
              <Text
                style={[
                  styles.buttonText,
                  isLightTheme && styles.lightButtonText,
                ]}
              >
                Create Backup
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLightTheme && styles.lightButton]}
              onPress={handleRestoreBackup}
            >
              <MaterialIcons
                name="restore"
                size={24}
                color="#FFFFFF"
              />
              <Text
                style={[
                  styles.buttonText,
                  isLightTheme && styles.lightButtonText,
                ]}
              >
                Restore Backup
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto sync settings */}
          <View
            style={[
              styles.settingItem,
              isLightTheme && styles.lightSettingItem,
            ]}
          >
            <View style={styles.settingContent}>
              <Text
                style={[
                  styles.settingLabel,
                  isLightTheme && styles.lightSettingLabel,
                ]}
              >
                Auto Sync
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  isLightTheme && styles.lightSettingDescription,
                ]}
              >
                Automatically backup data to Google Drive periodically
              </Text>
            </View>

            <Switch
              trackColor={{
                false: isLightTheme ? "#DDDDDD" : "#222222",
                true: "#777777",
              }}
              thumbColor={autoSyncEnabled ? "#FFFFFF" : "#888888"}
              ios_backgroundColor={isLightTheme ? "#DDDDDD" : "#222222"}
              onValueChange={handleAutoSyncToggle}
              value={autoSyncEnabled}
            />
          </View>

          {/* Sync frequency selector */}
          {autoSyncEnabled && (
            <View
              style={[
                styles.frequencySelector,
                isLightTheme && styles.lightFrequencySelector,
              ]}
            >
              <Text
                style={[
                  styles.frequencyLabel,
                  isLightTheme && styles.lightFrequencyLabel,
                ]}
              >
                Sync frequency:
              </Text>
              <View style={styles.frequencyOptions}>
                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    isLightTheme && styles.lightFrequencyOption,
                    syncFrequency === "daily" && styles.frequencyOptionSelected,
                    syncFrequency === "daily" &&
                      isLightTheme &&
                      styles.lightFrequencyOptionSelected,
                  ]}
                  onPress={() => handleFrequencyChange("daily")}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      isLightTheme && styles.lightFrequencyText,
                      syncFrequency === "daily" && styles.frequencyTextSelected,
                    ]}
                  >
                    Daily
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    isLightTheme && styles.lightFrequencyOption,
                    syncFrequency === "weekly" &&
                      styles.frequencyOptionSelected,
                    syncFrequency === "weekly" &&
                      isLightTheme &&
                      styles.lightFrequencyOptionSelected,
                  ]}
                  onPress={() => handleFrequencyChange("weekly")}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      isLightTheme && styles.lightFrequencyText,
                      syncFrequency === "weekly" && styles.frequencyTextSelected,
                    ]}
                  >
                    Weekly
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.frequencyOption,
                    isLightTheme && styles.lightFrequencyOption,
                    syncFrequency === "monthly" &&
                      styles.frequencyOptionSelected,
                    syncFrequency === "monthly" &&
                      isLightTheme &&
                      styles.lightFrequencyOptionSelected,
                  ]}
                  onPress={() => handleFrequencyChange("monthly")}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      isLightTheme && styles.lightFrequencyText,
                      syncFrequency === "monthly" && styles.frequencyTextSelected,
                    ]}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {renderBackupListModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 20,
  },
  lightContainer: {
    backgroundColor: "transparent",
  },
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 15,
  },
  lightSectionTitle: {
    color: "#111",
  },
  noteText: {
    color: "#888",
    fontSize: 14,
    marginBottom: 15,
  },
  lightNoteText: {
    color: "#555",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    height: 60,
  },
  lightSettingItem: {
    backgroundColor: "#DDD",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    color: "#CCC",
    fontSize: 16,
  },
  lightSettingLabel: {
    color: "#333",
  },
  settingDescription: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
  },
  lightSettingDescription: {
    color: "#555",
  },
  connectButton: {
    backgroundColor: "#333", // Changed to dark gray from blue
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  connectButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
  disconnectButton: {
    backgroundColor: "#444", // Changed to gray from red
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  lightDisconnectButton: {
    backgroundColor: "#BBBBBB", // Light gray for light theme
  },
  disconnectButtonText: {
    color: "#FFF",
    fontSize: 14,
  },
  lightDisconnectButtonText: {
    color: "#333",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  infoLabel: {
    color: "#888",
    fontSize: 14,
    marginRight: 5,
  },
  lightInfoLabel: {
    color: "#555",
  },
  infoValue: {
    color: "#CCC",
    fontSize: 14,
  },
  lightInfoValue: {
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  lightButton: {
    backgroundColor: "#BBBBBB", // Changed to light gray
  },
  buttonText: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 8,
  },
  lightButtonText: {
    color: "#333",
  },
  frequencySelector: {
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  lightFrequencySelector: {
    backgroundColor: "#DDD",
  },
  frequencyLabel: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 8,
  },
  lightFrequencyLabel: {
    color: "#333",
  },
  frequencyOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  frequencyOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 5,
    marginHorizontal: 3,
  },
  lightFrequencyOption: {
    backgroundColor: "#CCC",
  },
  frequencyOptionSelected: {
    backgroundColor: "#555", // Changed to darker gray from blue
  },
  lightFrequencyOptionSelected: {
    backgroundColor: "#999", // Medium gray for selected in light theme
  },
  frequencyText: {
    color: "#CCC",
    fontSize: 12,
  },
  frequencyTextSelected: {
    color: "#FFFFFF", // White text for selected option
  },
  lightFrequencyText: {
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 20,
  },
  lightModalContent: {
    backgroundColor: "#FFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  lightModalTitle: {
    color: "#111",
  },
  closeButton: {
    padding: 5,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 16,
  },
  lightEmptyText: {
    color: "#555",
  },
  backupItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  lightBackupItem: {
    backgroundColor: "#EEE",
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    color: "#CCC",
    fontSize: 14,
  },
  lightBackupDate: {
    color: "#333",
  },
  backupSize: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  lightBackupSize: {
    color: "#555",
  },
  backupActions: {
    flexDirection: "row",
  },
  backupAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  lightBackupAction: {
    backgroundColor: "#999", // Changed to gray from blue
  },
  deleteAction: {
    backgroundColor: "#555", // Changed to gray from red
  },
  lightDeleteAction: {
    backgroundColor: "#AAAAAA", // Light gray
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#CCC",
    fontSize: 16,
    marginTop: 10,
  },
  lightText: {
    color: "#333",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  connectButtonIcon: {
    marginRight: 10,
  },
  mockButton: {
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  lightMockButton: {
    backgroundColor: "#DDD",
  },
  mockButtonText: {
    color: "#CCC",
    fontSize: 14,
  },
  lightMockButtonText: {
    color: "#333",
  },
});

export default CloudBackupSection;
