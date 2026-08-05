import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTaskGovernanceStore = create(
  persist(
    (set, get) => ({
      role: 'admin',
      permissions: {
        canEdit: true,
        canDelete: true,
        canConfig: true,
      },
      webhooks: [],
      retentionDays: 'indefinite',
      syncQueue: [],
      auditLogs: {}, // Local store for audit logs indexed by taskId
      isOffline: !navigator.onLine,

      setRole: (role) => set({ 
        role,
        permissions: {
          canEdit: ['admin', 'manager', 'contributor'].includes(role),
          canDelete: ['admin', 'manager'].includes(role),
          canConfig: ['admin'].includes(role)
        }
      }),
      setWebhooks: (webhooks) => set({ webhooks }),
      setRetentionDays: (retentionDays) => set({ retentionDays }),
      setSyncQueue: (queue) => set({ syncQueue: queue }),
      setIsOffline: (isOffline) => set({ isOffline }),

      pushToSyncQueue: (action, payload, isOffline) => {
        if (isOffline) {
          const entry = { id: Date.now(), action, payload, timestamp: new Date().toISOString() };
          set((state) => ({ syncQueue: [...state.syncQueue, entry] }));
          return true;
        }
        return false;
      },

      clearSyncQueue: () => set({ syncQueue: [] }),

      logAuditActivity: (taskId, action, oldVal, newVal, user = 'Current User') => {
        const { retentionDays, webhooks } = get();
        
        set((state) => {
          const currentLogs = state.auditLogs[taskId] || [];
          const newLog = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            user,
            action,
            oldVal,
            newVal
          };
          
          let updatedLogs = [...currentLogs, newLog];

          if (retentionDays !== 'indefinite') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - parseInt(retentionDays, 10));
            updatedLogs = updatedLogs.filter(log => new Date(log.timestamp) >= cutoff);
          }
          
          return {
            auditLogs: {
              ...state.auditLogs,
              [taskId]: updatedLogs
            }
          };
        });

        // Trigger webhooks (mock)
        // webhooks.forEach(hook => { ... })
      },

      getAuditLogs: (taskId) => {
        const { auditLogs } = get();
        return (auditLogs[taskId] || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
    }),
    {
      name: 'task-governance-storage'
    }
  )
);

// We still need a small React wrapper to handle the offline/online event listeners if we want it global
// Or we can just use an init function similar to automation
export function initGovernanceListeners() {
  // One-time migration from old Context-based localStorage keys
  try {
    const oldRole = localStorage.getItem('gov_role');
    if (oldRole) {
      useTaskGovernanceStore.getState().setRole(oldRole);
      localStorage.removeItem('gov_role');
    }
    const oldWebhooks = localStorage.getItem('gov_webhooks');
    if (oldWebhooks) {
      useTaskGovernanceStore.getState().setWebhooks(JSON.parse(oldWebhooks));
      localStorage.removeItem('gov_webhooks');
    }
    const oldRetention = localStorage.getItem('gov_retention');
    if (oldRetention) {
      useTaskGovernanceStore.getState().setRetentionDays(oldRetention);
      localStorage.removeItem('gov_retention');
    }
    const oldLogs = localStorage.getItem('gov_audit_logs');
    if (oldLogs) {
      useTaskGovernanceStore.setState({ auditLogs: JSON.parse(oldLogs) });
      localStorage.removeItem('gov_audit_logs');
    }
  } catch (e) {
    // ignore parse errors
  }

  const handleOnline = () => {
    useTaskGovernanceStore.getState().setIsOffline(false);
    const queue = useTaskGovernanceStore.getState().syncQueue;
    if (queue.length > 0) {
      setTimeout(() => {
        useTaskGovernanceStore.getState().clearSyncQueue();
        window.dispatchEvent(new CustomEvent('globalTimeLogged'));
      }, 1500);
    }
  };

  const handleOffline = () => {
    useTaskGovernanceStore.getState().setIsOffline(true);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}
