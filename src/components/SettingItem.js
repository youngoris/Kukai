import React from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

/**
 * SettingItem component for displaying various types of settings
 *
 * @param {Object} props - Component props
 * @param {string} props.label - Setting label
 * @param {string} [props.description] - Optional description
 * @param {boolean} [props.isSwitch] - Whether this is a switch setting
 * @param {boolean} [props.value] - Value for switch settings
 * @param {Function} [props.onValueChange] - Callback for switch toggle
 * @param {boolean} [props.isDropdown] - Whether this is a dropdown setting
 * @param {string} [props.selectedValue] - Selected value for dropdown
 * @param {Function} [props.onPress] - Callback for pressing the setting
 * @param {string} [props.theme='dark'] - UI theme ('dark' or 'light')
 */
const SettingItem = ({
  label,
  description,
  isSwitch = false,
  value = false,
  onValueChange,
  isDropdown = false,
  selectedValue,
  onPress,
  theme = "dark",
}) => {
  const isDarkTheme = theme === "dark";

  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={isSwitch}
    >
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingLabel, !isDarkTheme && styles.lightText]}>
          {label}
        </Text>
        {description && (
          <Text
            style={[
              styles.settingDescription,
              !isDarkTheme && styles.lightDescriptionText,
            ]}
          >
            {description}
          </Text>
        )}
      </View>

      {isSwitch && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#444", true: "#4CAF50" }}
          thumbColor={value ? "#fff" : "#f4f3f4"}
          ios_backgroundColor="#444"
        />
      )}

      {isDropdown && (
        <View style={styles.dropdownContainer}>
          <Text
            style={[
              styles.selectedValue,
              !isDarkTheme && styles.lightSelectedValue,
            ]}
          >
            {selectedValue}
          </Text>
          <MaterialIcons
            name="arrow-forward-ios"
            size={16}
            color={isDarkTheme ? "#999" : "#666"}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  settingLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 4,
  },
  settingDescription: {
    color: "#999999",
    fontSize: 14,
  },
  dropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedValue: {
    color: "#CCCCCC",
    fontSize: 16,
    marginRight: 8,
  },
  lightText: {
    color: "#000000",
  },
  lightDescriptionText: {
    color: "#666666",
  },
  lightSelectedValue: {
    color: "#666666",
  },
});

export default SettingItem;
