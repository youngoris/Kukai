import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../context/ThemeContext';
import { NavigationContainer } from '@react-navigation/native';

export const renderWithProviders = (ui, { theme = 'light', ...options } = {}) => {
  const Wrapper = ({ children }) => (
    <NavigationContainer>
      <ThemeProvider initialTheme={theme}>
        {children}
      </ThemeProvider>
    </NavigationContainer>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();

export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: jest.fn(),
};

export const mockRoute = {
  params: {},
};

export const waitForAnimation = () => new Promise(resolve => setTimeout(resolve, 0));

export const createTestProps = (props) => ({
  navigation: mockNavigation,
  route: mockRoute,
  ...props,
}); 