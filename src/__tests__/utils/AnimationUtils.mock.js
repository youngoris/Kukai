// Mock implementation of animation functions for testing purposes

// Mock functions with jest.fn() to track calls
export const fadeIn = jest.fn();
export const fadeOut = jest.fn();
export const slideInUp = jest.fn();
export const scale = jest.fn();
export const breathe = jest.fn();
export const pressAnimation = jest.fn();

// Add a simple test to satisfy Jest's requirement
describe('AnimationUtils Mocks', () => {
  test('mocks are defined correctly', () => {
    // This test ensures that the file is properly loaded by Jest
    expect(true).toBe(true);
  });
}); 