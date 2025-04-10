import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// Spacing constants
export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

// Font size constants
export const FONT_SIZE = {
  xs: 12,
  s: 14,
  m: 16,
  l: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// Font family constants
export const FONT_FAMILY = {
  light: "Roboto_300Light",
  regular: "Roboto_400Regular",
  medium: "Roboto_500Medium",
  bold: "Roboto_700Bold",
};

// Color constants
export const COLORS = {
  background: "#000",
  card: "#111",
  cardAlt: "#0a0a0a",
  text: {
    primary: "#fff",
    secondary: "#aaa",
    tertiary: "#666",
  },
  accent: "#26de81",
  danger: "#ff6b6b",
  warning: "#feca57",
};

// Layout constants
export const LAYOUT = {
  screenWidth: width,
  screenHeight: height,
  borderRadius: {
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    circle: 999,
  },
};

// Shadow constants
export const SHADOWS = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

// Animation duration
export const ANIMATION = {
  duration: {
    fast: 300,
    normal: 500,
    slow: 800,
  },
  easing: {
    // Can add different easing functions
  },
};
