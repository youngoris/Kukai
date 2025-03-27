/**
 * JournalContext
 * 
 * Provides global state management for journal entries using Context API
 * Handles interactions with JournalDAO for database operations
 * Uses SettingsService for template management
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import JournalDAO from '../dao/JournalDAO';
import SettingsService from '../services/SettingsService';

// Create the context
const JournalContext = createContext(null);

// Custom hook for using the journal context
export const useJournalContext = () => {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error('useJournalContext must be used within a JournalProvider');
  }
  return context;
};

// Provider component
export const JournalProvider = ({ children }) => {
  const [entries, setEntries] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all journal entries and templates on mount
  useEffect(() => {
    const loadJournalData = async () => {
      try {
        setLoading(true);
        
        // Load entries from SQLite
        const allEntries = await JournalDAO.getAllEntries();
        
        // Load templates from AsyncStorage via SettingsService
        const allTemplates = await SettingsService.getJournalTemplates();
        
        setEntries(allEntries);
        setTemplates(allTemplates);
        setError(null);
      } catch (err) {
        console.error('Failed to load journal data:', err);
        setError('Failed to load journal data');
      } finally {
        setLoading(false);
      }
    };

    loadJournalData();
  }, []);

  // Create a new journal entry
  const createEntry = useCallback(async (entry) => {
    try {
      // Validate entry data before passing to DAO
      if (!entry) {
        throw new Error('Entry data is required');
      }
      
      // Ensure required fields are present
      if (!entry.text || typeof entry.text !== 'string') {
        throw new Error('Journal text is required and must be a string');
      }
      
      console.log('JournalContext: Creating entry with data:', 
        JSON.stringify({
          date: entry.date,
          textLength: entry.text?.length || 0,
          text: entry.text?.substring(0, 30) + (entry.text?.length > 30 ? '...' : '')
        })
      );
      
      // Create a clean copy of the entry data to avoid reference issues
      const entryData = { ...entry };
      
      // Generate a guaranteed title if one isn't provided
      if (!entryData.title || typeof entryData.title !== 'string' || entryData.title.trim() === '') {
        console.log('JournalContext: No valid title provided, generating one');
        
        // Extract a title from the text
        try {
          const plainText = entryData.text.replace(/[#*_`~>]/g, '').trim();
          const words = plainText.split(/\s+/);
          const titleWords = words.slice(0, Math.min(7, words.length));
          const extractedText = titleWords.join(' ');
          
          // Get formatted date
          const dateObj = new Date(entryData.date || new Date());
          const formattedDate = dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          });
          
          // Create title with date and extracted text
          const generatedTitle = extractedText 
            ? `${formattedDate}: ${extractedText}${titleWords.length < words.length ? '...' : ''}`
            : `Journal Entry - ${formattedDate}`;
          
          entryData.title = generatedTitle;
          console.log(`JournalContext: Generated title: "${generatedTitle}"`);
        } catch (titleError) {
          console.error('JournalContext: Error generating title:', titleError);
          // Guaranteed safe fallback
          const fallbackTitle = `Journal Entry ${Date.now()}`;
          entryData.title = fallbackTitle;
          console.log(`JournalContext: Using fallback title: "${fallbackTitle}"`);
        }
      } else {
        // We have a title, but sanitize it
        const sanitizedTitle = entryData.title.replace(/["'`;]/g, '').trim();
        if (sanitizedTitle === '') {
          // If sanitization made it empty, generate a new one
          const fallbackTitle = `Journal Entry ${Date.now()}`;
          entryData.title = fallbackTitle;
          console.log(`JournalContext: Title empty after sanitization, using fallback: "${fallbackTitle}"`);
        } else {
          entryData.title = sanitizedTitle;
          console.log(`JournalContext: Using sanitized title: "${sanitizedTitle}"`);
        }
      }
      
      // Debug the final entry data with guaranteed title
      console.log('JournalContext: Final entry data being sent to DAO:', JSON.stringify({
        hasTitle: true, // We've guaranteed a title by this point
        title: entryData.title,
        titleLength: entryData.title?.length || 0,
        textLength: entryData.text?.length || 0,
        date: entryData.date
      }));
      
      // 最后的标题安全检查
      if (!entryData.title || typeof entryData.title !== 'string' || entryData.title.trim() === '') {
        console.warn('JournalContext: 最后检查发现title为空，添加应急标题');
        const emergencyTitle = `Journal Entry ${new Date().toLocaleString()}`;
        entryData.title = emergencyTitle;
        console.log(`JournalContext: 使用应急标题: "${emergencyTitle}"`);
      }
      
      // Call DAO to create entry
      try {
        console.log(`JournalContext: 调用DAO创建条目，标题: "${entryData.title}", 长度: ${entryData.title.length}`);
        const createdEntry = await JournalDAO.createEntry(entryData);
        
        // Check if we received an entry object with error indicators
        if (createdEntry && createdEntry._notSaved) {
          console.error('JournalContext: DAO returned entry with _notSaved flag:', createdEntry._error);
          throw new Error(`Failed to create entry: ${createdEntry._error || 'Unknown error'}`);
        }
        
        if (!createdEntry) {
          throw new Error('Failed to create entry - no entry returned from DAO');
        }
        
        console.log('JournalContext: Entry created successfully with ID:', createdEntry.id);
        setEntries(prev => [...prev, createdEntry]);
        return createdEntry;
      } catch (err) {
        console.error('Failed to create journal entry:', err);
        setError(`Failed to create journal entry: ${err.message}`);
        throw err;
      }
    } catch (err) {
      console.error('Failed to create journal entry:', err);
      setError(`Failed to create journal entry: ${err.message}`);
      throw err;
    }
  }, []);

  // Update an existing journal entry
  const updateEntry = useCallback(async (id, updates) => {
    try {
      const updatedEntry = await JournalDAO.updateEntry(id, updates);
      setEntries(prev => prev.map(entry => entry.id === id ? updatedEntry : entry));
      return updatedEntry;
    } catch (err) {
      console.error('Failed to update journal entry:', err);
      setError('Failed to update journal entry');
      throw err;
    }
  }, []);

  // Delete a journal entry
  const deleteEntry = useCallback(async (id) => {
    try {
      const success = await JournalDAO.deleteEntry(id);
      if (success) {
        setEntries(prev => prev.filter(entry => entry.id !== id));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete journal entry:', err);
      setError('Failed to delete journal entry');
      throw err;
    }
  }, []);

  // Get a journal entry by date
  const getEntryByDate = useCallback(async (date) => {
    try {
      // Ensure date is in proper YYYY-MM-DD format
      let formattedDate = date;
      
      // If date is a Date object, convert to string
      if (date instanceof Date) {
        formattedDate = date.toISOString().split('T')[0];
      }
      
      // Validate date format
      if (!formattedDate || !/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
        console.error('Invalid date format in getEntryByDate:', formattedDate);
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      
      // Attempt to fetch the entry
      console.log('JournalContext: Fetching entry for date:', formattedDate);
      const entry = await JournalDAO.getEntryByDate(formattedDate);
      
      if (entry) {
        console.log('JournalContext: Found entry:', entry.id);
      } else {
        console.log('JournalContext: No entry found for date:', formattedDate);
      }
      
      return entry;
    } catch (err) {
      console.error('JournalContext: Failed to get journal entry by date:', err);
      setError('Failed to load journal entry: ' + err.message);
      return null; // Return null instead of throwing to prevent app crashes
    }
  }, []);

  // Get entries in a date range
  const getEntriesInRange = useCallback(async (startDate, endDate) => {
    try {
      // Validate date format
      if (!startDate || !endDate || 
          !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || 
          !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        console.error('Invalid date format in getEntriesInRange:', { startDate, endDate });
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      
      console.log(`JournalContext: Fetching entries from ${startDate} to ${endDate}`);
      const rangeEntries = await JournalDAO.getEntriesInRange(startDate, endDate);
      
      console.log(`JournalContext: Found ${rangeEntries.length} entries in range`);
      return rangeEntries;
    } catch (err) {
      console.error('JournalContext: Failed to get entries in range:', err);
      setError('Failed to load journal entries: ' + err.message);
      return []; // Return empty array instead of throwing to prevent app crashes
    }
  }, []);

  // Get journal statistics
  const getJournalStats = useCallback(async () => {
    try {
      return await JournalDAO.getJournalStats();
    } catch (err) {
      console.error('Failed to get journal statistics:', err);
      setError('Failed to load journal statistics');
      throw err;
    }
  }, []);

  // Set default template ID
  const setDefaultTemplateId = useCallback(async (id) => {
    try {
      return await SettingsService.setDefaultTemplateId(id);
    } catch (err) {
      console.error('Failed to set default template:', err);
      setError('Failed to set default template');
      throw err;
    }
  }, []);

  // Get default template ID
  const getDefaultTemplateId = useCallback(async () => {
    try {
      return await SettingsService.getDefaultTemplateId();
    } catch (err) {
      console.error('Failed to get default template ID:', err);
      setError('Failed to get default template ID');
      return 'default'; // Fallback to default
    }
  }, []);

  // Refresh all journal data
  const refreshJournal = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load entries from SQLite
      const allEntries = await JournalDAO.getAllEntries();
      
      // Load templates from AsyncStorage via SettingsService
      const allTemplates = await SettingsService.getJournalTemplates();
      
      setEntries(allEntries);
      setTemplates(allTemplates);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh journal data:', err);
      setError('Failed to refresh journal data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create context value
  const value = {
    entries,
    templates,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    getEntryByDate,
    getEntriesInRange,
    getJournalStats,
    refreshJournal
  };

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
};

export default JournalContext; 