/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './AuditTrail.module.css';
import { Button, Input, Select, DataTable } from '../../components/ui';

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    user_id: '',
    entity: '',
    entity_id: '',
    search: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [users, setUsers] = useState([]);
  const toast = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load users');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const res = await api.get('/audit-logs', { params });
      setLogs(res.data?.data || []);
      setPagination(prev => ({ ...prev, total: res.data?.meta?.total || 0 }));
    } catch (err) {
      toast.error('Failed to load audit logs.');
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
      
      const response = await api.get(`/audit-logs/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit-logs.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Date/Time',
      render: (log) => new Date(log.created_at).toLocaleString()
    },
    {
      key: 'user',
      label: 'User',
      render: (log) => log.user_name || log.user_email || 'System'
    },
    {
      key: 'action',
      label: 'Action',
      render: (log) => log.action
    },
    {
      key: 'entity',
      label: 'Module',
      render: (log) => log.entity
    },
    {
      key: 'entity_id',
      label: 'Record ID',
      render: (log) => log.entity_id ? log.entity_id.substring(0, 8) + '...' : '-'
    },
    {
      key: 'details',
      label: 'Changes',
      render: (log) => (
        <details className={styles.changesDetails}>
          <summary>View Diff</summary>
          <div className={styles.diffContainer}>
            <div className={styles.oldValue}>
              <strong>Old:</strong> {log.old_value || 'None'}
            </div>
            <div className={styles.newValue}>
              <strong>New:</strong> {log.new_value || 'None'}
            </div>
          </div>
        </details>
      )
    },
    {
      key: 'ip',
      label: 'IP Address',
      render: (log) => log.ip_address || '-'
    },
    {
      key: 'device',
      label: 'Device & Browser',
      render: (log) => (log.browser || log.device) ? `${log.browser || ''} ${log.device || ''}`.trim() : '-'
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Audit Trail</h2>
          <p className={styles.subtitle}>View a comprehensive history of changes across the system.</p>
        </div>
        <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
      </div>

      <div className={styles.filters}>
        <Input 
          type="date" 
          label="From Date" 
          value={filters.date_from} 
          onChange={(e) => handleFilterChange('date_from', e.target.value)} 
        />
        <Input 
          type="date" 
          label="To Date" 
          value={filters.date_to} 
          onChange={(e) => handleFilterChange('date_to', e.target.value)} 
        />
        <Select 
          label="User" 
          value={filters.user_id} 
          onChange={(v) => handleFilterChange('user_id', v)}
          options={[
            { value: '', label: 'All Users' },
            ...users.map(u => ({ value: u.id, label: u.name || u.email }))
          ]}
        />
        <Select 
          label="Module" 
          value={filters.entity} 
          onChange={(v) => handleFilterChange('entity', v)}
          options={[
            { value: '', label: 'All Modules' },
            { value: 'project', label: 'Projects' },
            { value: 'task', label: 'Tasks' },
            { value: 'lead', label: 'Leads' },
            { value: 'invoice', label: 'Invoices' },
            { value: 'payment', label: 'Payments' }
          ]}
        />
        <Input 
          type="text" 
          label="Record ID" 
          placeholder="Filter by ID..." 
          value={filters.entity_id} 
          onChange={(e) => handleFilterChange('entity_id', e.target.value)} 
        />
        <Input 
          type="text" 
          label="Search" 
          placeholder="Search logs..." 
          value={filters.search} 
          onChange={(e) => handleFilterChange('search', e.target.value)} 
        />
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Loading audit logs...</div>
        ) : (
          <>
            <DataTable columns={columns} data={logs} />
            <div className={styles.pagination}>
              <Button 
                variant="ghost" 
                disabled={pagination.page <= 1} 
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <span>Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1}</span>
              <Button 
                variant="ghost" 
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)} 
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
