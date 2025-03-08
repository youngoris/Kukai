import React, { useState } from "react";
import {
  View,
  Platform,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

/**
 * Platform-compatible date time picker component
 * On iOS, it directly uses the native DateTimePicker
 * On Android, it uses a Modal-wrapped picker to avoid TurboModule issues
 */
const CustomDateTimePicker = ({
  value,
  mode = "date",
  display,
  onChange,
  minimumDate,
  maximumDate,
  ...props
}) => {
  // Ensure value is a valid Date object
  const ensureDate = (dateValue) => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    return new Date(dateValue);
  };

  const [isPickerVisible, setPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(ensureDate(value));

  // iOS directly uses native DateTimePicker
  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        value={ensureDate(value)}
        mode={mode}
        display={display}
        onChange={onChange}
        minimumDate={minimumDate ? ensureDate(minimumDate) : undefined}
        maximumDate={maximumDate ? ensureDate(maximumDate) : undefined}
        {...props}
      />
    );
  }

  // Android uses Modal-wrapped picker
  const handleAndroidChange = (event, selectedDate) => {
    setPickerVisible(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      onChange(event, selectedDate);
    }
  };

  const showPicker = () => {
    setPickerVisible(true);
  };

  // Format date display for Android button
  const formatDate = (date) => {
    if (!date) return "";

    // Ensure date is a Date object
    const safeDate = ensureDate(date);

    if (mode === "date") {
      return safeDate.toLocaleDateString();
    } else if (mode === "time") {
      return safeDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return safeDate.toLocaleString();
  };

  return (
    <View>
      <TouchableOpacity onPress={showPicker} style={styles.androidButton}>
        <Text style={styles.androidButtonText}>{formatDate(value)}</Text>
      </TouchableOpacity>

      {isPickerVisible && (
        <DateTimePicker
          value={tempDate}
          mode={mode}
          is24Hour={true}
          display={display || "default"}
          onChange={handleAndroidChange}
          minimumDate={minimumDate ? ensureDate(minimumDate) : undefined}
          maximumDate={maximumDate ? ensureDate(maximumDate) : undefined}
          {...props}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  androidButton: {
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#cccccc",
  },
  androidButtonText: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default CustomDateTimePicker;
