// Mock the Animated module
const mockStartFn = jest.fn(callback => {
  if (callback) callback({ finished: true });
});

const mockTimingFn = jest.fn(() => ({
  start: mockStartFn
}));

const mockSequenceFn = jest.fn(() => ({
  start: mockStartFn
}));

const mockLoopFn = jest.fn(() => ({
  start: mockStartFn
}));

jest.mock('react-native', () => {
  return {
    Animated: {
      Value: jest.fn(() => ({
        setValue: jest.fn(),
      })),
      timing: mockTimingFn,
      sequence: mockSequenceFn,
      loop: mockLoopFn,
    },
    Easing: {
      in: jest.fn(() => jest.fn()),
      out: jest.fn(() => jest.fn()),
      inOut: jest.fn(() => jest.fn()),
      sin: jest.fn(),
      cubic: jest.fn(),
    },
    Dimensions: {
      get: jest.fn(() => ({
        width: 375,
        height: 812,
      })),
    },
  };
});

// Mock the module - this must be done before importing
jest.mock('../../utils/AnimationUtils', () => require('./AnimationUtils.mock'));

// Import the mocked module
import * as AnimationUtils from '../../utils/AnimationUtils';

describe('AnimationUtils', () => {
  let mockAnimValue;
  let mockCallback;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create a mock animated value (just a simple object for testing)
    mockAnimValue = {};
    mockCallback = jest.fn();
  });

  // Test for fadeIn animation function
  test('fadeIn can be called with correct parameters', () => {
    AnimationUtils.fadeIn(mockAnimValue, 300, mockCallback);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.fadeIn).toHaveBeenCalledWith(mockAnimValue, 300, mockCallback);
  });

  // Test for fadeOut animation function
  test('fadeOut can be called with correct parameters', () => {
    AnimationUtils.fadeOut(mockAnimValue, 300, mockCallback);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.fadeOut).toHaveBeenCalledWith(mockAnimValue, 300, mockCallback);
  });

  // Test for slideInUp animation function
  test('slideInUp can be called with correct parameters', () => {
    AnimationUtils.slideInUp(mockAnimValue, 100, 300, mockCallback);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.slideInUp).toHaveBeenCalledWith(mockAnimValue, 100, 300, mockCallback);
  });

  // Test for scale animation function
  test('scale can be called with correct parameters', () => {
    AnimationUtils.scale(mockAnimValue, 1.5, 300, mockCallback);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.scale).toHaveBeenCalledWith(mockAnimValue, 1.5, 300, mockCallback);
  });

  // Test for breathe animation function
  test('breathe can be called with correct parameters', () => {
    AnimationUtils.breathe(mockAnimValue, 0.9, 1.1, 2000);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.breathe).toHaveBeenCalledWith(mockAnimValue, 0.9, 1.1, 2000);
  });

  // Test for pressAnimation function
  test('pressAnimation can be called with correct parameters', () => {
    AnimationUtils.pressAnimation(mockAnimValue, mockCallback);
    
    // Check if the function was called with the correct parameters
    expect(AnimationUtils.pressAnimation).toHaveBeenCalledWith(mockAnimValue, mockCallback);
  });
}); 