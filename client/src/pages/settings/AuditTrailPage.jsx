import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { Button } from '../../components/ui';

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
    return <span className="text-gray-400 italic">No details recorded</span>;
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Filter states
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
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

  useEffect(() => {
    fetchLogs();
  }, [page, projectId, userId, entity, action, startDate, endDate]);

  const fetchFiltersData = async () => {
    try {
      const [projRes, usersRes] = await Promise.all([
        api.get('/projects?limit=100'),
        api.get('/users?limit=100')
      ]);
      if (projRes.data?.success) setProjects(projRes.data.data);
      if (usersRes.data?.success) setUsers(usersRes.data.data);
    } catch (err) {
      console.error('Failed to load filters data', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        projectId: projectId || undefined,
        userId: userId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined
      };
      
      const res = await api.get('/events', { params });
      if (res.data?.success) {
        setLogs(res.data.data);
        setTotal(res.data.meta?.total || 0);
      }
    } catch (err) {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {
        export: 'csv',
        projectId: projectId || undefined,
        userId: userId || undefined,
        entity: entity || undefined,
        action: action || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined
      };

      const res = await api.get('/events', { params, responseType: 'blob' });
      
      // Download blob
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
    setEntity('');
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getEntityBadge = (ent) => {
    const base = 'px-2.5 py-1 text-xs font-semibold rounded-full ';
    switch (ent) {
      case 'project':
        return base + 'bg-blue-100 text-blue-800';
      case 'lead':
        return base + 'bg-orange-100 text-orange-800';
      case 'task':
        return base + 'bg-green-100 text-green-800';
      case 'document':
        return base + 'bg-purple-100 text-purple-800';
      case 'payment_milestone':
        return base + 'bg-teal-100 text-teal-800';
      case 'service_ticket':
        return base + 'bg-rose-100 text-rose-800';
      default:
        return base + 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">System Audit Trail</h1>
          <p className="mt-2 text-sm text-gray-500">Track and monitor security modifications, user actions, and status updates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExport}
            disabled={exporting || logs.length === 0}
            variant="outline"
            className="flex items-center gap-2 border-gray-250 hover:bg-gray-50 font-medium"
          >
            {exporting ? 'Exporting...' : 'Export to CSV'}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Search & Filter Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Project */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project</label>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* User */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User</label>
            <select
              value={userId}
              onChange={e => { setUserId(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Entity */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entity Type</label>
            <select
              value={entity}
              onChange={e => { setEntity(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </select>
          </div>

          {/* Action */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</label>
            <input
              type="text"
              placeholder="e.g. project.updated"
              value={action}
              onChange={e => { setAction(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 text-sm p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={resetFilters}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-500 font-medium">Fetching audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <p className="text-base font-semibold">No audit logs found</p>
            <p className="text-sm text-gray-400 mt-1">Try resetting filters or checking another date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-sm text-gray-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 whitespace-nowrap text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{log.user_name || 'System'}</span>
                        {log.user_email && <span className="text-xs text-gray-400">{log.user_email}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={getEntityBadge(log.entity)}>{log.entity}</span>
                    </td>
                    <td className="p-4">
                      <code className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded font-mono border border-gray-150">
                        {log.action}
                      </code>
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-mono">
                      {log.ip_address || '-'}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors hover:underline"
                      >
                        Inspect Diff
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div className="bg-gray-50/50 border-t border-gray-200 p-4 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-gray-500">
              <div>
                Showing <span className="font-medium text-gray-900">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-medium text-gray-900">
                  {Math.min(page * limit, total)}
                </span>{' '}
                of <span className="font-medium text-gray-900">{total}</span> entries
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1 px-2 font-medium text-gray-700">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
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
                <h3 className="text-lg font-bold text-gray-900">Inspect Log Entry</h3>
                <p className="text-xs text-gray-500 mt-1 font-mono">ID: {selectedLog.id}</p>
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Timestamp</span>
                  <span className="font-medium text-gray-800">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">User</span>
                  <span className="font-medium text-gray-800">{selectedLog.user_name || 'System'} ({selectedLog.user_email || 'No email'})</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Entity & ID</span>
                  <span className="font-medium text-gray-800">{selectedLog.entity} ({selectedLog.entity_id || 'N/A'})</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</span>
                  <span className="font-medium text-gray-800 font-mono text-xs">{selectedLog.action}</span>
                </div>
              </div>

              <div className="h-px bg-gray-150"></div>

              <div>
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Delta Diff Visualizer</span>
                <DiffViewer oldValue={selectedLog.old_value} newValue={selectedLog.new_value} />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 rounded-b-2xl flex justify-end">
              <Button onClick={() => setSelectedLog(null)} className="px-5">
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
