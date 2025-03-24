/**
 * ValidationService - Provides validation for database operations
 */
class ValidationService {
  // Validate task data
  validateTask(taskData) {
    const errors = [];
    
    // Required fields
    if (!taskData.title) {
      errors.push('Task title is required');
    }
    
    // Date validations
    if (taskData.due_date && isNaN(new Date(taskData.due_date).getTime())) {
      errors.push('Invalid due date format');
    }
    
    // Boolean validations
    if (taskData.completed !== undefined && typeof taskData.completed !== 'boolean' && taskData.completed !== 0 && taskData.completed !== 1) {
      errors.push('Completed must be a boolean or 0/1');
    }
    
    if (taskData.is_frog !== undefined && typeof taskData.is_frog !== 'boolean' && taskData.is_frog !== 0 && taskData.is_frog !== 1) {
      errors.push('Is frog must be a boolean or 0/1');
    }
    
    if (taskData.is_important !== undefined && typeof taskData.is_important !== 'boolean' && taskData.is_important !== 0 && taskData.is_important !== 1) {
      errors.push('Is important must be a boolean or 0/1');
    }
    
    if (taskData.is_urgent !== undefined && typeof taskData.is_urgent !== 'boolean' && taskData.is_urgent !== 0 && taskData.is_urgent !== 1) {
      errors.push('Is urgent must be a boolean or 0/1');
    }
    
    // Priority validations
    if (taskData.priority !== undefined && (isNaN(parseInt(taskData.priority)) || parseInt(taskData.priority) < 0)) {
      errors.push('Priority must be a non-negative number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate meditation session data
  validateMeditationSession(sessionData) {
    const errors = [];
    
    // Required fields
    if (!sessionData.duration) {
      errors.push('Duration is required');
    } else if (isNaN(parseInt(sessionData.duration)) || parseInt(sessionData.duration) <= 0) {
      errors.push('Duration must be a positive number');
    }
    
    if (!sessionData.start_time) {
      errors.push('Start time is required');
    } else if (isNaN(new Date(sessionData.start_time).getTime())) {
      errors.push('Invalid start time format');
    }
    
    if (sessionData.end_time && isNaN(new Date(sessionData.end_time).getTime())) {
      errors.push('Invalid end time format');
    }
    
    // Boolean validations
    if (sessionData.completed !== undefined && typeof sessionData.completed !== 'boolean' && sessionData.completed !== 0 && sessionData.completed !== 1) {
      errors.push('Completed must be a boolean or 0/1');
    }
    
    // Sound theme validation
    if (!sessionData.sound_theme) {
      errors.push('Sound theme is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate journal entry data
  validateJournalEntry(entryData) {
    const errors = [];
    
    // Required fields
    if (!entryData.content) {
      errors.push('Content is required');
    }
    
    if (!entryData.timestamp) {
      errors.push('Timestamp is required');
    } else if (isNaN(new Date(entryData.timestamp).getTime())) {
      errors.push('Invalid timestamp format');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate focus session data
  validateFocusSession(sessionData) {
    const errors = [];
    
    // Required fields
    if (!sessionData.duration) {
      errors.push('Duration is required');
    } else if (isNaN(parseInt(sessionData.duration)) || parseInt(sessionData.duration) <= 0) {
      errors.push('Duration must be a positive number');
    }
    
    if (!sessionData.start_time) {
      errors.push('Start time is required');
    } else if (isNaN(new Date(sessionData.start_time).getTime())) {
      errors.push('Invalid start time format');
    }
    
    if (sessionData.end_time && isNaN(new Date(sessionData.end_time).getTime())) {
      errors.push('Invalid end time format');
    }
    
    // Boolean validations
    if (sessionData.completed !== undefined && typeof sessionData.completed !== 'boolean' && sessionData.completed !== 0 && sessionData.completed !== 1) {
      errors.push('Completed must be a boolean or 0/1');
    }
    
    // Interruptions validations
    if (sessionData.interruptions !== undefined && (isNaN(parseInt(sessionData.interruptions)) || parseInt(sessionData.interruptions) < 0)) {
      errors.push('Interruptions must be a non-negative number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate category data
  validateCategory(categoryData) {
    const errors = [];
    
    // Required fields
    if (!categoryData.name) {
      errors.push('Name is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate journal template data
  validateJournalTemplate(templateData) {
    const errors = [];
    
    // Required fields
    if (!templateData.title) {
      errors.push('Title is required');
    }
    
    if (!templateData.content) {
      errors.push('Content is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Sanitize data to prevent SQL injection
  sanitizeData(data) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Handle string values
      if (typeof value === 'string') {
        // Remove any dangerous SQL characters
        sanitized[key] = value
          .replace(/'/g, "''") // Escape single quotes
          .replace(/;/g, "") // Remove semicolons
          .trim();
      } else {
        // Keep non-string values as is
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  // Convert boolean values to integers for SQLite
  prepareBooleans(data) {
    const prepared = { ...data };
    
    for (const [key, value] of Object.entries(prepared)) {
      // Convert boolean values to 0/1 for SQLite
      if (typeof value === 'boolean') {
        prepared[key] = value ? 1 : 0;
      }
    }
    
    return prepared;
  }
  
  // Format dates for SQLite
  formatDates(data, dateFields = ['due_date', 'start_time', 'end_time', 'timestamp']) {
    const formatted = { ...data };
    
    for (const field of dateFields) {
      if (formatted[field]) {
        // Make sure date is in ISO format
        if (formatted[field] instanceof Date) {
          formatted[field] = formatted[field].toISOString();
        } else if (typeof formatted[field] === 'string' && !isNaN(new Date(formatted[field]).getTime())) {
          formatted[field] = new Date(formatted[field]).toISOString();
        }
      }
    }
    
    return formatted;
  }
  
  // Process data for database operations - validate, sanitize, and format
  processDataForDatabase(data, validator) {
    // Validate the data
    const validation = validator(data);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        data: null
      };
    }
    
    // Sanitize the data
    const sanitized = this.sanitizeData(data);
    
    // Prepare boolean values
    const booleansPrepared = this.prepareBooleans(sanitized);
    
    // Format dates
    const formatted = this.formatDates(booleansPrepared);
    
    return {
      success: true,
      data: formatted
    };
  }
}

export default new ValidationService(); 