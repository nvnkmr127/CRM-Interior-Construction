import { create } from 'zustand';
import { useToastStore } from './toastContext';

export const useTaskNotificationStore = create((set) => ({
  notifications: [],

  init: () => {
    const filterByRole = (notifs) => {
      const activeSession = localStorage.getItem('mockSession');
      let isSales = false;
      if (activeSession) {
        try {
          const session = JSON.parse(activeSession);
          isSales = session?.role?.id === 'sales_rep' || session?.role?.name?.toLowerCase().includes('sales');
        } catch(e) {}
      }
      return notifs.filter(n => !n.targetRole || (n.targetRole === 'sales_rep' && isSales));
    };

    const saved = localStorage.getItem('myTaskNotifications');
    if (saved) {
      try {
        const parsed = filterByRole(JSON.parse(saved));
        set({ notifications: parsed });
        
        const unread = parsed.filter(n => !n.isRead);
        if (unread.length > 0) {
          const latest = unread[0];
          setTimeout(() => {
            useToastStore.getState().show('info', `🔔 ${latest.title}: ${latest.message}`, 4000);
          }, 800);
        }
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }

    const syncNotifications = () => {
      const current = localStorage.getItem('myTaskNotifications');
      if (current) {
        try {
          const parsed = filterByRole(JSON.parse(current));
          set(state => {
            const oldIds = (state.notifications || []).map(n => n.id);
            const newNotifications = parsed.filter(n => !oldIds.includes(n.id) && !n.isRead);
            
            if (newNotifications.length > 0) {
              const latest = newNotifications[0];
              useToastStore.getState().show('info', `🔔 ${latest.title}: ${latest.message}`, 4000);
            }
            return { notifications: parsed };
          });
        } catch (err) {}
      } else {
        set({ notifications: [] });
      }
    };

    // Listen to storage changes to keep tabs synchronized
    const handleStorage = (e) => {
      if (!e.key || e.key === 'myTaskNotifications') {
        syncNotifications();
      }
    };
    window.addEventListener('storage', handleStorage);

    // BroadcastChannel sync for instant messaging across tabs
    try {
      const bc = new BroadcastChannel('crm_notifications');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'SYNC_NOTIFICATIONS') {
          syncNotifications();
        }
      };
      // Save reference on store to prevent garbage collection or to reuse
      window._notificationChannel = bc;
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    // Cross-browser SSE sync (via relay)
    try {
      // Close existing connection if HMR triggers a reload
      if (window._mockSseConnection) {
        window._mockSseConnection.close();
      }
      
      const eventSource = new EventSource('/api/mock-sync/stream');
      window._mockSseConnection = eventSource;
      
      eventSource.onmessage = (event) => {
          if (event.data) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'SYNC_NOTIFICATIONS' && data.notification) {
                // If it's for Sales, inject it into localStorage if we are Sales!
                const activeSession = localStorage.getItem('mockSession');
                let isSales = false;
                if (activeSession) {
                  try {
                    const session = JSON.parse(activeSession);
                    isSales = session?.role?.id === 'sales_rep' || session?.role?.name?.toLowerCase().includes('sales');
                  } catch(e) {}
                }
                
                if (!data.notification.targetRole || (data.notification.targetRole === 'sales_rep' && isSales)) {
                   const saved = localStorage.getItem('myTaskNotifications') || '[]';
                   const notifications = JSON.parse(saved);
                   if (!notifications.find(n => n.id === data.notification.id)) {
                     notifications.unshift(data.notification);
                     localStorage.setItem('myTaskNotifications', JSON.stringify(notifications));
                     syncNotifications();
                   }
                }
              } else if (data.type === 'SYNC_DATABASE' && data.database) {
                // Keep the browser's mock database perfectly in sync!
                localStorage.setItem('mockDatabase_v4', JSON.stringify(data.database));
                window.dispatchEvent(new Event('app:mock-db-change'));
              }
            } catch (err) {}
          }
        };
    } catch (e) {
      console.warn('SSE EventSource failed', e);
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
    
    // Broadcast notification sync to other tabs
    try {
      const bc = new BroadcastChannel('crm_notifications');
      bc.postMessage({ type: 'SYNC_NOTIFICATIONS' });
      bc.close();
    } catch (e) {}

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

// Re-initialize when auth changes (e.g., login/logout within same browser instance)
window.addEventListener('app:auth-change', () => {
  useTaskNotificationStore.getState().init();
});

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
