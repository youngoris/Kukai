/**
 * FocusContext.js
 * Manages focus session data using Context API + useReducer pattern
 * Integrates with SQLite data persistence layer via FocusDAO
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FocusDAO } from '../services';

// Action types
const ACTIONS = {
  INITIALIZE_SESSIONS: 'INITIALIZE_SESSIONS',
  START_SESSION: 'START_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  COMPLETE_SESSION: 'COMPLETE_SESSION',
  DELETE_SESSION: 'DELETE_SESSION',
  SET_ACTIVE_SESSION: 'SET_ACTIVE_SESSION',
  CLEAR_ACTIVE_SESSION: 'CLEAR_ACTIVE_SESSION',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  ADD_INTERRUPTION: 'ADD_INTERRUPTION',
  INCREMENT_POMODORO: 'INCREMENT_POMODORO',
};

// Initial state
const initialState = {
  isLoading: true,
  error: null,
  sessions: [],
  activeSession: null,
  statistics: null,
};

// Reducer function
const focusReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INITIALIZE_SESSIONS:
      return {
        ...state,
        sessions: action.payload,
        isLoading: false,
      };
    case ACTIONS.START_SESSION:
      return {
        ...state,
        activeSession: action.payload,
        sessions: [action.payload, ...state.sessions],
      };
    case ACTIONS.UPDATE_SESSION:
      return {
        ...state,
        sessions: state.sessions.map(session => 
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
        activeSession: state.activeSession?.id === action.payload.id 
          ? { ...state.activeSession, ...action.payload } 
          : state.activeSession,
      };
    case ACTIONS.COMPLETE_SESSION:
      return {
        ...state,
        sessions: state.sessions.map(session => 
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
        activeSession: null,
      };
    case ACTIONS.DELETE_SESSION:
      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload),
        activeSession: state.activeSession?.id === action.payload 
          ? null 
          : state.activeSession,
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
    case ACTIONS.ADD_INTERRUPTION:
      if (!state.activeSession) return state;
      const updatedActiveSession = {
        ...state.activeSession,
        interruptionCount: (state.activeSession.interruptionCount || 0) + 1,
        interrupted: true,
      };
      return {
        ...state,
        activeSession: updatedActiveSession,
        sessions: state.sessions.map(session => 
          session.id === updatedActiveSession.id ? updatedActiveSession : session
        ),
      };
    case ACTIONS.INCREMENT_POMODORO:
      if (!state.activeSession) return state;
      const sessionWithIncrementedPomodoros = {
        ...state.activeSession,
        pomodoroCount: (state.activeSession.pomodoroCount || 1) + 1,
      };
      return {
        ...state,
        activeSession: sessionWithIncrementedPomodoros,
        sessions: state.sessions.map(session => 
          session.id === sessionWithIncrementedPomodoros.id ? sessionWithIncrementedPomodoros : session
        ),
      };
    default:
      return state;
  }
};

// Create context
const FocusContext = createContext(null);

// Provider component
export const FocusProvider = ({ children }) => {
  const [state, dispatch] = useReducer(focusReducer, initialState);
  
  // Load sessions on mount
  useEffect(() => {
    loadTodaySessions();
  }, []);
  
  // Load today's sessions from database
  const loadTodaySessions = async () => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const today = new Date();
      const sessions = await FocusDAO.getSessionsByDate(today);
      
      // Transform data from SQLite format to JS format
      const transformedSessions = sessions.map(session => ({
        id: session.id,
        duration: session.duration,
        breakDuration: session.break_duration,
        taskId: session.task_id,
        startTime: session.start_time,
        endTime: session.end_time,
        completed: Boolean(session.completed),
        interrupted: Boolean(session.interrupted),
        interruptionCount: session.interruption_count,
        pomodoroCount: session.pomodoro_count,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }));
      
      dispatch({ type: ACTIONS.INITIALIZE_SESSIONS, payload: transformedSessions });
      
      // Check if there's an active session
      const activeSession = transformedSessions.find(
        session => !session.completed && session.startTime
      );
      
      if (activeSession) {
        dispatch({ type: ACTIONS.SET_ACTIVE_SESSION, payload: activeSession });
      }
    } catch (error) {
      console.error('Failed to load focus sessions:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load focus sessions' });
    }
  };
  
  // Start a new focus session
  const startSession = useCallback(async (sessionData) => {
    try {
      const newSession = {
        id: uuidv4(),
        duration: sessionData.duration || 25 * 60, // default 25 min in seconds
        breakDuration: sessionData.breakDuration || 5 * 60, // default 5 min in seconds
        taskId: sessionData.taskId,
        startTime: new Date().toISOString(),
        endTime: null,
        completed: false,
        interrupted: false,
        interruptionCount: 0,
        pomodoroCount: 1,
      };
      
      // Save to database
      await FocusDAO.createSession(newSession);
      
      // Update state
      dispatch({ type: ACTIONS.START_SESSION, payload: newSession });
      
      return newSession;
    } catch (error) {
      console.error('Failed to start focus session:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to start focus session' });
      return null;
    }
  }, []);
  
  // Complete focus session
  const completeSession = useCallback(async (sessionId, sessionData = {}) => {
    try {
      const activeSession = state.sessions.find(s => s.id === sessionId);
      
      if (!activeSession) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      
      const updatedSession = {
        ...activeSession,
        ...sessionData,
        completed: true,
        endTime: sessionData.endTime || new Date().toISOString(),
      };
      
      // Update in database
      await FocusDAO.completeSession(sessionId, {
        endTime: updatedSession.endTime,
        interruptionCount: updatedSession.interruptionCount,
        pomodoroCount: updatedSession.pomodoroCount,
      });
      
      // Update state
      dispatch({ type: ACTIONS.COMPLETE_SESSION, payload: updatedSession });
      
      return updatedSession;
    } catch (error) {
      console.error('Failed to complete focus session:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to complete focus session' });
      return null;
    }
  }, [state.sessions]);
  
  // Add interruption to current session
  const addInterruption = useCallback(async () => {
    if (!state.activeSession) return null;
    
    try {
      const updatedCount = (state.activeSession.interruptionCount || 0) + 1;
      
      // Update in database
      await FocusDAO.updateSession(state.activeSession.id, {
        interruption_count: updatedCount,
        interrupted: 1,
      });
      
      // Update state
      dispatch({ type: ACTIONS.ADD_INTERRUPTION });
      
      return updatedCount;
    } catch (error) {
      console.error('Failed to add interruption:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to add interruption' });
      return null;
    }
  }, [state.activeSession]);
  
  // Increment pomodoro count
  const incrementPomodoro = useCallback(async () => {
    if (!state.activeSession) return null;
    
    try {
      const updatedCount = (state.activeSession.pomodoroCount || 1) + 1;
      
      // Update in database
      await FocusDAO.updateSession(state.activeSession.id, {
        pomodoro_count: updatedCount,
      });
      
      // Update state
      dispatch({ type: ACTIONS.INCREMENT_POMODORO });
      
      return updatedCount;
    } catch (error) {
      console.error('Failed to increment pomodoro count:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to increment pomodoro count' });
      return null;
    }
  }, [state.activeSession]);
  
  // Get focus statistics
  const getStatistics = useCallback(async (period = 'week') => {
    try {
      const endDate = new Date();
      let startDate;
      
      switch (period) {
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
      }
      
      const stats = await FocusDAO.getFocusStatistics(startDate, endDate);
      return stats;
    } catch (error) {
      console.error('Failed to get focus statistics:', error);
      return null;
    }
  }, []);
  
  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    sessions: state.sessions,
    activeSession: state.activeSession,
    isLoading: state.isLoading,
    error: state.error,
    startSession,
    completeSession,
    addInterruption,
    incrementPomodoro,
    getStatistics,
    loadSessions: loadTodaySessions
  }), [
    state.sessions, 
    state.activeSession, 
    state.isLoading, 
    state.error,
    startSession,
    completeSession,
    addInterruption,
    incrementPomodoro,
    getStatistics,
  ]);
  
  return (
    <FocusContext.Provider value={contextValue}>
      {children}
    </FocusContext.Provider>
  );
};

// Custom hook for using the focus context
export const useFocus = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}; 