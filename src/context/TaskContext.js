/**
 * TaskContext
 * 
 * Provides global state management for tasks using Context API
 * Handles interactions with TaskDAO for database operations
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import TaskDAO from '../dao/TaskDAO';

// Create the context
const TaskContext = createContext(null);

// Custom hook for using the task context
export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

// Provider component
export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [tomorrowTasks, setTomorrowTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        
        // Load tasks and tomorrow tasks
        const allTasks = await TaskDAO.getAllTasks();
        const tomorrow = await TaskDAO.getTomorrowTasks();
        
        setTasks(allTasks);
        setTomorrowTasks(tomorrow);
        setError(null);
      } catch (err) {
        console.error('Failed to load tasks:', err);
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  // Create a new task
  const addTask = useCallback(async (task) => {
    try {
      const createdTask = await TaskDAO.createTask(task);
      setTasks(prevTasks => [...prevTasks, createdTask]);
      return createdTask;
    } catch (err) {
      console.error('Failed to add task:', err);
      setError('Failed to add task');
      throw err;
    }
  }, []);

  // Update an existing task
  const updateTask = useCallback(async (id, updates) => {
    try {
      const updatedTask = await TaskDAO.updateTask(id, updates);
      setTasks(prevTasks => 
        prevTasks.map(task => task.id === id ? updatedTask : task)
      );
      return updatedTask;
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
      throw err;
    }
  }, []);

  // Toggle task completion status
  const toggleTaskCompletion = useCallback(async (id) => {
    try {
      const task = tasks.find(t => t.id === id);
      if (!task) throw new Error(`Task with ID ${id} not found`);
      
      const updates = {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null
      };
      
      const updatedTask = await TaskDAO.updateTask(id, updates);
      
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === id ? updatedTask : t)
      );
      
      return updatedTask;
    } catch (err) {
      console.error('Failed to toggle task completion:', err);
      setError('Failed to update task');
      throw err;
    }
  }, [tasks]);

  // Delete a task
  const deleteTask = useCallback(async (id) => {
    try {
      const success = await TaskDAO.deleteTask(id);
      if (success) {
        setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
      throw err;
    }
  }, []);

  // Add task to tomorrow's tasks
  const addTaskToTomorrow = useCallback(async (taskId) => {
    try {
      const success = await TaskDAO.addTaskToTomorrow(taskId);
      if (success) {
        // Refresh tomorrow tasks
        const tomorrow = await TaskDAO.getTomorrowTasks();
        setTomorrowTasks(tomorrow);
      }
      return success;
    } catch (err) {
      console.error('Failed to add task to tomorrow:', err);
      setError('Failed to update tomorrow tasks');
      throw err;
    }
  }, []);

  // Remove task from tomorrow's tasks
  const removeTaskFromTomorrow = useCallback(async (taskId) => {
    try {
      const success = await TaskDAO.removeTaskFromTomorrow(taskId);
      if (success) {
        setTomorrowTasks(prev => prev.filter(t => t.id !== taskId));
      }
      return success;
    } catch (err) {
      console.error('Failed to remove task from tomorrow:', err);
      setError('Failed to update tomorrow tasks');
      throw err;
    }
  }, []);

  // Update tomorrow tasks order
  const updateTomorrowTasksOrder = useCallback(async (taskIds) => {
    try {
      const success = await TaskDAO.updateTomorrowTasksOrder(taskIds);
      if (success) {
        // Refresh tomorrow tasks with new order
        const tomorrow = await TaskDAO.getTomorrowTasks();
        setTomorrowTasks(tomorrow);
      }
      return success;
    } catch (err) {
      console.error('Failed to update tomorrow tasks order:', err);
      setError('Failed to update tomorrow tasks order');
      throw err;
    }
  }, []);

  // Get task statistics
  const getTaskStats = useCallback(async () => {
    try {
      return await TaskDAO.getTaskStats();
    } catch (err) {
      console.error('Failed to get task statistics:', err);
      setError('Failed to load task statistics');
      throw err;
    }
  }, []);

  // Refresh all tasks
  const refreshTasks = useCallback(async () => {
    try {
      setLoading(true);
      const allTasks = await TaskDAO.getAllTasks();
      const tomorrow = await TaskDAO.getTomorrowTasks();
      
      setTasks(allTasks);
      setTomorrowTasks(tomorrow);
      setError(null);
    } catch (err) {
      console.error('Failed to refresh tasks:', err);
      setError('Failed to refresh tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create context value
  const value = {
    tasks,
    tomorrowTasks,
    loading,
    error,
    addTask,
    updateTask,
    toggleTaskCompletion,
    deleteTask,
    addTaskToTomorrow,
    removeTaskFromTomorrow,
    updateTomorrowTasksOrder,
    getTaskStats,
    refreshTasks
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

export default TaskContext; 