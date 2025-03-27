/**
 * AppProviders
 * 
 * Combines all context providers into a single component
 * Ensures proper nesting and initialization order
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { TaskProvider } from './TaskContext';
import { JournalProvider } from './JournalContext';
import { AppProvider } from './AppContext';
import DatabaseService from '../services/DatabaseService';

export const AppProviders = ({ children }) => {
  const [databaseInitialized, setDatabaseInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize database on component mount
  useEffect(() => {
    const initDatabase = async () => {
      try {
        setLoading(true);
        
        // Initialize database
        const result = await DatabaseService.initialize();
        
        if (result.success) {
          console.log('Database initialized successfully');
          console.log(`Database schema version: ${result.dbVersion || 'unknown'}`);
          
          if (result.migrationPerformed) {
            console.log('Data migration from AsyncStorage to SQLite completed');
          }
          
          setDatabaseInitialized(true);
        } else {
          console.error('Database initialization failed:', result.error);
          setError(`Database initialization failed: ${result.error}`);
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setError(`Failed to initialize database: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    initDatabase();
    
    // Cleanup function
    return () => {
      // Close database connection when component unmounts
      DatabaseService.close().then(() => {
        console.log('Database connection closed');
      });
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Initializing database...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (!databaseInitialized) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to initialize database</Text>
      </View>
    );
  }

  return (
    <AppProvider>
      <TaskProvider>
        <JournalProvider>
          {children}
        </JournalProvider>
      </TaskProvider>
    </AppProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorText: {
    color: '#FF0000',
    textAlign: 'center',
  }
});

export default AppProviders; 