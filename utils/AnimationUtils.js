import { Animated, Easing } from 'react-native';
import { ANIMATION } from '../constants/DesignSystem';

// 淡入动画
export const fadeIn = (animValue, duration = ANIMATION.duration.normal, callback) => {
  Animated.timing(animValue, {
    toValue: 1,
    duration: duration,
    useNativeDriver: true,
    easing: Easing.out(Easing.cubic)
  }).start(callback);
};

// 淡出动画
export const fadeOut = (animValue, duration = ANIMATION.duration.normal, callback) => {
  Animated.timing(animValue, {
    toValue: 0,
    duration: duration,
    useNativeDriver: true,
    easing: Easing.in(Easing.cubic)
  }).start(callback);
};

// 滑入动画（从下方）
export const slideInUp = (animValue, from = 50, duration = ANIMATION.duration.normal, callback) => {
  Animated.timing(animValue, {
    toValue: 0,
    duration: duration,
    useNativeDriver: true,
    easing: Easing.out(Easing.cubic)
  }).start(callback);
};

// 缩放动画
export const scale = (animValue, toValue, duration = ANIMATION.duration.normal, callback) => {
  Animated.timing(animValue, {
    toValue: toValue,
    duration: duration,
    useNativeDriver: true,
    easing: Easing.inOut(Easing.cubic)
  }).start(callback);
};

// 呼吸动画
export const breathe = (animValue, min = 0.97, max = 1.03, duration = 4000) => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: max,
        duration: duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true
      }),
      Animated.timing(animValue, {
        toValue: min,
        duration: duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true
      })
    ])
  ).start();
};

// 按钮按压效果
export const pressAnimation = (animValue, callback) => {
  Animated.sequence([
    Animated.timing(animValue, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic)
    }),
    Animated.timing(animValue, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic)
    })
  ]).start(callback);
}; 