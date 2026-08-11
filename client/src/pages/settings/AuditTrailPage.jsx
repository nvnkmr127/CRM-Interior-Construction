/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { Button, PermissionButton, Pagination, Spinner, EmptyState } from '../../components/ui';
import styles from './AuditTrailPage.module.css';

function DiffViewer({ oldValue, newValue }) {
  let oldObj = {};
  let newObj = {};
  try {
    oldObj = typeof oldValue === 'string' ? JSON.parse(oldValue) : (oldValue || {});
  } catch (e) {
    oldObj = oldValue ? { value: oldValue } : {};
  }
  try {
    newObj = typeof newValue === 'string' ? JSON.parse(newValue) : (newValue || {});
  } catch (e) {
    newObj = newValue ? { value: newValue } : {};
  }

  // Get union of keys
  const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  
  if (keys.length === 0) {
    return <span className="text-gray-400 italic">No detailed changes recorded</span>;
  }

  return (
    <div className="space-y-2 text-xs font-mono max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-150">
      {keys.map(key => {
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal);
        const newStr = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal);

        if (oldVal !== undefined && newVal === undefined) {
          // Deleted property
          return (
            <div key={key} className="bg-red-50/50 text-red-700 p-2 rounded-lg border border-red-100 flex flex-col gap-0.5">
              <span className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">{key}</span>
              <span className="line-through">{oldStr}</span>
            </div>
          );
        } else if (oldVal === undefined && newVal !== undefined) {
          // Added property
          return (
            <div key={key} className="bg-green-50/50 text-green-700 p-2 rounded-lg border border-green-100 flex flex-col gap-0.5">
              <span className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">{key}</span>
              <span>{newStr}</span>
            </div>
          );
        } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          // Changed property
          return (
            <div key={key} className="bg-yellow-50/50 text-yellow-800 p-2 rounded-lg border border-yellow-100 flex flex-col gap-1">
              <span className="font-semibold text-gray-700 text-[10px] uppercase tracking-wider">{key}</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="line-through text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[11px]">{oldStr}</span>
                <span className="text-gray-400 font-bold">→</span>
                <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium text-[11px]">{newStr}</span>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // View states
  const [view, setView] = useState('table'); // 'table' | 'feed'
  const [autoRefresh, setAutoRefresh] = useState('off'); // 'off' | '30s' | '1m'

  // Filter states
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const limit = 20;

  // Selected log for Modal Inspector
  const [selectedLog, setSelectedLog] = useState(null);

  const toast = useToast();

  useEffect(() => {
    fetchFiltersData();
  }, []);

  // Search input debouncer (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [page, projectId, userId, leadId, entity, action, debouncedSearch, startDate, endDate]);

  // Auto Refresh Polling Hook
  useEffect(() => {
    if (autoRefresh === 'off') return;
    const intervalTime = autoRefresh === '30s' ? 30000 : 60000;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, intervalTime);
    return () => clearInterval(interval);
  }, [autoRefresh, page, projectId, userId, leadId, entity, action, debouncedSearch, startDate, endDate]);

  const fetchFiltersData = async () => {
    try {
      const [projRes, usersRes, leadsRes] = await Promise.all([
        api.get('/projects?limit=100').catch(() => null),
        api.get('/users?limit=100').catch(() => null),
        api.get('/leads?limit=100').catch(() => null)
      ]);
      if (projRes?.data?.success) setProjects(projRes.data.data);
      if (usersRes?.data?.success) setUsers(usersRes.data.data);
      if (leadsRes?.data?.success) setLeads(leadsRes.data.data);
    } catch (err) {
      console.error('Failed to load filters data', err);
    }
  };

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        page,
        limit,
        offset: (page - 1) * limit,
        projectId: projectId || undefined,
        userId: userId || undefined,
        leadId: leadId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        search: debouncedSearch || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        // Set the end date boundary to the very end of the day (23:59:59.999)
        endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString() : undefined
      };
      
      const res = await api.get('/events', { params });
      if (res.data?.success) {
        setLogs(res.data.data);
        setTotal(res.data.meta?.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load audit logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        export: 'csv',
        projectId: projectId || undefined,
        userId: userId || undefined,
        leadId: leadId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        search: debouncedSearch || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString() : undefined
      };

      const res = await api.get('/events', { params, responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Audit trail exported successfully!');
    } catch (err) {
      toast.error('Failed to export audit logs.');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setProjectId('');
    setUserId('');
    setLeadId('');
    setEntity('');
    setAction('');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Interactive quick filter helpers
  const handleQuickFilterUser = (id) => {
    if (!id) return;
    setUserId(id);
    setPage(1);
    toast.info('Filtered by user account');
  };

  const handleQuickFilterEntity = (ent) => {
    if (!ent) return;
    setEntity(ent);
    setPage(1);
    toast.info(`Filtered by entity type: ${ent}`);
  };

  const handleQuickFilterAction = (act) => {
    if (!act) return;
    setAction(act);
    setPage(1);
    toast.info(`Filtered by action: ${act}`);
  };

  const handleQuickFilterIP = (ip) => {
    if (!ip) return;
    setSearch(ip);
    setPage(1);
    toast.info(`Searching for IP: ${ip}`);
  };

  const copyToClipboard = (text, msg) => {
    navigator.clipboard.writeText(text);
    toast.success(msg || 'Copied to clipboard!');
  };

  const getEntityBadge = (ent) => {
    const base = 'px-2.5 py-1 text-xs font-semibold rounded-full ';
    switch (ent) {
      case 'project':
        return base + 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'lead':
        return base + 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'task':
        return base + 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'document':
        return base + 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'payment_milestone':
        return base + 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
      case 'service_ticket':
        return base + 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
      case 'role':
        return base + 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'financial_approval':
        return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'user':
        return base + 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
      case 'stage':
        return base + 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
      case 'custom_field':
        return base + 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'template':
        return base + 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400';
      case 'qc_checklist':
        return base + 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400';
      case 'automation':
        return base + 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400';
      case 'organization':
        return base + 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
      case 'api_key':
        return base + 'bg-rose-150 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300';
      case 'email_template':
        return base + 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400';
      case 'warehouse':
        return base + 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return base + 'bg-gray-100 text-gray-800 dark:bg-gray-850 dark:text-gray-300';
    }
  };

  const getActionBadgeColor = (action) => {
    const act = action?.toLowerCase();
    if (act?.includes('create')) return 'border-green-200 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30';
    if (act?.includes('delete') || act?.includes('failed')) return 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
    if (act?.includes('edit') || act?.includes('update') || act?.includes('approve') || act?.includes('reject') || act?.includes('comment')) {
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
    }
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
  };

  const getTimelineEmoji = (action) => {
    const act = action?.toLowerCase();
    if (act?.includes('create')) return '➕';
    if (act?.includes('delete')) return '❌';
    if (act?.includes('edit') || act?.includes('update')) return '📝';
    if (act?.includes('approve')) return '✅';
    if (act?.includes('reject')) return '🚫';
    if (act?.includes('comment')) return '💬';
    if (act?.includes('login')) return '🔑';
    if (act?.includes('logout')) return '🚪';
    if (act?.includes('failed')) return '⚠️';
    return '⚡';
  };

  // Group logs by day for feed view
  const groupLogsByDate = (logsList) => {
    const groups = {};
    logsList.forEach(log => {
      const date = new Date(log.created_at);
      const dayStr = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dayStr]) {
        groups[dayStr] = [];
      }
      groups[dayStr].push(log);
    });
    return Object.entries(groups);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Stats Card data
  const activeUsersCount = new Set(logs.map(l => l.user_id).filter(Boolean)).size;
  const criticalActionsCount = logs.filter(l => ['Deleted', 'Approved', 'Rejected', 'Failed Login'].includes(l.action)).length;
  const latestActivityLog = logs[0] ? `${logs[0].action} (${logs[0].entity})` : 'None';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>System Audit Trail</h1>
          <p className={styles.subtitle}>Monitor administrative activities, state changes, and authentication logs.</p>
        </div>
        <div className={styles.actions}>
          {/* View Toggle */}
          <div className={styles.viewToggle}>
            <button
              onClick={() => setView('table')}
              className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
              title="Table view"
            >
              📊 Table
            </button>
            <button
              onClick={() => setView('feed')}
              className={`${styles.viewBtn} ${view === 'feed' ? styles.viewBtnActive : ''}`}
              title="Timeline feed"
            >
              🕒 Timeline
            </button>
          </div>

          {/* Auto Refresh */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Poll:</span>
            <select
              value={autoRefresh}
              onChange={e => setAutoRefresh(e.target.value)}
              className="rounded-lg border border-gray-300 text-xs p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="off">Off</option>
              <option value="30s">30s</option>
              <option value="1m">1m</option>
            </select>
          </div>

          <PermissionButton
            module="settings"
            action="export_csv"
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
            variant="outline"
            className="flex items-center gap-2 border-gray-250 hover:bg-gray-50 font-semibold"
          >
            {exporting ? 'Exporting...' : '↑ Export to CSV'}
          </PermissionButton>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Match Logs</span>
            <span className={styles.statValue}>{total}</span>
          </div>
          <div className={`${styles.statIcon} bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400`}>📜</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Contributors</span>
            <span className={styles.statValue}>{activeUsersCount}</span>
          </div>
          <div className={`${styles.statIcon} bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400`}>👥</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Critical Changes</span>
            <span className={styles.statValue}>{criticalActionsCount}</span>
          </div>
          <div className={`${styles.statIcon} bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400`}>🛡️</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Latest Action</span>
            <span className={styles.statValue} title={latestActivityLog}>{latestActivityLog}</span>
          </div>
          <div className={`${styles.statIcon} bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400`}>⚡</div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={styles.filterBar}>
        <div className={styles.filterHeader}>
          <h2 className={styles.filterTitle}>Search & Filter System</h2>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search actions, IPs, browsers, users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
        
        <div className={styles.filterGrid}>
          {/* Project */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Project</label>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Lead */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Lead</label>
            <select
              value={leadId}
              onChange={e => { setLeadId(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Leads</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* User */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>User</label>
            <select
              value={userId}
              onChange={e => { setUserId(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Entity */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Entity Type</label>
            <select
              value={entity}
              onChange={e => { setEntity(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Entities</option>
              <option value="project">Project</option>
              <option value="lead">Lead</option>
              <option value="task">Task</option>
              <option value="document">Document</option>
              <option value="payment_milestone">Payment Milestone</option>
              <option value="service_ticket">Service Ticket</option>
              <option value="warranty">Warranty</option>
              <option value="amc">AMC</option>
              <option value="role">Role</option>
              <option value="financial_approval">Financial Approval</option>
              <option value="user">User Account</option>
              <option value="stage">Lead Stage</option>
              <option value="custom_field">Custom Field</option>
              <option value="template">Document Template</option>
              <option value="qc_checklist">QC Checklist</option>
              <option value="automation">Automation Rule</option>
              <option value="organization">Organization Details</option>
              <option value="api_key">API Key</option>
              <option value="email_template">Email Template</option>
              <option value="warehouse">Warehouse/Factory</option>
            </select>
          </div>

          {/* Action */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Action</label>
            <select
              value={action}
              onChange={e => { setAction(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Actions</option>
              <option value="Created">Created</option>
              <option value="Edited">Edited/Updated</option>
              <option value="Deleted">Deleted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Commented">Commented</option>
              <option value="Assigned">Assigned</option>
              <option value="Reassigned">Reassigned</option>
              <option value="Exported">Exported</option>
              <option value="Reopened">Reopened</option>
              <option value="Login">Login</option>
              <option value="Logout">Logout</option>
              <option value="Failed Login">Failed Login</option>
            </select>
          </div>

          {/* Start Date */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className={styles.filterInput}
            />
          </div>

          {/* End Date */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className={styles.filterInput}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={resetFilters} className={styles.clearBtn}>
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={styles.content}>
        {loading && logs.length === 0 ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-250 flex items-center justify-center p-20">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500 font-semibold">Loading audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-250 flex items-center justify-center">
            <EmptyState
              title="No Logs Found"
              description="No audit logs matched your current search parameters."
              actionLabel="Clear Filters"
              onAction={resetFilters}
            />
          </div>
        ) : view === 'table' ? (
          /* Table View Layout */
          <div className={styles.tableWrapper}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Timestamp</th>
                    <th className={styles.th}>User Account</th>
                    <th className={styles.th}>Entity</th>
                    <th className={styles.th}>Action</th>
                    <th className={styles.th}>IP Address</th>
                    <th className={styles.th}>Browser & Device</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {logs.map(log => (
                    <tr key={log.id} className={styles.tr}>
                      <td className={styles.td} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className={styles.td}>
                        <div
                          className={`${styles.clickableItem} flex flex-col`}
                          onClick={() => handleQuickFilterUser(log.user_id)}
                          title="Click to filter by user"
                        >
                          <span className="font-semibold">{log.user_name || 'System'}</span>
                          {log.user_email && <span className="text-xs text-gray-400">{log.user_email}</span>}
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span
                          className={`${getEntityBadge(log.entity)} ${styles.clickableItem}`}
                          onClick={() => handleQuickFilterEntity(log.entity)}
                          title="Click to filter by entity type"
                        >
                          {log.entity}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span
                          onClick={() => handleQuickFilterAction(log.action)}
                          className={`${styles.actionBadge} ${getActionBadgeColor(log.action)} ${styles.clickableItem}`}
                          title="Click to filter by action"
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className={styles.td} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        <span
                          onClick={() => handleQuickFilterIP(log.ip_address)}
                          className={styles.clickableItem}
                          title="Click to search IP"
                        >
                          {log.ip_address || '—'}
                        </span>
                      </td>
                      <td className={styles.td} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        <div className="flex flex-col">
                          <span>{log.browser || 'Unknown Browser'}</span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase">{log.device || 'Unknown Device'}</span>
                        </div>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          Inspect Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className={styles.paginationFooter}>
              <div>
                Showing <b>{logs.length}</b> rows out of <b>{total}</b> entries
              </div>
              <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={limit}
                onPageChange={setPage}
              />
            </div>
          </div>
        ) : (
          /* Timeline Feed View Layout */
          <div className={styles.tableWrapper}>
            <div className={styles.timeline}>
              {groupLogsByDate(logs).map(([dateStr, logsGroup]) => (
                <div key={dateStr} className={styles.timelineGroup}>
                  <div className={styles.timelineGroupTitle}>
                    📅 {dateStr}
                  </div>
                  {logsGroup.map(log => (
                    <div key={log.id} className={styles.timelineItem}>
                      <div className={styles.timelineLine} />
                      <div className={styles.timelineIcon} title={log.action}>
                        {getTimelineEmoji(log.action)}
                      </div>
                      
                      <div className={styles.timelineCard}>
                        <div className={styles.timelineHeader}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`${styles.timelineUser} ${styles.clickableItem}`}
                              onClick={() => handleQuickFilterUser(log.user_id)}
                              title="Click to filter by user"
                            >
                              {log.user_name || 'System'}
                            </span>
                            <span className="text-gray-400 text-xs">performed</span>
                            <span
                              onClick={() => handleQuickFilterAction(log.action)}
                              className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${getActionBadgeColor(log.action)} ${styles.clickableItem}`}
                              title="Click to filter by action"
                            >
                              {log.action}
                            </span>
                            <span className="text-gray-400 text-xs">on</span>
                            <span
                              onClick={() => handleQuickFilterEntity(log.entity)}
                              className={`${getEntityBadge(log.entity)} ${styles.clickableItem}`}
                              title="Click to filter by entity"
                            >
                              {log.entity}
                            </span>
                            {log.entity_id && (
                              <span className="text-xs font-semibold text-gray-500 font-mono">
                                (ID: {log.entity_id})
                              </span>
                            )}
                          </div>
                          
                          <span className={styles.timelineTime}>
                            🕒 {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {log.reason && (
                          <div className="bg-amber-50/50 border border-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md mt-1 italic">
                            Reason: {log.reason}
                          </div>
                        )}

                        <div className={styles.timelineMeta}>
                          <div className={styles.timelineMetaItem}>
                            🌐 IP: <span
                              onClick={() => handleQuickFilterIP(log.ip_address)}
                              className={`${styles.clickableItem} font-mono`}
                              title="Filter by IP"
                            >
                              {log.ip_address || 'N/A'}
                            </span>
                          </div>
                          <div className={styles.timelineMetaItem}>
                            💻 Device: <span className="font-semibold">{log.device || 'Unknown'}</span>
                          </div>
                          <div className={styles.timelineMetaItem}>
                            🧭 Location: <span className="font-semibold uppercase text-rose-600">{log.location || 'Unknown'}</span>
                          </div>
                          {log.browser && (
                            <div className={styles.timelineMetaItem}>
                              🌐 Client: <span className="text-gray-400 font-medium">{log.browser.substring(0, 35)}{log.browser.length > 35 && '...'}</span>
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="ml-auto text-xs font-semibold text-accent hover:text-accent-dark hover:underline transition-colors"
                          >
                            Inspect Changes →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pagination Footer for Timeline view */}
            <div className={styles.paginationFooter}>
              <div>
                Showing <b>{logs.length}</b> rows out of <b>{total}</b> entries
              </div>
              <Pagination
                currentPage={page}
                totalItems={total}
                itemsPerPage={limit}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-150 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Inspect Log Entry Details</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-gray-500 font-mono">ID: {selectedLog.id}</span>
                  <button
                    onClick={() => copyToClipboard(selectedLog.id, 'Log ID copied!')}
                    className="text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 px-1 py-0.5 rounded"
                  >
                    Copy ID
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div className={styles.modalGrid}>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Timestamp</span>
                  <span className={styles.modalValue}>{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>User / Email</span>
                  <span className={styles.modalValue}>
                    {selectedLog.user_name || 'System'}{' '}
                    <span className="text-xs text-gray-400">({selectedLog.user_email || 'No email'})</span>
                  </span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Entity ID / Target</span>
                  <span className={`${styles.modalValue} font-mono`}>
                    {selectedLog.entity} (ID: {selectedLog.entity_id || 'N/A'})
                  </span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Action Type</span>
                  <span className={`${styles.modalValue} font-semibold text-accent-dark`}>{selectedLog.action}</span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>IP Address</span>
                  <span className={styles.modalValueMono}>{selectedLog.ip_address || '—'}</span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Browser / Device</span>
                  <span className={styles.modalValue} style={{ fontSize: '12px' }}>
                    {selectedLog.device || 'Unknown'} - {selectedLog.browser || 'Unknown'}
                  </span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Location Country</span>
                  <span className={`${styles.modalValue} uppercase text-rose-600 font-semibold`}>
                    📍 {selectedLog.location || 'Unknown'}
                  </span>
                </div>
                <div className={styles.modalBlock}>
                  <span className={styles.modalLabel}>Reason Provided</span>
                  <span className={styles.modalValue} style={{ fontStyle: 'italic' }}>
                    {selectedLog.reason || 'No reason specified'}
                  </span>
                </div>
              </div>

              <div className="h-px bg-gray-150"></div>

              <div>
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Delta Diff Visualizer
                </span>
                <DiffViewer oldValue={selectedLog.old_value} newValue={selectedLog.new_value} />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 rounded-b-2xl flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), 'Detailed log copied!')}
                className="px-4"
              >
                Copy Full Log JSON
              </Button>
              <Button onClick={() => setSelectedLog(null)} className="px-5 bg-accent hover:bg-accent-dark">
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
