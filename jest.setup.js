import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => ({
  default: {
    call: () => {},
    createAnimatedComponent: (component) => component,
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    ScrollView: 'ScrollView',
    useAnimatedStyle: () => ({}),
    useSharedValue: (initialValue) => ({ value: initialValue }),
    useDerivedValue: (fn) => ({ value: fn() }),
    withTiming: (toValue) => toValue,
    withSpring: (toValue) => toValue,
    withDelay: (delay, animation) => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    interpolate: () => 0,
    Extrapolate: { CLAMP: 'clamp' },
  },
  FadeIn: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
  SlideInRight: { duration: () => ({}) },
  SlideOutLeft: { duration: () => ({}) },
}));

// Mock Animated from react-native
jest.mock('react-native', () => {
  const reactNative = jest.requireActual('react-native');
  reactNative.NativeModules.StatusBarManager = { getHeight: jest.fn() };
  reactNative.Animated = {
    Value: jest.fn(() => ({
      interpolate: jest.fn(),
      setValue: jest.fn(),
    })),
    View: 'Animated.View',
    Text: 'Animated.Text',
    Image: 'Animated.Image',
    createAnimatedComponent: jest.fn(comp => comp),
    timing: jest.fn(() => ({ start: jest.fn() })),
    loop: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
  };
  return reactNative;
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Set up global variables for testing
global.window = {};
global.window = global;
global.__reanimatedWorkletInit = jest.fn(); 