import defaultSettings, { getSettingsWithDefaults } from '../../utils/defaultSettings';

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};

// Mock console methods
console.error = jest.fn();
console.log = jest.fn();

describe('defaultSettings', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test that defaultSettings object has expected properties
  test('defaultSettings should contain all expected properties', () => {
    // Test for meditation settings
    expect(defaultSettings).toHaveProperty('meditationDuration');
    expect(defaultSettings).toHaveProperty('selectedSoundTheme');
    expect(defaultSettings).toHaveProperty('meditationReminder');
    expect(defaultSettings).toHaveProperty('meditationReminderTime');
    expect(defaultSettings).toHaveProperty('keepScreenAwake');

    // Test for focus settings
    expect(defaultSettings).toHaveProperty('focusDuration');
    expect(defaultSettings).toHaveProperty('breakDuration');
    expect(defaultSettings).toHaveProperty('longBreakDuration');
    expect(defaultSettings).toHaveProperty('longBreakInterval');
    expect(defaultSettings).toHaveProperty('focusNotifications');
    expect(defaultSettings).toHaveProperty('autoStartNextFocus');
    expect(defaultSettings).toHaveProperty('differentWeekendSettings');

    // Test for journal settings
    expect(defaultSettings).toHaveProperty('includeWeather');
    expect(defaultSettings).toHaveProperty('includeLocation');
    expect(defaultSettings).toHaveProperty('markdownSupport');
    expect(defaultSettings).toHaveProperty('journalReminder');
    expect(defaultSettings).toHaveProperty('journalReminderTime');
    expect(defaultSettings).toHaveProperty('selectedJournalTemplate');

    // Test for general settings
    expect(defaultSettings).toHaveProperty('darkMode');
    expect(defaultSettings).toHaveProperty('appTheme');
    expect(defaultSettings).toHaveProperty('fontSizeScale');
    expect(defaultSettings).toHaveProperty('notificationsEnabled');
    expect(defaultSettings).toHaveProperty('syncEnabled');

    // Test for notification settings
    expect(defaultSettings).toHaveProperty('taskNotifications');
    expect(defaultSettings).toHaveProperty('notificationSound');
    expect(defaultSettings).toHaveProperty('quietHoursEnabled');
    expect(defaultSettings).toHaveProperty('quietHoursStart');
    expect(defaultSettings).toHaveProperty('quietHoursEnd');
  });

  // Test default values for key properties
  test('defaultSettings should have expected default values', () => {
    expect(defaultSettings.meditationDuration).toBe(10);
    expect(defaultSettings.focusDuration).toBe(25);
    expect(defaultSettings.breakDuration).toBe(5);
    expect(defaultSettings.darkMode).toBe(true);
    expect(defaultSettings.appTheme).toBe('dark');
    expect(defaultSettings.selectedSoundTheme).toBe('rain');
  });

  describe('getSettingsWithDefaults', () => {
    // Test when stored settings exist
    test('should return stored settings when they exist', async () => {
      // Mock settings to return from AsyncStorage
      const mockStoredSettings = { 
        darkMode: false, 
        focusDuration: 30,
        appTheme: 'light' 
      };
      
      // Setup the mock to return our test data
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockStoredSettings));
      
      // Call the function with our mock
      const result = await getSettingsWithDefaults(mockAsyncStorage);
      
      // Verify that getItem was called with the correct key
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('userSettings');
      
      // Verify that the result matches our mock data
      expect(result).toEqual(mockStoredSettings);
      
      // Verify that setItem was not called (since settings already exist)
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    // Test when no stored settings exist
    test('should return and save default settings when no stored settings exist', async () => {
      // Setup the mock to return null (no settings found)
      mockAsyncStorage.getItem.mockResolvedValue(null);
      
      // Call the function with our mock
      const result = await getSettingsWithDefaults(mockAsyncStorage);
      
      // Verify that getItem was called with the correct key
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('userSettings');
      
      // Verify that the result matches the default settings
      expect(result).toEqual(defaultSettings);
      
      // Verify that setItem was called to save the default settings
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'userSettings',
        JSON.stringify(defaultSettings)
      );
      
      // Verify that the log message was output
      expect(console.log).toHaveBeenCalledWith('No settings found, using defaults');
    });

    // Test error handling
    test('should return default settings when an error occurs', async () => {
      // Setup the mock to throw an error
      const mockError = new Error('Test error');
      mockAsyncStorage.getItem.mockRejectedValue(mockError);
      
      // Call the function with our mock
      const result = await getSettingsWithDefaults(mockAsyncStorage);
      
      // Verify that getItem was called with the correct key
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('userSettings');
      
      // Verify that the result matches the default settings
      expect(result).toEqual(defaultSettings);
      
      // Verify that setItem was not called (we don't save on error)
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
      
      // Verify that the error was logged
      expect(console.error).toHaveBeenCalledWith('Error getting settings:', mockError);
    });
  });
}); 