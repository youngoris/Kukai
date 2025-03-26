import React from 'react';
import { render, act } from '@testing-library/react-native';
import SummaryScreen from '../../../app/screens/SummaryScreen';
import storageService from '../../services/storage/StorageService';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
};

// Mock required modules
jest.mock('../../services/storage/StorageService', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

// Mock hooks and other dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock SVG with a simple string
jest.mock('../../../assets/frog.svg', () => 'test-file-stub');

// Create mock components
jest.mock('../../../app/components/CustomDateTimePicker', () => 'CustomDateTimePicker', { virtual: true });
jest.mock('../../../app/components/CustomHeader', () => 'CustomHeader', { virtual: true });

describe('SummaryScreen', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('loads data correctly with string data (AsyncStorage format)', async () => {
    // Setup mock data
    const mockTasks = [
      { id: '1', text: 'Task 1', completed: true, completedAt: new Date().toISOString() },
      { id: '2', text: 'Task 2', completed: false },
    ];
    
    const mockMeditationSessions = [
      { id: '1', duration: 15, date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockFocusSessions = [
      { id: '1', duration: 1500, date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockPomodoros = [
      { id: '1', date: new Date().toISOString().split('T')[0] },
      { id: '2', date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockTomorrowTasks = [
      { id: '1', text: 'Future Task 1', completed: false },
    ];
    
    // Setup mocks to return JSON strings (AsyncStorage format)
    storageService.getItem.mockImplementation((key) => {
      switch (key) {
        case 'tasks':
          return Promise.resolve(JSON.stringify(mockTasks));
        case 'meditationSessions':
          return Promise.resolve(JSON.stringify(mockMeditationSessions));
        case 'focusSessions':
          return Promise.resolve(JSON.stringify(mockFocusSessions));
        case 'pomodoros':
          return Promise.resolve(JSON.stringify(mockPomodoros));
        case 'tomorrowTasks':
          return Promise.resolve(JSON.stringify(mockTomorrowTasks));
        case 'lastDate':
          return Promise.resolve(JSON.stringify(new Date().toISOString().split('T')[0]));
        case 'userSettings':
          return Promise.resolve(JSON.stringify({ appTheme: 'dark' }));
        default:
          return Promise.resolve(null);
      }
    });
    
    // Render component
    let component;
    await act(async () => {
      component = render(<SummaryScreen navigation={mockNavigation} />);
    });
    
    // Verify storageService.getItem was called for each data type
    expect(storageService.getItem).toHaveBeenCalledWith('tasks');
    expect(storageService.getItem).toHaveBeenCalledWith('meditationSessions');
    expect(storageService.getItem).toHaveBeenCalledWith('focusSessions');
    expect(storageService.getItem).toHaveBeenCalledWith('pomodoros');
    expect(storageService.getItem).toHaveBeenCalledWith('tomorrowTasks');
  });
  
  test('loads data correctly with object data (SQLite format)', async () => {
    // Setup mock data in object format (as SQLite would return)
    const mockTasks = [
      { id: '1', text: 'Task 1', completed: true, completedAt: new Date().toISOString() },
      { id: '2', text: 'Task 2', completed: false },
    ];
    
    const mockMeditationSessions = [
      { id: '1', duration: 15, date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockFocusSessions = [
      { id: '1', duration: 1500, date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockPomodoros = [
      { id: '1', date: new Date().toISOString().split('T')[0] },
      { id: '2', date: new Date().toISOString().split('T')[0] },
    ];
    
    const mockTomorrowTasks = [
      { id: '1', text: 'Future Task 1', completed: false },
    ];
    
    // Setup mocks to return objects directly (SQLite format)
    storageService.getItem.mockImplementation((key) => {
      switch (key) {
        case 'tasks':
          return Promise.resolve(mockTasks);
        case 'meditationSessions':
          return Promise.resolve(mockMeditationSessions);
        case 'focusSessions':
          return Promise.resolve(mockFocusSessions);
        case 'pomodoros':
          return Promise.resolve(mockPomodoros);
        case 'tomorrowTasks':
          return Promise.resolve(mockTomorrowTasks);
        case 'lastDate':
          return Promise.resolve(new Date().toISOString().split('T')[0]);
        case 'userSettings':
          return Promise.resolve({ appTheme: 'dark' });
        default:
          return Promise.resolve(null);
      }
    });
    
    // Render component
    let component;
    await act(async () => {
      component = render(<SummaryScreen navigation={mockNavigation} />);
    });
    
    // Verify storageService.getItem was called for each data type
    expect(storageService.getItem).toHaveBeenCalledWith('tasks');
    expect(storageService.getItem).toHaveBeenCalledWith('meditationSessions');
    expect(storageService.getItem).toHaveBeenCalledWith('focusSessions');
    expect(storageService.getItem).toHaveBeenCalledWith('pomodoros');
    expect(storageService.getItem).toHaveBeenCalledWith('tomorrowTasks');
  });
  
  test('handles errors gracefully during data loading', async () => {
    // Mock console.error
    console.error = jest.fn();
    
    // Setup storageService.getItem to throw error
    storageService.getItem.mockRejectedValue(new Error('Test error'));
    
    // Mock Alert.alert
    global.Alert = {
      alert: jest.fn(),
    };
    
    // Render component
    let component;
    await act(async () => {
      component = render(<SummaryScreen navigation={mockNavigation} />);
    });
    
    // Verify error was handled
    expect(console.error).toHaveBeenCalled();
    expect(global.Alert.alert).toHaveBeenCalled();
  });
}); 