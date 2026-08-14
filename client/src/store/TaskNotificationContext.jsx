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

    // Auto-broadcast local mock database on startup to sync server/other tabs
    try {
      const savedDb = localStorage.getItem('mockDatabase_v4');
      if (savedDb && localStorage.getItem('enableMockSync') === 'true') {
        window.fetch('/api/mock-sync/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'SYNC_DATABASE', database: JSON.parse(savedDb) })
        }).catch(() => {});
      }
    } catch (e) {}

    // Cross-browser SSE sync (via relay)
    try {
      let reconnectDelay = 3000;
      let connectionOpen = false;

      function connectSSE() {
        if (localStorage.getItem('enableMockSync') !== 'true') return;
        
        if (window.__backendOffline) {
          // If backend is known offline, delay the reconnect retry check
          const nextDelay = reconnectDelay;
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          setTimeout(connectSSE, nextDelay);
          return;
        }

        if (window._mockSseConnection) {
          window._mockSseConnection.close();
        }
        
        const eventSource = new EventSource('/api/mock-sync/stream');
        window._mockSseConnection = eventSource;
        
        eventSource.onopen = () => {
          console.log('🟢 [SSE] Connected to mock-sync stream!');
          connectionOpen = true;
          reconnectDelay = 3000; // Reset delay on success
          window.__backendOffline = false;
        };
        
        eventSource.onerror = (err) => {
          if (connectionOpen) {
            console.warn('🔴 [SSE] Connection lost. Reconnecting...', err);
            connectionOpen = false;
          }
          eventSource.close();
          window.__backendOffline = true;
          
          const nextDelay = reconnectDelay;
          // Double the delay up to a max of 30 seconds
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          
          // Clear backend offline status after delay to allow retry
          setTimeout(() => {
            window.__backendOffline = false;
          }, nextDelay);
          
          setTimeout(connectSSE, nextDelay);
        };
        
        eventSource.onmessage = (event) => {
          if (event.data) {
            try {
              const data = JSON.parse(event.data);
              console.log('📡 [SSE] Received event:', data.type);
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
                
                // Show temporary visual indicator that a sync happened
                const toast = document.createElement('div');
                toast.innerText = '🔄 Live Data Synced from other browser';
                toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:8px 16px;border-radius:20px;font-size:12px;z-index:9999;box-shadow:0 4px 6px rgba(0,0,0,0.1);transition:opacity 0.5s;';
                document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
              }
            } catch (err) {}
          }
        };
      }
      
      connectSSE();
    } catch (e) {
      console.log('Mock SSE sync disabled or failed', e);
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
