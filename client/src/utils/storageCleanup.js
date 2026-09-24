import { useTaskAutomationStore } from '../store/useTaskAutomationStore';
import { useTaskGovernanceStore } from '../store/useTaskGovernanceStore';

export const TENANT_STORAGE_KEYS = [
  'task-automation-storage',
  'task-governance-storage',
  'myTasksActiveTimer',
  'gov_role',
  'gov_webhooks',
  'gov_retention',
  'gov_sync_queue',
  'gov_audit_logs',
  'crm_saved_views',
  'crm_filters',
  'crm_local_prefs',
  'myTaskAutomations',
  'myTaskAutomationLogs',
  'mock_team_credentials',
  'mockSession',
  'mockDatabase_v4'
];

/**
 * Resets local stores and wipes tenant-specific localStorage keys so data never leaks across workspaces.
 */
export const clearTenantClientStorage = () => {
  TENANT_STORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore storage access errors
    }
  });

  try {
    if (useTaskAutomationStore?.setState) {
      useTaskAutomationStore.setState({ rules: [], logs: [] });
    }
  } catch (e) {}

  try {
    if (useTaskGovernanceStore?.setState) {
      useTaskGovernanceStore.setState({
        role: 'admin',
        webhooks: [],
        retentionDays: 'indefinite',
        syncQueue: [],
        auditLogs: {}
      });
    }
  } catch (e) {}
};
