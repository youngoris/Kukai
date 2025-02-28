import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// 间距常量
export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48
};

// 字体大小常量
export const FONT_SIZE = {
  xs: 12,
  s: 14,
  m: 16,
  l: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40
};

// 字体样式常量
export const FONT_FAMILY = {
  light: 'Roboto_300Light',
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold'
};

// 颜色常量
export const COLORS = {
  background: '#000',
  card: '#111',
  cardAlt: '#0a0a0a',
  text: {
    primary: '#fff',
    secondary: '#aaa',
    tertiary: '#666'
  },
  accent: '#26de81',
  danger: '#ff6b6b',
  warning: '#feca57'
};

// 布局常量
export const LAYOUT = {
  screenWidth: width,
  screenHeight: height,
  borderRadius: {
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    circle: 999
  }
};

// 阴影常量
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8
  }
};

// 动画持续时间
export const ANIMATION = {
  duration: {
    fast: 300,
    normal: 500,
    slow: 800
  },
  easing: {
    // 可以添加不同的缓动函数
  }
}; 