import { create } from 'zustand';
import { useToastStore } from './toastContext';

function getActiveTenantId() {
  try {
    const activeSession = localStorage.getItem('mockSession');
    if (activeSession) {
      const session = JSON.parse(activeSession);
      if (session?.tenant_id || session?.tenantId) {
        return session.tenant_id || session.tenantId;
      }
      if (session?.id) return session.id;
    }
  } catch (e) {}

  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === 'tenantId' || name === 'tenant_id') return val;
    }
  } catch (e) {}

  return 'current_workspace';
}

function getStorageKey() {
  const tid = getActiveTenantId();
  return `myTaskNotifications_${tid}`;
}

export const useTaskNotificationStore = create((set, get) => ({
  notifications: [],

  init: () => {
    // Clean up legacy unscoped global key to prevent cross-workspace notification bleed
    try {
      if (localStorage.getItem('myTaskNotifications')) {
        localStorage.removeItem('myTaskNotifications');
      }
    } catch (e) {}

    const filterByRoleAndTenant = (notifs) => {
      const activeSession = localStorage.getItem('mockSession');
      let isSales = false;
      let tenantId = getActiveTenantId();
      if (activeSession) {
        try {
          const session = JSON.parse(activeSession);
          isSales = session?.role?.id === 'sales_rep' || session?.role?.name?.toLowerCase().includes('sales');
          tenantId = session?.tenant_id || session?.tenantId || tenantId;
        } catch(e) {}
      }
      return (notifs || []).filter(n => {
        // If notification has a tenantId, it must match current workspace
        if (n.tenantId && n.tenantId !== tenantId) return false;
        // Filter targetRole
        return !n.targetRole || (n.targetRole === 'sales_rep' && isSales);
      });
    };

    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = filterByRoleAndTenant(JSON.parse(saved));
        set({ notifications: parsed });
        // NOTE: We do NOT trigger toast popups on init/refresh.
        // Unread notifications are visible in the notification badge/bell.
      } catch (e) {
        set({ notifications: [] });
      }
    } else {
      set({ notifications: [] });
    }

    const syncNotifications = () => {
      const storageKey = getStorageKey();
      const current = localStorage.getItem(storageKey);
      if (current) {
        try {
          const parsed = filterByRoleAndTenant(JSON.parse(current));
          set(state => {
            const oldIds = (state.notifications || []).map(n => n.id);
            const newNotifications = parsed.filter(n => !oldIds.includes(n.id) && !n.isRead);
            
            // Only toast if a genuinely new live notification arrived from another tab
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
      if (!e.key || e.key === getStorageKey()) {
        syncNotifications();
      }
    };
    window.addEventListener('storage', handleStorage);

    // BroadcastChannel sync for instant messaging across tabs
    try {
      if (!window._notificationChannel) {
        const bc = new BroadcastChannel('crm_notifications');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'SYNC_NOTIFICATIONS') {
            const currentTenant = getActiveTenantId();
            if (!event.data.tenantId || event.data.tenantId === currentTenant) {
              syncNotifications();
            }
          }
        };
        window._notificationChannel = bc;
      }
    } catch (e) {}
  },

  addNotification: (type, title, message, taskId, meta = {}) => {
    const currentTenant = getActiveTenantId();
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      message,
      taskId,
      tenantId: currentTenant,
      isRead: false,
      createdAt: new Date().toISOString(),
      ...meta
    };
    const key = getStorageKey();
    set(state => {
      const updated = [newNotif, ...state.notifications];
      localStorage.setItem(key, JSON.stringify(updated));
      return { notifications: updated };
    });
    
    // Broadcast notification sync to other tabs
    try {
      const bc = new BroadcastChannel('crm_notifications');
      bc.postMessage({ type: 'SYNC_NOTIFICATIONS', tenantId: currentTenant, notification: newNotif });
      bc.close();
    } catch (e) {}

    // Trigger toast only for this newly added live notification
    useToastStore.getState().show('info', `🔔 ${title}: ${message}`, 4000);
  },

  markAsRead: (id) => {
    const key = getStorageKey();
    set(state => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
      localStorage.setItem(key, JSON.stringify(updated));
      return { notifications: updated };
    });
  },

  markAllAsRead: () => {
    const key = getStorageKey();
    set(state => {
      const updated = state.notifications.map(n => ({ ...n, isRead: true }));
      localStorage.setItem(key, JSON.stringify(updated));
      return { notifications: updated };
    });
  },
  
  clearAll: () => {
    const key = getStorageKey();
    set({ notifications: [] });
    try {
      localStorage.removeItem(key);
      localStorage.removeItem('myTaskNotifications');
    } catch (e) {}
  }
}));

// Initialize on load
useTaskNotificationStore.getState().init();

// Re-initialize when auth changes (e.g., login/logout or workspace switch)
window.addEventListener('app:auth-change', () => {
  useTaskNotificationStore.getState().init();
});

window.addEventListener('app:logout', () => {
  useTaskNotificationStore.getState().clearAll();
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
