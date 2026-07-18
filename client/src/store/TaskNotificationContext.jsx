import { create } from 'zustand';
import { useToastStore } from './toastContext';

export const useTaskNotificationStore = create((set) => ({
  notifications: [],
  
  init: () => {
    const saved = localStorage.getItem('myTaskNotifications');
    if (saved) {
      try {
        set({ notifications: JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
  },

  addNotification: (type, title, message, taskId) => {
    const newNotif = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      type,
      title,
      message,
      taskId,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    
    set(state => {
      const updated = [newNotif, ...state.notifications];
      localStorage.setItem('myTaskNotifications', JSON.stringify(updated));
      return { notifications: updated };
    });
    
    // Trigger toast using the store directly
    useToastStore.getState().show('info', `🔔 ${title}: ${message}`, 4000);
  },

  markAsRead: (id) => {
    set(state => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
      localStorage.setItem('myTaskNotifications', JSON.stringify(updated));
      return { notifications: updated };
    });
  },

  markAllAsRead: () => {
    set(state => {
      const updated = state.notifications.map(n => ({ ...n, isRead: true }));
      localStorage.setItem('myTaskNotifications', JSON.stringify(updated));
      return { notifications: updated };
    });
  },
  
  clearAll: () => {
    set({ notifications: [] });
    localStorage.removeItem('myTaskNotifications');
  }
}));

// Initialize on load
useTaskNotificationStore.getState().init();

export const useTaskNotifications = () => {
  const store = useTaskNotificationStore();
  const unreadCount = store.notifications.filter(n => !n.isRead).length;

  return {
    notifications: store.notifications,
    unreadCount,
    addNotification: store.addNotification,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    clearAll: store.clearAll
  };
};
