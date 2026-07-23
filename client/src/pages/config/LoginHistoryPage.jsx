import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './AuditTrail.module.css'; // Reusing AuditTrail styles as they are identical data tables
import { Button, Input, Select, DataTable } from '../../components/ui';
import Badge from "../../components/ui/Badge"; // Assuming Badge exists

export default function LoginHistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const toast = useToast();

  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const res = await api.get('/login-history', { params });
      setLogs(res.data?.data || []);
      setPagination(prev => ({ ...prev, total: res.data?.meta?.total || 0 }));
    } catch (err) {
      toast.error('Failed to load login history.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) params.append(key, filters[key]);
      });
      
      const response = await api.get(`/login-history/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'login-history.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleRevoke = async (sessionId) => {
    if (!window.confirm('Are you sure you want to revoke this active session? The user will be immediately logged out.')) return;
    try {
      await api.delete(`/login-history/sessions/${sessionId}`);
      toast.success('Session revoked successfully');
      fetchLogs();
    } catch (err) {
      toast.error('Failed to revoke session');
    }
  };

  const columns = [
    {
      key: 'login_time',
      label: 'Login Time',
      render: (log) => new Date(log.login_time).toLocaleString()
    },
    {
      key: 'duration',
      label: 'Logout / Duration',
      render: (log) => {
        if (!log.logout_time) {
          if (log.active_session_id) return <span style={{ color: 'var(--color-success)' }}>Active Session</span>;
          return <span style={{ color: 'var(--color-text-secondary)' }}>Expired</span>;
        }
        return (
          <div>
            <div>{new Date(log.logout_time).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Duration: {log.duration_seconds ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s` : '< 1s'}
            </div>
          </div>
        );
      }
    },
    {
      key: 'user',
      label: 'User Attempted',
      render: (log) => (
        <div>
          <div style={{ fontWeight: 500 }}>{log.user_name || 'Unknown User'}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{log.email_attempted}</div>
        </div>
      )
    },
    {
      key: 'ip',
      label: 'IP & Location',
      render: (log) => (
        <div>
          <div>{log.ip_address || '-'}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{log.location || 'Unknown'}</div>
        </div>
      )
    },
    {
      key: 'device',
      label: 'Device & OS',
      render: (log) => (
        <div>
          <div>{log.device} - {log.os}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{log.browser}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (log) => {
        if (log.status === 'success') return <Badge variant="success">Success</Badge>;
        if (log.status?.startsWith('success_mfa')) return <Badge variant="warning">MFA Pending</Badge>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Badge variant="danger">Failed</Badge>
            <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{log.failure_reason}</span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (log) => {
        if (log.status === 'success' && !log.logout_time && log.active_session_id) {
          return (
            <Button variant="danger" size="small" onClick={() => handleRevoke(log.active_session_id)}>
              Revoke Session
            </Button>
          );
        }
        return '-';
      }
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Login History</h2>
          <p className={styles.subtitle}>Track authentication attempts, active sessions, and devices.</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
      </div>

      <div className={styles.filters} style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <Input 
          type="text" 
          label="Search" 
          placeholder="Search emails, IPs, devices..." 
          value={filters.search} 
          onChange={(e) => handleFilterChange('search', e.target.value)} 
          style={{ minWidth: '300px' }}
        />
        <Select 
          label="Status" 
          value={filters.status} 
          onChange={(v) => handleFilterChange('status', v)}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'success', label: 'Successful Logins' },
            { value: 'failure', label: 'Failed Attempts' },
            { value: 'success_mfa_pending', label: 'MFA Pending' }
          ]}
        />
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading history...</div>
        ) : (
          <DataTable columns={columns} data={logs} />
        )}
        
        {/* Pagination Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Showing {logs.length} of {pagination.total} records
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button 
              variant="secondary" 
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button 
              variant="secondary"
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
