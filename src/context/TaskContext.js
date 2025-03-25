/**
 * TaskContext.js
 * Manages task data using Context API + useReducer pattern
 * Integrates with SQLite data persistence layer
 */

import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import databaseService from '../services/DatabaseService';

// Action types
const ACTIONS = {
  INITIALIZE_TASKS: 'INITIALIZE_TASKS',
  ADD_TASK: 'ADD_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK',
  COMPLETE_TASK: 'COMPLETE_TASK',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_FILTER: 'SET_FILTER',
  SET_SORT: 'SET_SORT',
};

// Initial state
const initialState = {
  isLoading: true,
  error: null,
  tasks: [],
  filter: 'all', // 'all', 'active', 'completed'
  sort: 'date', // 'date', 'priority', 'alphabetical'
};

// Reducer function
const taskReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.INITIALIZE_TASKS:
      return {
        ...state,
        tasks: action.payload,
        isLoading: false,
      };
    case ACTIONS.ADD_TASK:
      return {
        ...state,
        tasks: [...state.tasks, action.payload],
      };
    case ACTIONS.UPDATE_TASK:
      return {
        ...state,
        tasks: state.tasks.map(task => 
          task.id === action.payload.id ? { ...task, ...action.payload } : task
        ),
      };
    case ACTIONS.DELETE_TASK:
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };
    case ACTIONS.COMPLETE_TASK:
      return {
        ...state,
        tasks: state.tasks.map(task => 
          task.id === action.payload.id 
            ? { ...task, completed: action.payload.completed, completedAt: action.payload.completedAt } 
            : task
        ),
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
    case ACTIONS.SET_SORT:
      return {
        ...state,
        sort: action.payload,
      };
    default:
      return state;
  }
};

// Create context
const TaskContext = createContext(null);

// Provider component
export const TaskProvider = ({ children }) => {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  
  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);
  
  // Load tasks from database
  const loadTasks = async () => {
    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const db = databaseService.getDBInstance();
      
      // Execute query to get all tasks
      const results = await databaseService.executeQuery(
        db,
        'SELECT * FROM tasks ORDER BY createdAt DESC',
        []
      );
      
      if (results && results.rows) {
        const tasks = results.rows._array;
        dispatch({ type: ACTIONS.INITIALIZE_TASKS, payload: tasks });
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load tasks' });
    }
  };
  
  // Add new task
  const addTask = useCallback(async (task) => {
    try {
      const newTask = {
        id: uuidv4(),
        title: task.title,
        description: task.description || '',
        completed: false,
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
        category: task.category || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      };
      
      const db = databaseService.getDBInstance();
      
      // Insert task into database
      await databaseService.executeQuery(
        db,
        'INSERT INTO tasks (id, title, description, completed, priority, dueDate, category, createdAt, updatedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newTask.id,
          newTask.title,
          newTask.description,
          newTask.completed ? 1 : 0,
          newTask.priority,
          newTask.dueDate,
          newTask.category,
          newTask.createdAt,
          newTask.updatedAt,
          newTask.completedAt,
        ]
      );
      
      // Update state
      dispatch({ type: ACTIONS.ADD_TASK, payload: newTask });
      
      return newTask;
    } catch (error) {
      console.error('Failed to add task:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to add task' });
      return null;
    }
  }, []);
  
  // Update task
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      // Find current task
      const taskToUpdate = state.tasks.find(task => task.id === taskId);
      
      if (!taskToUpdate) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      const updatedTask = {
        ...taskToUpdate,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const db = databaseService.getDBInstance();
      
      // Create query parts
      const updateFields = Object.keys(updates)
        .map(field => `${field} = ?`)
        .join(', ');
        
      const updateValues = [
        ...Object.values(updates),
        updatedTask.updatedAt,
        taskId,
      ];
      
      // Update task in database
      await databaseService.executeQuery(
        db,
        `UPDATE tasks SET ${updateFields}, updatedAt = ? WHERE id = ?`,
        updateValues
      );
      
      // Update state
      dispatch({ type: ACTIONS.UPDATE_TASK, payload: updatedTask });
      
      return updatedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to update task' });
      return null;
    }
  }, [state.tasks]);
  
  // Delete task
  const deleteTask = useCallback(async (taskId) => {
    try {
      const db = databaseService.getDBInstance();
      
      // Delete task from database
      await databaseService.executeQuery(
        db,
        'DELETE FROM tasks WHERE id = ?',
        [taskId]
      );
      
      // Update state
      dispatch({ type: ACTIONS.DELETE_TASK, payload: taskId });
      
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to delete task' });
      return false;
    }
  }, []);
  
  // Mark task as complete/incomplete
  const toggleTaskComplete = useCallback(async (taskId, completed) => {
    try {
      const completedAt = completed ? new Date().toISOString() : null;
      
      const db = databaseService.getDBInstance();
      
      // Update task in database
      await databaseService.executeQuery(
        db,
        'UPDATE tasks SET completed = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
        [completed ? 1 : 0, completedAt, new Date().toISOString(), taskId]
      );
      
      // Update state
      dispatch({
        type: ACTIONS.COMPLETE_TASK,
        payload: { id: taskId, completed, completedAt },
      });
      
      return true;
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to update task' });
      return false;
    }
  }, []);
  
  // Set filter
  const setFilter = useCallback((filter) => {
    dispatch({ type: ACTIONS.SET_FILTER, payload: filter });
  }, []);
  
  // Set sort
  const setSort = useCallback((sort) => {
    dispatch({ type: ACTIONS.SET_SORT, payload: sort });
  }, []);
  
  // Get filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    // Apply filter
    let result = state.tasks;
    
    if (state.filter === 'active') {
      result = result.filter(task => !task.completed);
    } else if (state.filter === 'completed') {
      result = result.filter(task => task.completed);
    }
    
    // Apply sort
    if (state.sort === 'date') {
      result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (state.sort === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      result = [...result].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (state.sort === 'alphabetical') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    
    return result;
  }, [state.tasks, state.filter, state.sort]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isLoading: state.isLoading,
    error: state.error,
    tasks: state.tasks,
    filteredTasks,
    filter: state.filter,
    sort: state.sort,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    setFilter,
    setSort,
    refresh: loadTasks,
  }), [
    state.isLoading,
    state.error,
    state.tasks,
    filteredTasks,
    state.filter,
    state.sort,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    setFilter,
    setSort,
  ]);
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

// Custom hook for using the task context
export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};

// Export action types for testing
export const TASK_ACTIONS = ACTIONS; 