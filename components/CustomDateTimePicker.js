import React, { useState } from 'react';
import { View, Platform, Button, Modal, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

/**
 * 平台兼容的日期时间选择器组件
 * 在iOS上直接使用原生DateTimePicker
 * 在Android上使用Modal包装的选择器，避免TurboModule问题
 */
const CustomDateTimePicker = ({ 
  value, 
  mode = 'date', 
  display,
  onChange,
  minimumDate,
  maximumDate,
  ...props 
}) => {
  // 确保value是一个有效的Date对象
  const ensureDate = (dateValue) => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    // 如果是字符串或数字，尝试转换为Date
    return new Date(dateValue);
  };

  const [isPickerVisible, setPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(ensureDate(value));
  
  // iOS直接使用原生DateTimePicker
  if (Platform.OS === 'ios') {
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

  // Android使用Modal包装的选择器
  const handleAndroidChange = (event, selectedDate) => {
    setPickerVisible(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      // 使用相同的事件格式调用原始onChange
      onChange(event, selectedDate);
    }
  };

  const showPicker = () => {
    setPickerVisible(true);
  };

  // Android的按钮格式化日期显示
  const formatDate = (date) => {
    if (!date) return '';
    
    // 确保date是Date对象
    const safeDate = ensureDate(date);
    
    if (mode === 'date') {
      return safeDate.toLocaleDateString();
    } else if (mode === 'time') {
      return safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          display={display || 'default'}
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
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  androidButtonText: {
    fontSize: 16,
    textAlign: 'center',
  }
});

export default CustomDateTimePicker; 