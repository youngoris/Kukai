/**
 * JournalContext.js
 * Manages journal entry data using Context API + useReducer pattern
 * Integrates with SQLite data persistence layer via JournalDAO
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { JournalDAO } from '../services';

// Action types
const ACTIONS = {
  INITIALIZE_ENTRIES: 'INITIALIZE_ENTRIES',
  ADD_ENTRY: 'ADD_ENTRY',
  UPDATE_ENTRY: 'UPDATE_ENTRY',
  DELETE_ENTRY: 'DELETE_ENTRY',
  SET_ACTIVE_ENTRY: 'SET_ACTIVE_ENTRY',
  CLEAR_ACTIVE_ENTRY: 'CLEAR_ACTIVE_ENTRY',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_FILTER: 'SET_FILTER',
  SET_SEARCH_TERM: 'SET_SEARCH_TERM',
  SET_SEARCH_RESULTS: 'SET_SEARCH_RESULTS',
};

// Initial state
const initialState = {
  isLoading: true,
  error: null,
  entries: [],
  activeEntry: null,
  filter: 'all', // all, byMood, byDate, byTemplate
  searchTerm: '',
  searchResults: [],
  statistics: null,
};

// Reducer function
const journalReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INITIALIZE_ENTRIES:
      return {
        ...state,
        entries: action.payload,
        isLoading: false,
      };
    case ACTIONS.ADD_ENTRY:
      return {
        ...state,
        entries: [action.payload, ...state.entries],
      };
    case ACTIONS.UPDATE_ENTRY:
      return {
        ...state,
        entries: state.entries.map(entry => 
          entry.id === action.payload.id ? { ...entry, ...action.payload } : entry
        ),
        activeEntry: state.activeEntry?.id === action.payload.id 
          ? { ...state.activeEntry, ...action.payload } 
          : state.activeEntry,
      };
    case ACTIONS.DELETE_ENTRY:
      return {
        ...state,
        entries: state.entries.filter(entry => entry.id !== action.payload),
        activeEntry: state.activeEntry?.id === action.payload 
          ? null 
          : state.activeEntry,
      };
    case ACTIONS.SET_ACTIVE_ENTRY:
      return {
        ...state,
        activeEntry: action.payload,
      };
    case ACTIONS.CLEAR_ACTIVE_ENTRY:
      return {
        ...state,
        activeEntry: null,
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
    case ACTIONS.SET_FILTER:
      return {
        ...state,
        filter: action.payload,
      };
    case ACTIONS.SET_SEARCH_TERM:
      return {
        ...state,
        searchTerm: action.payload,
      };
    case ACTIONS.SET_SEARCH_RESULTS:
      return {
        ...state,
        searchResults: action.payload,
      };
    default:
      return state;
  }
};

// Create context
const JournalContext = createContext(null);

// Provider component
export const JournalProvider = ({ children }) => {
  const [state, dispatch] = useReducer(journalReducer, initialState);
  
  // Load entries on mount
  useEffect(() => {
    loadRecentEntries();
  }, []);
  
  // Load recent entries from database (last 30 days)
  const loadRecentEntries = async () => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const entries = await JournalDAO.getEntriesByDateRange(startDate, endDate);
      
      // Transform data from SQLite format to JS format
      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        timestamp: entry.timestamp,
        weather: entry.weather,
        location: entry.location,
        templateId: entry.template_id,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }));
      
      dispatch({ type: ACTIONS.INITIALIZE_ENTRIES, payload: transformedEntries });
    } catch (error) {
      console.error('Failed to load journal entries:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load journal entries' });
    }
  };
  
  // Add a new journal entry
  const addEntry = useCallback(async (entryData) => {
    try {
      const newEntry = {
        id: uuidv4(),
        content: entryData.content,
        mood: entryData.mood,
        tags: entryData.tags,
        timestamp: entryData.timestamp || new Date().toISOString(),
        weather: entryData.weather,
        location: entryData.location,
        templateId: entryData.templateId,
      };
      
      // Save to database
      await JournalDAO.createEntry(newEntry);
      
      // Update state
      dispatch({ type: ACTIONS.ADD_ENTRY, payload: newEntry });
      
      return newEntry;
    } catch (error) {
      console.error('Failed to add journal entry:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to add journal entry' });
      return null;
    }
  }, []);
  
  // Update a journal entry
  const updateEntry = useCallback(async (entryId, updates) => {
    try {
      const entryToUpdate = state.entries.find(entry => entry.id === entryId);
      
      if (!entryToUpdate) {
        throw new Error(`Entry with ID ${entryId} not found`);
      }
      
      const updatedEntry = {
        ...entryToUpdate,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // Update database format
      const dbUpdates = {};
      
      if (updates.content) dbUpdates.content = updates.content;
      if (updates.mood) dbUpdates.mood = updates.mood;
      if (updates.tags) dbUpdates.tags = updates.tags;
      if (updates.timestamp) dbUpdates.timestamp = updates.timestamp;
      if (updates.weather) dbUpdates.weather = updates.weather;
      if (updates.location) dbUpdates.location = updates.location;
      if (updates.templateId) dbUpdates.template_id = updates.templateId;
      
      // Update in database
      await JournalDAO.updateEntry(entryId, dbUpdates);
      
      // Update state
      dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: updatedEntry });
      
      return updatedEntry;
    } catch (error) {
      console.error('Failed to update journal entry:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to update journal entry' });
      return null;
    }
  }, [state.entries]);
  
  // Delete a journal entry
  const deleteEntry = useCallback(async (entryId) => {
    try {
      // Delete from database
      await JournalDAO.delete(entryId);
      
      // Update state
      dispatch({ type: ACTIONS.DELETE_ENTRY, payload: entryId });
      
      return true;
    } catch (error) {
      console.error('Failed to delete journal entry:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to delete journal entry' });
      return false;
    }
  }, []);
  
  // Search entries by content
  const searchEntries = useCallback(async (searchTerm) => {
    try {
      if (!searchTerm.trim()) {
        dispatch({ type: ACTIONS.SET_SEARCH_TERM, payload: '' });
        dispatch({ type: ACTIONS.SET_SEARCH_RESULTS, payload: [] });
        return [];
      }
      
      dispatch({ type: ACTIONS.SET_SEARCH_TERM, payload: searchTerm });
      
      const results = await JournalDAO.searchEntries(searchTerm);
      
      // Transform results
      const transformedResults = results.map(entry => ({
        id: entry.id,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        timestamp: entry.timestamp,
        weather: entry.weather,
        location: entry.location,
        templateId: entry.template_id,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }));
      
      dispatch({ type: ACTIONS.SET_SEARCH_RESULTS, payload: transformedResults });
      
      return transformedResults;
    } catch (error) {
      console.error('Failed to search journal entries:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to search journal entries' });
      return [];
    }
  }, []);
  
  // Get entries by date
  const getEntriesByDate = useCallback(async (date) => {
    try {
      const entries = await JournalDAO.getEntriesByDate(date);
      
      // Transform data
      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        timestamp: entry.timestamp,
        weather: entry.weather,
        location: entry.location,
        templateId: entry.template_id,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }));
      
      return transformedEntries;
    } catch (error) {
      console.error('Failed to get entries by date:', error);
      return [];
    }
  }, []);
  
  // Get entries by mood
  const getEntriesByMood = useCallback(async (mood) => {
    try {
      const entries = await JournalDAO.getEntriesByMood(mood);
      
      // Transform data
      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        timestamp: entry.timestamp,
        weather: entry.weather,
        location: entry.location,
        templateId: entry.template_id,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }));
      
      return transformedEntries;
    } catch (error) {
      console.error('Failed to get entries by mood:', error);
      return [];
    }
  }, []);
  
  // Get journal statistics
  const getStatistics = useCallback(async () => {
    try {
      const stats = await JournalDAO.getJournalStatistics();
      return stats;
    } catch (error) {
      console.error('Failed to get journal statistics:', error);
      return null;
    }
  }, []);
  
  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    entries: state.entries,
    activeEntry: state.activeEntry,
    isLoading: state.isLoading,
    error: state.error,
    filter: state.filter,
    searchTerm: state.searchTerm,
    searchResults: state.searchResults,
    addEntry,
    updateEntry,
    deleteEntry,
    searchEntries,
    getEntriesByDate,
    getEntriesByMood,
    getStatistics,
    setActiveEntry: (entry) => dispatch({ type: ACTIONS.SET_ACTIVE_ENTRY, payload: entry }),
    clearActiveEntry: () => dispatch({ type: ACTIONS.CLEAR_ACTIVE_ENTRY }),
    setFilter: (filter) => dispatch({ type: ACTIONS.SET_FILTER, payload: filter }),
    loadEntries: loadRecentEntries
  }), [
    state.entries,
    state.activeEntry,
    state.isLoading,
    state.error,
    state.filter,
    state.searchTerm,
    state.searchResults,
    addEntry,
    updateEntry,
    deleteEntry,
    searchEntries,
    getEntriesByDate,
    getEntriesByMood,
    getStatistics,
  ]);
  
  return (
    <JournalContext.Provider value={contextValue}>
      {children}
    </JournalContext.Provider>
  );
};

// Custom hook for using the journal context
export const useJournal = () => {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error('useJournal must be used within a JournalProvider');
  }
  return context;
}; 