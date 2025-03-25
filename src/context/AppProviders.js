/**
 * AppProviders.js
 * Combines all context providers into a single component
 * This makes it easy to wrap the entire app with all contexts
 */

import React from 'react';
import { SettingsProvider } from './SettingsContext';
import { TaskProvider } from './TaskContext';
import { MeditationProvider } from './MeditationContext';
import { FocusProvider } from './FocusContext';
import { JournalProvider } from './JournalContext';

// Combined context providers
const AppProviders = ({ children }) => {
  return (
    <SettingsProvider>
      <TaskProvider>
        <MeditationProvider>
          <FocusProvider>
            <JournalProvider>
              {children}
            </JournalProvider>
          </FocusProvider>
        </MeditationProvider>
      </TaskProvider>
    </SettingsProvider>
  );
};

export default AppProviders; 