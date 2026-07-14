import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './toastContext';

const TaskNotificationContext = createContext(null);

export function TaskNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const toast = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('myTaskNotifications');
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('myTaskNotifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (type, title, message, taskId) => {
    const newNotif = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type, // 'assigned', 'mentioned', 'commented', 'due_soon', 'overdue', 'status_changed'
      title,
      message,
      taskId,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    
    setNotifications(prev => [newNotif, ...prev]);
    
    // Check if the user wants Push/In-App (Mocking it via toast for in-app)
    toast.info(`🔔 ${title}: ${message}`);
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };
  
  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <TaskNotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll
    }}>
      {children}
    </TaskNotificationContext.Provider>
  );
}

export const useTaskNotifications = () => useContext(TaskNotificationContext);
