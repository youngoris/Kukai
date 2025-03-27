/**
 * Settings Service
 * 
 * Manages application settings via AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Settings keys
const KEYS = {
  THEME: 'settings.theme',
  NOTIFICATIONS: 'settings.notifications',
  JOURNAL_TEMPLATES: 'settings.journal_templates',
  DEFAULT_TEMPLATE: 'settings.default_template_id',
  USER_PREFERENCES: 'settings.user_preferences'
};

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark',
  notifications: {
    enabled: true,
    reminders: true,
    tasks: true
  },
  userPreferences: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h'
  }
};

// Default journal templates
const DEFAULT_JOURNAL_TEMPLATES = [
  {
    id: 'default',
    name: 'Default',
    content: '# Today\'s Journal\n\n_Write freely about your day..._',
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'gratitude',
    name: 'Gratitude',
    content: '# Gratitude Journal\n\n## I am grateful for:\n1. \n2. \n3. \n\n## Today I appreciated:\n\n## One small joy I experienced:',
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'reflection',
    name: 'Reflection',
    content: '# Daily Reflection\n\n## What went well today?\n\n## What could have gone better?\n\n## What did I learn?\n\n## What will I focus on tomorrow?',
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'achievement',
    name: 'Achievement',
    content: '# Achievement Journal\n\n## Today\'s wins (big or small):\n- \n\n## Challenges I overcame:\n\n## Progress on goals:\n- [ ] Goal 1:\n- [ ] Goal 2:\n- [ ] Goal 3:\n\n## What did I do to take care of myself today?',
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'evening',
    name: 'Evening',
    content: '# Evening Reflection\n\n## Three things that happened today:\n1. \n2. \n3. \n\n## How am I feeling right now?\n\n## One thing I\'m looking forward to tomorrow:',
    isSystem: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'custom',
    name: 'Custom',
    content: '',
    isSystem: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

class SettingsService {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.isInitialized = false;
  }

  /**
   * Initialize the settings service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load all settings
      const [theme, notificationsStr, preferencesStr, templatesStr] = await Promise.all([
        AsyncStorage.getItem(KEYS.THEME),
        AsyncStorage.getItem(KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(KEYS.USER_PREFERENCES),
        AsyncStorage.getItem(KEYS.JOURNAL_TEMPLATES)
      ]);

      // Update settings with stored values if they exist
      if (theme) {
        this.settings.theme = theme;
      }

      if (notificationsStr) {
        this.settings.notifications = {
          ...this.settings.notifications,
          ...JSON.parse(notificationsStr)
        };
      }

      if (preferencesStr) {
        this.settings.userPreferences = {
          ...this.settings.userPreferences,
          ...JSON.parse(preferencesStr)
        };
      }

      // Initialize templates if they don't exist
      if (!templatesStr) {
        await this.setJournalTemplates(DEFAULT_JOURNAL_TEMPLATES);
      }

      this.isInitialized = true;
      console.log('Settings initialized');
    } catch (error) {
      console.error('Error initializing settings:', error);
    }
  }

  /**
   * Get the current theme
   * @returns {Promise<string>} Theme name
   */
  async getTheme() {
    try {
      const theme = await AsyncStorage.getItem(KEYS.THEME);
      return theme || DEFAULT_SETTINGS.theme;
    } catch (error) {
      console.error('Error getting theme:', error);
      return DEFAULT_SETTINGS.theme;
    }
  }

  /**
   * Set the current theme
   * @param {string} theme Theme name
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    try {
      await AsyncStorage.setItem(KEYS.THEME, theme);
      this.settings.theme = theme;
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }

  /**
   * Get notification settings
   * @returns {Promise<Object>} Notification settings
   */
  async getNotificationSettings() {
    try {
      const settingsStr = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
      if (settingsStr) {
        return {
          ...DEFAULT_SETTINGS.notifications,
          ...JSON.parse(settingsStr)
        };
      }
      return DEFAULT_SETTINGS.notifications;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return DEFAULT_SETTINGS.notifications;
    }
  }

  /**
   * Set notification settings
   * @param {Object} settings Notification settings
   * @returns {Promise<void>}
   */
  async setNotificationSettings(settings) {
    try {
      await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(settings));
      this.settings.notifications = settings;
    } catch (error) {
      console.error('Error setting notification settings:', error);
    }
  }

  /**
   * Get user preferences
   * @returns {Promise<Object>} User preferences
   */
  async getUserPreferences() {
    try {
      const preferencesStr = await AsyncStorage.getItem(KEYS.USER_PREFERENCES);
      if (preferencesStr) {
        return {
          ...DEFAULT_SETTINGS.userPreferences,
          ...JSON.parse(preferencesStr)
        };
      }
      return DEFAULT_SETTINGS.userPreferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return DEFAULT_SETTINGS.userPreferences;
    }
  }

  /**
   * Set user preferences
   * @param {Object} preferences User preferences
   * @returns {Promise<void>}
   */
  async setUserPreferences(preferences) {
    try {
      await AsyncStorage.setItem(KEYS.USER_PREFERENCES, JSON.stringify(preferences));
      this.settings.userPreferences = preferences;
    } catch (error) {
      console.error('Error setting user preferences:', error);
    }
  }

  // JOURNAL TEMPLATE METHODS

  /**
   * Get all journal templates
   * @returns {Promise<Array>} List of journal templates
   */
  async getJournalTemplates() {
    try {
      await this.initialize();
      
      const templatesStr = await AsyncStorage.getItem(KEYS.JOURNAL_TEMPLATES);
      if (templatesStr) {
        return JSON.parse(templatesStr);
      }
      
      // If no templates exist in storage, initialize with defaults and return them
      await this.setJournalTemplates(DEFAULT_JOURNAL_TEMPLATES);
      return DEFAULT_JOURNAL_TEMPLATES;
    } catch (error) {
      console.error('Error getting journal templates:', error);
      return DEFAULT_JOURNAL_TEMPLATES;
    }
  }

  /**
   * Set all journal templates
   * @param {Array} templates List of journal templates
   * @returns {Promise<boolean>} Success indicator
   */
  async setJournalTemplates(templates) {
    try {
      await AsyncStorage.setItem(KEYS.JOURNAL_TEMPLATES, JSON.stringify(templates));
      return true;
    } catch (error) {
      console.error('Error setting journal templates:', error);
      return false;
    }
  }

  /**
   * Get a journal template by ID
   * @param {string} id Template ID
   * @returns {Promise<Object|null>} Template object or null
   */
  async getJournalTemplateById(id) {
    try {
      const templates = await this.getJournalTemplates();
      return templates.find(template => template.id === id) || templates[0]; // Return first template as fallback
    } catch (error) {
      console.error('Error getting journal template by ID:', error);
      return DEFAULT_JOURNAL_TEMPLATES[0];
    }
  }

  /**
   * Create a new journal template
   * @param {Object} template Template object
   * @returns {Promise<Object>} Created template
   */
  async createJournalTemplate(template) {
    try {
      const templates = await this.getJournalTemplates();
      
      // Generate a new template with ID and timestamps
      const newTemplate = {
        ...template,
        id: template.id || `template_${Date.now()}`,
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to templates array
      templates.push(newTemplate);
      
      // Save updated templates
      await this.setJournalTemplates(templates);
      
      return newTemplate;
    } catch (error) {
      console.error('Error creating journal template:', error);
      throw error;
    }
  }

  /**
   * Update a journal template
   * @param {string} id Template ID
   * @param {Object} updates Template updates
   * @returns {Promise<Object>} Updated template
   */
  async updateJournalTemplate(id, updates) {
    try {
      const templates = await this.getJournalTemplates();
      
      // Find template index
      const index = templates.findIndex(template => template.id === id);
      
      if (index === -1) {
        throw new Error(`Template with ID ${id} not found`);
      }
      
      // System templates cannot be modified (except 'custom')
      if (id !== 'custom' && templates[index].isSystem) {
        throw new Error('System templates cannot be modified');
      }
      
      // Update template
      templates[index] = {
        ...templates[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Save updated templates
      await this.setJournalTemplates(templates);
      
      return templates[index];
    } catch (error) {
      console.error('Error updating journal template:', error);
      throw error;
    }
  }

  /**
   * Delete a journal template
   * @param {string} id Template ID
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteJournalTemplate(id) {
    try {
      const templates = await this.getJournalTemplates();
      
      // Find template
      const template = templates.find(template => template.id === id);
      
      if (!template) {
        throw new Error(`Template with ID ${id} not found`);
      }
      
      // Cannot delete system templates
      if (template.isSystem) {
        throw new Error('System templates cannot be deleted');
      }
      
      // Filter out the template
      const updatedTemplates = templates.filter(template => template.id !== id);
      
      // Save updated templates
      await this.setJournalTemplates(updatedTemplates);
      
      return true;
    } catch (error) {
      console.error('Error deleting journal template:', error);
      throw error;
    }
  }

  /**
   * Get default template ID
   * @returns {Promise<string>} Default template ID
   */
  async getDefaultTemplateId() {
    try {
      const id = await AsyncStorage.getItem(KEYS.DEFAULT_TEMPLATE);
      return id || 'default';
    } catch (error) {
      console.error('Error getting default template ID:', error);
      return 'default';
    }
  }

  /**
   * Set default template ID
   * @param {string} id Template ID
   * @returns {Promise<boolean>} Success indicator
   */
  async setDefaultTemplateId(id) {
    try {
      await AsyncStorage.setItem(KEYS.DEFAULT_TEMPLATE, id);
      return true;
    } catch (error) {
      console.error('Error setting default template ID:', error);
      return false;
    }
  }
}

export default new SettingsService(); 