import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Animated, 
  Easing,
  Dimensions,
  SafeAreaView,
  LogBox,
  Vibration,
  Platform,
  StatusBar
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useMeditation } from './contexts/MeditationContext';

// 忽略特定警告
LogBox.ignoreLogs(['Animated: `useNativeDriver`']);

const { width, height } = Dimensions.get('window');
const TIMER_SIZE = width * 0.8;

const MeditationScreen = ({ navigation }) => {
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [countdownValue, setCountdownValue] = useState(5);
  const [isMeditating, setIsMeditating] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fluidProgressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [sound, setSound] = useState();
  
  // 冥想开始时间引用
  const meditationStartTime = useRef(0);
  // 动画帧请求ID
  const animationFrameId = useRef(null);
  
  const { activeMeditation, startMeditation, endMeditation } = useMeditation();
  
  // 清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);
  
  // 预加载音效
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3' }, 
          { volume: 0.7 }
        );
        setSound(sound);
      } catch (error) {
        console.log('无法预加载音效', error);
      }
    };
    
    loadSound();
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);
  
  // 呼吸动画效果
  useEffect(() => {
    if (isMeditating && !isComplete) {
      // 创建循环呼吸动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.05,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      ).start();
      
      // 创建脉冲动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false
          })
        ])
      ).start();
    }
    
    return () => {
      // 清理动画
      breatheAnim.setValue(1);
      pulseAnim.setValue(0);
    };
  }, [isMeditating, isComplete]);
  
  // 平滑进度动画
  useEffect(() => {
    if (isMeditating && !isComplete) {
      // 计算正确的进度值（从0到1）
      const targetProgress = (totalTime - remainingTime) / totalTime;
      
      // 平滑过渡到新的进度值 - 使用更长的持续时间确保更平滑
      Animated.timing(progressAnim, {
        toValue: targetProgress,
        duration: 950, // 接近1秒但留有余量
        easing: Easing.linear,
        useNativeDriver: false
      }).start();
      
      // 计算液体高度 - 使用平方根函数提供更自然的视觉效果
      const fluidHeight = Math.sqrt(targetProgress);
      
      // 平滑过渡液体高度
      Animated.timing(fluidProgressAnim, {
        toValue: fluidHeight,
        duration: 950,
        easing: Easing.cubic, // 使用三次方缓动函数，更自然
        useNativeDriver: false
      }).start();
    }
  }, [remainingTime, isMeditating, isComplete, totalTime]);
  
  // 检查是否有正在进行的冥想
  useEffect(() => {
    if (activeMeditation && !isMeditating && !isComplete) {
      // 恢复正在进行的冥想
      setSelectedDuration(Math.floor(activeMeditation.duration / 60));
      setRemainingTime(activeMeditation.remainingTime);
      setTotalTime(activeMeditation.duration);
      setIsMeditating(true);
      
      // 设置进度动画初始值
      const progress = (activeMeditation.duration - activeMeditation.remainingTime) / activeMeditation.duration;
      progressAnim.setValue(progress);
      fluidProgressAnim.setValue(Math.sqrt(progress));
    }
  }, [activeMeditation]);
  
  // 选择冥想时长
  const selectDuration = (minutes) => {
    const seconds = minutes * 60;
    setSelectedDuration(minutes);
    setRemainingTime(seconds);
    setTotalTime(seconds);
    progressAnim.setValue(0);
    fluidProgressAnim.setValue(0);
    startCountdown();
  };

  // 测试模式 - 10秒冥想
  const startTestMode = () => {
    setSelectedDuration(0.17); // 10秒
    setRemainingTime(10);
    setTotalTime(10);
    progressAnim.setValue(0);
    fluidProgressAnim.setValue(0);
    startCountdown();
  };
  
  // 开始5秒倒计时
  const startCountdown = () => {
    setCountdownValue(5);
    
    // 淡入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
    // 倒计时
    const interval = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startMeditationSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // 开始冥想
  const startMeditationSession = () => {
    // 重置开始时间
    meditationStartTime.current = Date.now();
    
    // 先设置冥想状态，确保UI能正确更新
    setIsMeditating(true);
    
    // 记录到全局状态
    startMeditation(remainingTime);
    
    // 淡出倒计时然后淡入冥想界面
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    // 正常计时器用于更新显示时间和控制何时完成
    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          completeMeditation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // 完成冥想
  const completeMeditation = () => {
    // 取消动画帧
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    // 结束全局冥想状态
    endMeditation();
    
    playCompletionSound();
    setIsComplete(true);
  };
  
  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // 返回主页
  const goBack = () => {
    // 取消动画帧
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    // 不结束冥想，让它在后台继续
    navigation.navigate('Home');
  };
  
  // 计算剩余分钟的显示方式
  const minutesText = Math.floor(remainingTime / 60);
  const minutesLabel = minutesText === 1 ? "minute" : "minutes";
  
  // 播放完成提示音或振动
  async function playCompletionSound() {
    try {
      // 先振动提供即时反馈
      Vibration.vibrate(300);
      
      // 然后播放声音
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } else {
        // 如果没有预加载，尝试加载并播放
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3' }, 
          { volume: 0.7 }
        );
        setSound(newSound);
        await newSound.playAsync();
      }
    } catch (error) {
      console.log('无法播放提示音，仅使用振动', error);
    }
  }
  
  // 替换当前的免打扰模式实现
  useEffect(() => {
    let mounted = true;
    
    const handleNotifications = async () => {
      try {
        // 冥想开始时，请求通知权限并暂时禁用通知
        const { status } = await Notifications.requestPermissionsAsync();
        
        if (status === 'granted' && mounted) {
          // 暂时禁用通知
          await Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
        }
      } catch (error) {
        console.error('无法管理通知设置:', error);
      }
    };
    
    handleNotifications();
    
    // 清理函数 - 冥想结束时恢复通知
    return () => {
      mounted = false;
      
      const restoreNotifications = async () => {
        try {
          // 恢复默认通知行为
          await Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
        } catch (error) {
          console.error('无法恢复通知设置:', error);
        }
      };
      
      restoreNotifications();
    };
  }, []);
  
  // 在冥想开始时
  useEffect(() => {
    // 启用勿扰模式
    const enableFocusMode = async () => {
      try {
        // 使用 StatusBar 来隐藏状态栏
        StatusBar.setHidden(true);
      } catch (error) {
        console.error('无法隐藏状态栏:', error);
      }
    };
    
    enableFocusMode();
    
    // 冥想结束时
    return () => {
      // 恢复状态栏
      try {
        StatusBar.setHidden(false);
      } catch (error) {
        console.error('无法恢复状态栏:', error);
      }
    };
  }, []);
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 返回按钮 */}
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <AntDesign name="arrowleft" size={24} color="#fff" />
      </TouchableOpacity>
      
      {!selectedDuration && (
        <View style={styles.selectionContainer}>
          <Text style={styles.headerText}>MEDITATION</Text>
          <Text style={styles.subText}>Select duration</Text>
          
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={() => selectDuration(3)}
            >
              <Text style={styles.optionText}>3 MIN</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={() => selectDuration(10)}
            >
              <Text style={styles.optionText}>10 MIN</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionButton} 
              onPress={() => selectDuration(20)}
            >
              <Text style={styles.optionText}>20 MIN</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.optionButton, styles.testButton]} 
              onPress={startTestMode}
            >
              <Text style={styles.optionText}>TEST (10 SEC)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {selectedDuration && !isMeditating && !isComplete && (
        <Animated.View style={[styles.countdownContainer, { opacity: fadeAnim }]}>
          <Text style={styles.countdownText}>{countdownValue}</Text>
          <Text style={styles.countdownSubtext}>
            {countdownValue > 0 ? "Prepare to focus..." : "Begin"}
          </Text>
        </Animated.View>
      )}
      
      {isMeditating && !isComplete && (
        <Animated.View style={[styles.meditationContainer, { opacity: fadeAnim }]}>
          {/* 全屏进度背景 - 修改为覆盖整个屏幕高度 */}
          <View style={styles.progressBackground}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  height: fluidProgressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]} 
            />
          </View>
          
          {/* 时间显示区域 */}
          <View style={styles.timerContainer}>
            {/* 脉动环 */}
            <Animated.View 
              style={[
                styles.pulseRing,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 0.3]
                  })
                }
              ]}
            />
            
            {/* 时间显示 */}
            <Animated.Text 
              style={[
                styles.timerText, 
                {
                  transform: [{scale: breatheAnim}]
                }
              ]}
            >
              {formatTime(remainingTime)}
            </Animated.Text>
            
            {/* 分钟指示器 */}
            <Text style={styles.minutesRemainingText}>
              {minutesText} {minutesLabel} remaining
            </Text>
          </View>
          
          <Text style={styles.meditationSubtext}>呼吸放松...</Text>
        </Animated.View>
      )}
      
      {isComplete && (
        <View style={styles.completeContainer}>
          <Text style={styles.completeText}>Meditation Complete</Text>
          <Text style={styles.completeSubtext}>How do you feel?</Text>
          
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.completeButtonText}>TASK</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  selectionContainer: {
    alignItems: 'center',
    width: '100%',
  },
  headerText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 40,
    letterSpacing: 2,
  },
  subText: {
    color: '#aaa',
    fontSize: 18,
    marginBottom: 40,
    fontWeight: '300',
  },
  optionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  optionButton: {
    paddingVertical: 15,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 4,
  },
  testButton: {
    marginTop: 30,
    borderColor: '#555',
    backgroundColor: '#222',
  },
  optionText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 1,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '200',
    marginBottom: 20,
  },
  countdownSubtext: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: '300',
  },
  meditationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  progressBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%', 
    height: '100%',  // 使用整个屏幕高度
    backgroundColor: 'transparent',
    overflow: 'hidden',
    zIndex: 5,
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
  },
  timerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    position: 'relative',
    zIndex: 15,
  },
  pulseRing: {
    position: 'absolute',
    width: TIMER_SIZE + 10, // 略大于背景
    height: TIMER_SIZE + 10,
    borderRadius: (TIMER_SIZE + 10) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  timerText: {
    color: '#fff',
    fontSize: 70,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    zIndex: 20,
  },
  minutesRemainingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '300',
    marginTop: 15,
    letterSpacing: 1,
  },
  meditationSubtext: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: '300',
    marginTop: 60,
    letterSpacing: 1,
  },
  completeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 10,
  },
  completeSubtext: {
    color: '#aaa',
    fontSize: 18,
    fontWeight: '300',
    marginBottom: 60,
  },
  completeButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: '#222',
    borderRadius: 4,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
});

export default MeditationScreen; 