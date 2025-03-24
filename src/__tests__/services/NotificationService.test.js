// Import mocks first
/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */

import './NotificationService.mock';

// Import dependencies
import * as Notifications from 'expo-notifications';
import storageService from "../../services/storage/StorageService";
import notificationService from '../../services/NotificationService';

// Mock Date.now() to return a consistent timestamp for testing
const mockNow = 1600000000000; // Fixed timestamp
global.Date.now = jest.fn(() => mockNow);

describe('NotificationService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the config to default values
    notificationService.config = {
      taskNotifications: true,
      notificationSound: 'default',
      quietHoursEnabled: false,
      quietHoursStart: new Date().setHours(22, 0, 0, 0),
      quietHoursEnd: new Date().setHours(7, 0, 0, 0),
    };
    
    // Reset responseListener
    notificationService.responseListener = null;
  });

  // Test initial configuration
  test('should have default config', () => {
    // Verify the default configuration is set
    expect(notificationService.config).toEqual(expect.objectContaining({
      taskNotifications: true,
      notificationSound: 'default',
      quietHoursEnabled: false,
    }));
  });

  // Test updateConfig method
  test('updateConfig should merge new config with existing config', async () => {
    // Setup
    const newConfig = {
      taskNotifications: false,
      notificationSound: 'custom',
    };

    // Execute
    await notificationService.updateConfig(newConfig);

    // Verify
    expect(notificationService.config).toEqual(expect.objectContaining({
      taskNotifications: false,
      notificationSound: 'custom',
      quietHoursEnabled: false, // This should remain unchanged
    }));

    // Verify storageService was called to save the config
    expect(storageService.setItem).toHaveBeenCalledWith(
      'notificationConfig',
      expect.any(String)
    );
  });

  // Test loadConfig method
  test('loadConfig should load config from storage', async () => {
    // Setup
    const storedConfig = {
      taskNotifications: false,
      notificationSound: 'custom',
      quietHoursEnabled: true,
    };
    storageService.getItem.mockResolvedValue(JSON.stringify(storedConfig));

    // Execute
    await notificationService.loadConfig();

    // Verify
    expect(notificationService.config).toEqual(expect.objectContaining(storedConfig));
    expect(storageService.getItem).toHaveBeenCalledWith('notificationConfig');
  });

  // Test checkPermissions method
  test('checkPermissions should check notification permissions', async () => {
    // Setup
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    // Execute
    const result = await notificationService.checkPermissions();

    // Verify
    expect(result).toBe(true);
    expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
  });

  // Test sendImmediateNotification method
  test('sendImmediateNotification should schedule an immediate notification', async () => {
    // Setup
    const title = 'Test Title';
    const body = 'Test Body';
    const data = { key: 'value' };

    // Execute
    await notificationService.sendImmediateNotification(title, body, data);

    // Verify
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title,
          body,
          data,
        }),
        trigger: null, // Immediate notification has null trigger
      })
    );
  });

  // Test isInQuietHours method
  test('isInQuietHours should return false when quiet hours are disabled', () => {
    // Setup
    notificationService.config.quietHoursEnabled = false;

    // Execute
    const result = notificationService.isInQuietHours();

    // Verify
    expect(result).toBe(false);
  });

  // Test cleanup method
  test('cleanup should call removeNotificationSubscription when responseListener exists', () => {
    // Setup - create a mock listener
    const mockListener = jest.fn();
    notificationService.responseListener = mockListener;

    // Execute
    notificationService.cleanup();

    // Verify
    expect(Notifications.removeNotificationSubscription).toHaveBeenCalledWith(mockListener);
  });

  // Test initialize method
  test('initialize should set up notification listeners', async () => {
    // Setup
    const mockListener = jest.fn();
    Notifications.addNotificationResponseReceivedListener.mockReturnValue(mockListener);
    
    // Execute
    await notificationService.initialize();

    // Verify
    expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
    expect(notificationService.responseListener).toBe(mockListener);
  });
}); 