/**
 * HeaderStyles.js
 * 
 * This file contains standardized styles for headers across the application.
 * Use these constants to ensure consistent header styling throughout the app.
 */

// Header height constants
export const HEADER_HEIGHT = {
  STANDARD: 60,
  WITH_STATUS_BAR: 90,
};

// Header colors
export const HEADER_COLORS = {
  DARK: {
    BACKGROUND: '#000000',
    TEXT: '#FFFFFF',
    ICON: '#FFFFFF',
    BUTTON_TEXT: '#FFFFFF',
  },
  LIGHT: {
    BACKGROUND: '#FFFFFF',
    TEXT: '#000000',
    ICON: '#000000',
    BUTTON_TEXT: '#000000',
  },
};

// Header text styles
export const HEADER_TEXT = {
  TITLE: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
  },
  BUTTON: {
    fontSize: 16,
    fontWeight: '500',
  },
};

// Header button dimensions
export const HEADER_BUTTON = {
  SIZE: 44,
  HITSLOP: { top: 15, bottom: 15, left: 15, right: 15 },
};

// Header padding
export const HEADER_PADDING = {
  HORIZONTAL: 16,
};

// Usage guide:
/*
  To use these styles in your HeaderBar component:

  import { HEADER_HEIGHT, HEADER_COLORS, HEADER_TEXT, HEADER_BUTTON } from '../constants/HeaderStyles';

  // In your styles:
  headerContainer: {
    height: HEADER_HEIGHT.STANDARD,
    backgroundColor: isLightTheme ? HEADER_COLORS.LIGHT.BACKGROUND : HEADER_COLORS.DARK.BACKGROUND,
    paddingHorizontal: HEADER_PADDING.HORIZONTAL,
  },
  title: {
    ...HEADER_TEXT.TITLE,
    color: isLightTheme ? HEADER_COLORS.LIGHT.TEXT : HEADER_COLORS.DARK.TEXT,
  },
  button: {
    width: HEADER_BUTTON.SIZE,
    height: HEADER_BUTTON.SIZE,
  }
*/ 