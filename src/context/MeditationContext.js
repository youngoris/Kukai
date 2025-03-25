/**
 * MeditationContext.js
 * Manages meditation session data using Context API + useReducer pattern
 * Integrates with SQLite data persistence layer
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import databaseService from '../services/DatabaseService';
import { useSettings } from './SettingsContext';

// Action types
const ACTIONS = {
  INITIALIZE_SESSIONS: 'INITIALIZE_SESSIONS',
  START_SESSION: 'START_SESSION',
  END_SESSION: 'END_SESSION',
  PAUSE_SESSION: 'PAUSE_SESSION',
  RESUME_SESSION: 'RESUME_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  DELETE_SESSION: 'DELETE_SESSION',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_ACTIVE_SESSION: 'SET_ACTIVE_SESSION',
  CLEAR_ACTIVE_SESSION: 'CLEAR_ACTIVE_SESSION',
};

// Initial state
const initialState = {
  isLoading: true,
  error: null,
  sessions: [],
  activeSession: null,
  stats: {
    totalMinutes: 0,
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
  },
};

// Reducer function
const meditationReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INITIALIZE_SESSIONS:
      return {
        ...state,
        sessions: action.payload.sessions,
        stats: action.payload.stats,
        isLoading: false,
      };
    case ACTIONS.START_SESSION:
      return {
        ...state,
        activeSession: action.payload,
      };
    case ACTIONS.END_SESSION:
      return {
        ...state,
        sessions: [action.payload, ...state.sessions],
        activeSession: null,
        stats: {
          ...state.stats,
          totalMinutes: state.stats.totalMinutes + Math.round(action.payload.duration / 60),
          totalSessions: state.stats.totalSessions + 1,
          currentStreak: action.payload.maintainsStreak ? state.stats.currentStreak + 1 : 1,
          longestStreak: Math.max(
            state.stats.longestStreak, 
            action.payload.maintainsStreak ? state.stats.currentStreak + 1 : 1
          ),
        },
      };
    case ACTIONS.PAUSE_SESSION:
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          paused: true,
          pausedAt: action.payload,
        },
      };
    case ACTIONS.RESUME_SESSION:
      return {
        ...state,
        activeSession: {
          ...state.activeSession,
          paused: false,
          pausedAt: null,
          totalPausedTime: (state.activeSession.totalPausedTime || 0) + action.payload,
        },
      };
    case ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        sessions: state.sessions.map(session => 
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
      };
    case ACTIONS.DELETE_SESSION:
      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload),
        stats: {
          ...state.stats,
          totalSessions: state.stats.totalSessions - 1,
          totalMinutes: state.stats.totalMinutes - Math.round(
            state.sessions.find(s => s.id === action.payload).duration / 60
          ),
        },
      };
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case ACTIONS.SET_ACTIVE_SESSION:
      return {
        ...state,
        activeSession: action.payload,
      };
    case ACTIONS.CLEAR_ACTIVE_SESSION:
      return {
        ...state,
        activeSession: null,
      };
    default:
      return state;
  }
};

// Create context
const MeditationContext = createContext(null);

// Provider component
export const MeditationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(meditationReducer, initialState);
  const { settings } = useSettings();
  
  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);
  
  // Load sessions from database
  const loadSessions = async () => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const db = databaseService.getDBInstance();
      
      // Execute query to get all sessions
      const results = await databaseService.executeQuery(
        db,
        'SELECT * FROM meditation_sessions ORDER BY startTime DESC',
        []
      );
      
      if (results && results.rows) {
        const sessions = results.rows._array;
        
        // Calculate stats
        const stats = calculateStats(sessions);
        
        dispatch({ 
          type: ACTIONS.INITIALIZE_SESSIONS, 
          payload: { sessions, stats } 
        });
      }
    } catch (error) {
      console.error('Failed to load meditation sessions:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load meditation sessions' });
    }
  };
  
  // Calculate stats from sessions
  const calculateStats = (sessions) => {
    // Total minutes
    const totalMinutes = sessions.reduce((sum, session) => 
      sum + Math.round(session.duration / 60), 0);
    
    // Total sessions
    const totalSessions = sessions.length;
    
    // Calculate streak
    const { currentStreak, longestStreak } = calculateStreak(sessions);
    
    return {
      totalMinutes,
      totalSessions,
      currentStreak,
      longestStreak,
    };
  };
  
  // Calculate meditation streak
  const calculateStreak = (sessions) => {
    if (!sessions.length) return { currentStreak: 0, longestStreak: 0 };
    
    // Sort sessions by date (newest first)
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );
    
    let currentStreak = 0;
    let longestStreak = 0;
    let lastSessionDate = null;
    
    // Helper to check if dates are consecutive
    const isConsecutiveDay = (date1, date2) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      
      // Reset hours to midnight to compare just the dates
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      
      // Calculate difference in days
      const diffTime = Math.abs(d1 - d2);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays === 1;
    };
    
    // Check if today has a session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstSessionDate = new Date(sortedSessions[0].startTime);
    firstSessionDate.setHours(0, 0, 0, 0);
    
    // Current streak starts with today if there's a session today
    if (today.getTime() === firstSessionDate.getTime()) {
      currentStreak = 1;
      lastSessionDate = today;
    } else {
      return { currentStreak: 0, longestStreak: calculateLongestStreak(sortedSessions) };
    }
    
    // Continue counting the streak
    for (let i = 1; i < sortedSessions.length; i++) {
      const sessionDate = new Date(sortedSessions[i].startTime);
      sessionDate.setHours(0, 0, 0, 0);
      
      if (lastSessionDate && isConsecutiveDay(lastSessionDate, sessionDate)) {
        currentStreak++;
        lastSessionDate = sessionDate;
      } else {
        break; // Streak is broken
      }
    }
    
    // Calculate longest streak
    longestStreak = Math.max(currentStreak, calculateLongestStreak(sortedSessions));
    
    return { currentStreak, longestStreak };
  };
  
  // Calculate longest streak ever
  const calculateLongestStreak = (sortedSessions) => {
    if (!sortedSessions.length) return 0;
    
    let longestStreak = 1;
    let currentStreak = 1;
    let lastDate = new Date(sortedSessions[0].startTime);
    lastDate.setHours(0, 0, 0, 0);
    
    for (let i = 1; i < sortedSessions.length; i++) {
      const currentDate = new Date(sortedSessions[i].startTime);
      currentDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(lastDate - currentDate);
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        // Consecutive day
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else if (diffDays > 1) {
        // Streak broken
        currentStreak = 1;
      }
      
      lastDate = currentDate;
    }
    
    return longestStreak;
  };
  
  // Start a new meditation session
  const startSession = useCallback(() => {
    // Default to user's preferred duration or 10 minutes
    const duration = ((settings && settings.meditationDuration) || 10) * 60;
    const soundTheme = (settings && settings.selectedSoundTheme) || 'rain';
    
    const session = {
      id: uuidv4(),
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0, // Will be calculated when session ends
      completed: false,
      totalPausedTime: 0,
      soundTheme,
      notes: '',
      rating: 0,
      targetDuration: duration,
      paused: false,
      pausedAt: null,
    };
    
    dispatch({ type: ACTIONS.START_SESSION, payload: session });
    
    return session;
  }, [settings]);
  
  // End the active meditation session
  const endSession = useCallback(async (notes = '', rating = 0) => {
    if (!state.activeSession) return null;
    
    const now = new Date();
    const startTime = new Date(state.activeSession.startTime);
    const pausedTime = state.activeSession.totalPausedTime || 0;
    
    // Calculate actual duration in seconds
    const duration = Math.round((now - startTime) / 1000) - pausedTime;
    
    // Check if session maintains streak (e.g., completed more than 5 minutes)
    const maintainsStreak = duration >= 300; // 5 minutes minimum
    
    const completedSession = {
      ...state.activeSession,
      endTime: now.toISOString(),
      duration,
      completed: true,
      notes,
      rating,
      maintainsStreak,
    };
    
    try {
      const db = databaseService.getDBInstance();
      
      // Save session to database
      await databaseService.executeQuery(
        db,
        `INSERT INTO meditation_sessions (
          id, startTime, endTime, duration, completed, 
          totalPausedTime, soundTheme, notes, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          completedSession.id,
          completedSession.startTime,
          completedSession.endTime,
          completedSession.duration,
          1, // completed is 1 (true)
          completedSession.totalPausedTime,
          completedSession.soundTheme,
          completedSession.notes,
          completedSession.rating,
        ]
      );
      
      // Update state
      dispatch({ type: ACTIONS.END_SESSION, payload: completedSession });
      
      return completedSession;
    } catch (error) {
      console.error('Failed to save meditation session:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to save meditation session' });
      return null;
    }
  }, [state.activeSession]);
  
  // Pause active session
  const pauseSession = useCallback(() => {
    if (!state.activeSession || state.activeSession.paused) return;
    
    const pausedAt = new Date().getTime();
    dispatch({ type: ACTIONS.PAUSE_SESSION, payload: pausedAt });
  }, [state.activeSession]);
  
  // Resume active session
  const resumeSession = useCallback(() => {
    if (!state.activeSession || !state.activeSession.paused) return;
    
    const now = new Date().getTime();
    const pausedTime = now - state.activeSession.pausedAt;
    
    dispatch({ type: ACTIONS.RESUME_SESSION, payload: pausedTime / 1000 }); // Convert to seconds
  }, [state.activeSession]);
  
  // Delete a session
  const deleteSession = useCallback(async (sessionId) => {
    try {
      const db = databaseService.getDBInstance();
      
      // Delete session from database
      await databaseService.executeQuery(
        db,
        'DELETE FROM meditation_sessions WHERE id = ?',
        [sessionId]
      );
      
      // Update state
      dispatch({ type: ACTIONS.DELETE_SESSION, payload: sessionId });
      
      return true;
    } catch (error) {
      console.error('Failed to delete meditation session:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to delete meditation session' });
      return false;
    }
  }, []);
  
  // Update a session
  const updateSession = useCallback(async (sessionId, updates) => {
    try {
      // Find session
      const sessionToUpdate = state.sessions.find(session => session.id === sessionId);
      
      if (!sessionToUpdate) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      
      const updatedSession = {
        ...sessionToUpdate,
        ...updates,
      };
      
      const db = databaseService.getDBInstance();
      
      // Create query parts
      const updateFields = Object.keys(updates)
        .map(field => `${field} = ?`)
        .join(', ');
        
      const updateValues = [
        ...Object.values(updates),
        sessionId,
      ];
      
      // Update session in database
      await databaseService.executeQuery(
        db,
        `UPDATE meditation_sessions SET ${updateFields} WHERE id = ?`,
        updateValues
      );
      
      // Update state
      dispatch({ type: ACTIONS.UPDATE_SESSION, payload: updatedSession });
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to update meditation session:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to update meditation session' });
      return null;
    }
  }, [state.sessions]);
  
  // Get session stats for a specific date range
  const getSessionStats = useCallback((days = 30) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Filter sessions in date range
    const sessionsInRange = state.sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
    
    // Calculate stats
    const totalSessions = sessionsInRange.length;
    const totalDuration = sessionsInRange.reduce((sum, session) => sum + session.duration, 0);
    const totalMinutes = Math.round(totalDuration / 60);
    const averageDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const averageRating = totalSessions > 0 
      ? sessionsInRange.reduce((sum, session) => sum + session.rating, 0) / totalSessions 
      : 0;
    
    // Group by day for chart data
    const dailyData = {};
    
    // Initialize all days with zero
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      dailyData[dateString] = 0;
    }
    
    // Fill in actual data
    sessionsInRange.forEach(session => {
      const dateString = new Date(session.startTime).toISOString().split('T')[0];
      dailyData[dateString] = (dailyData[dateString] || 0) + session.duration;
    });
    
    return {
      totalSessions,
      totalMinutes,
      averageDuration,
      averageRating,
      dailyData: Object.entries(dailyData).map(([date, seconds]) => ({
        date,
        minutes: Math.round(seconds / 60),
      })),
    };
  }, [state.sessions]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isLoading: state.isLoading,
    error: state.error,
    sessions: state.sessions,
    activeSession: state.activeSession,
    stats: state.stats,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    updateSession,
    deleteSession,
    getSessionStats,
    refresh: loadSessions,
  }), [
    state.isLoading,
    state.error,
    state.sessions,
    state.activeSession,
    state.stats,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    updateSession,
    deleteSession,
    getSessionStats,
  ]);
  
  return (
    <MeditationContext.Provider value={value}>
      {children}
    </MeditationContext.Provider>
  );
};

// Custom hook for using the meditation context
export const useMeditation = () => {
  const context = useContext(MeditationContext);
  if (!context) {
    throw new Error('useMeditation must be used within a MeditationProvider');
  }
  return context;
};

// Export action types for testing
export const MEDITATION_ACTIONS = ACTIONS; 