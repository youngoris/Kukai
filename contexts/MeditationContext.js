import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MeditationContext = createContext();

export const MeditationProvider = ({ children }) => {
  const [activeMeditation, setActiveMeditation] = useState(null);
  // 格式: { startTime: timestamp, duration: seconds, remainingTime: seconds }

  // 加载保存的冥想状态
  useEffect(() => {
    const loadMeditationState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('active_meditation');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          
          // 检查冥想是否已过期
          const now = Date.now();
          const endTime = parsedState.startTime + (parsedState.duration * 1000);
          
          if (now < endTime) {
            // 计算剩余时间
            const remainingSeconds = Math.floor((endTime - now) / 1000);
            setActiveMeditation({
              ...parsedState,
              remainingTime: remainingSeconds
            });
          } else {
            // 冥想已结束，清除状态
            await AsyncStorage.removeItem('active_meditation');
          }
        }
      } catch (error) {
        console.error('加载冥想状态失败:', error);
      }
    };
    
    loadMeditationState();
    
    // 每秒更新剩余时间
    const interval = setInterval(() => {
      setActiveMeditation(prev => {
        if (!prev) return null;
        
        const newRemainingTime = prev.remainingTime - 1;
        
        // 检查冥想是否已结束
        if (newRemainingTime <= 0) {
          // 清除状态
          AsyncStorage.removeItem('active_meditation');
          return null;
        }
        
        // 更新状态
        const updatedState = {
          ...prev,
          remainingTime: newRemainingTime
        };
        
        return updatedState;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // 开始新的冥想
  const startMeditation = async (durationSeconds) => {
    const meditationState = {
      startTime: Date.now(),
      duration: durationSeconds,
      remainingTime: durationSeconds
    };
    
    setActiveMeditation(meditationState);
    
    // 保存到 AsyncStorage
    try {
      await AsyncStorage.setItem('active_meditation', JSON.stringify(meditationState));
    } catch (error) {
      console.error('保存冥想状态失败:', error);
    }
  };
  
  // 结束冥想
  const endMeditation = async () => {
    setActiveMeditation(null);
    
    // 从 AsyncStorage 中移除
    try {
      await AsyncStorage.removeItem('active_meditation');
    } catch (error) {
      console.error('移除冥想状态失败:', error);
    }
  };
  
  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <MeditationContext.Provider 
      value={{ 
        activeMeditation, 
        startMeditation, 
        endMeditation,
        formatTime
      }}
    >
      {children}
    </MeditationContext.Provider>
  );
};

export const useMeditation = () => useContext(MeditationContext); 