import React, { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import styles from './ApiIntegrationPage.module.css';

const AVAILABLE_PERMISSIONS = [
  'Leads Read', 'Leads Write',
  'Customers Read', 'Customers Write',
  'Projects Read', 'Projects Write',
  'Invoices Read', 'Invoices Write',
  'Payments Read', 'Tasks Read'
];

export default function ApiIntegrationPage() {
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });

  const [secretModal, setSecretModal] = useState({ isOpen: false, secret: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [keysRes, statsRes] = await Promise.all([
        api.get('/api/developer/keys', { withCredentials: true }),
        api.get('/api/developer/keys/dashboard', { withCredentials: true })
      ]);
      setApiKeys(keysRes.data.data);
      setStats(statsRes.data.data.stats);
      setRecentLogs(statsRes.data.data.recentLogs);
    } catch (error) {
      toast.error('Failed to load API data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (key = null) => {
    if (key) {
      setEditingKey(key);
      setFormData({
        name: key.name,
        description: key.description || '',
        permissions: key.permissions || []
      });
    } else {
      setEditingKey(null);
      setFormData({ name: '', description: '', permissions: [] });
    }
    setIsModalOpen(true);
  };

  const handlePermissionChange = (perm) => {
    setFormData(prev => {
      if (prev.permissions.includes(perm)) {
        return { ...prev, permissions: prev.permissions.filter(p => p !== perm) };
      } else {
        return { ...prev, permissions: [...prev.permissions, perm] };
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingKey) {
        await api.put(`/api/developer/keys/${editingKey.id}`, formData, { withCredentials: true });
        toast.success('API Key updated successfully');
      } else {
        const res = await api.post('/api/developer/keys', formData, { withCredentials: true });
        toast.success('API Key created successfully');
        setSecretModal({ isOpen: true, secret: res.data.data.rawSecret });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save API Key');
    }
  };

  const handleToggleStatus = async (key) => {
    const newStatus = key.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/api/developer/keys/${key.id}`, { status: newStatus }, { withCredentials: true });
      toast.success(`API Key ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRegenerate = async (id) => {
    if (!window.confirm('Are you sure? Any applications using this key will immediately stop working.')) return;
    try {
      const res = await api.post(`/api/developer/keys/${id}/regenerate`, {}, { withCredentials: true });
      toast.success('API Key regenerated successfully');
      setSecretModal({ isOpen: true, secret: res.data.data.rawSecret });
      fetchData();
    } catch (error) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/developer/keys/${id}`, { withCredentials: true });
      toast.success('API Key deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete key');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(secretModal.secret);
    toast.success('Copied to clipboard');
  };

  if (isLoading) return <div className={styles.container}>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>API Integration</h2>
        <p>Manage your API keys and monitor usage</p>
      </div>

      {stats && (
        <div className={styles.dashboardStats}>
          <div className={styles.statCard}>
            <h4>Total Requests</h4>
            <p className={styles.statValue}>{stats.total_requests || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h4>Successful</h4>
            <p className={`${styles.statValue} ${styles.successText}`}>{stats.successful_requests || 0}</p>
          </div>
          <div className={styles.statCard}>
            <h4>Failed</h4>
            <p className={`${styles.statValue} ${styles.errorText}`}>{stats.failed_requests || 0}</p>
          </div>
        </div>
      )}

      <div className={styles.topToolbar}>
        <button className={styles.newUserBtn} onClick={() => handleOpenModal()}>+ Create New API Key</button>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.tableControls}>
          <div className={styles.tableControlsLeft}>
            <button className={styles.exportBtn}>Export</button>
          </div>
          <div className={styles.tableControlsRight}>
            <div className={styles.searchInputWrapper}>
              <span className={styles.searchIcon}>⌕</span>
              <input type="text" placeholder="Search..." className={styles.searchInput} />
            </div>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Permissions</th>
              <th>Status</th>
              <th>Last Used</th>
              <th>Created</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No API keys found.</td></tr>
            ) : apiKeys.map(key => (
              <tr key={key.id}>
                <td><strong>{key.name || 'Unnamed Key'}</strong></td>
                <td>{key.description || '-'}</td>
                <td>
                  <span className={styles.permissionPill}>
                    {key.permissions ? key.permissions.length : 0} rules
                  </span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${key.status === 'active' ? styles.success : styles.error}`}>
                    {key.status || 'unknown'}
                  </span>
                </td>
                <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}</td>
                <td>{new Date(key.created_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.options}>
                    <button className={styles.editBtn} onClick={() => handleOpenModal(key)} title="Edit Key">
                      <span role="img" aria-label="edit">✎</span>
                    </button>
                    <button className={styles.editBtn} onClick={() => handleToggleStatus(key)} title={key.status === 'active' ? 'Disable Key' : 'Enable Key'}>
                      <span role="img" aria-label="toggle status">{key.status === 'active' ? '⏸' : '▶'}</span>
                    </button>
                    <button className={styles.editBtn} onClick={() => handleRegenerate(key.id)} title="Regenerate Key">
                      <span role="img" aria-label="regenerate">🔄</span>
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(key.id)} title="Delete Key">
                      <span role="img" aria-label="delete" style={{color: 'white'}}>🗑</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.tableFooter}>
          <div className={styles.tableInfo}>
            Showing 1 to {apiKeys.length} of {apiKeys.length} entries
          </div>
          <div className={styles.pagination}>
            <button className={styles.pageBtn}>Previous</button>
            <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
            <button className={styles.pageBtn}>Next</button>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Recent Usage Logs</h3>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Key Name</th>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No recent activity.</td></tr>
            ) : recentLogs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.key_name || 'Deleted Key'}</td>
                <td>{log.method}</td>
                <td>{log.endpoint}</td>
                <td>
                  <span className={`${styles.statusBadge} ${log.status_code >= 400 ? styles.error : styles.success}`}>
                    {log.status_code}
                  </span>
                </td>
                <td>{log.execution_time_ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{editingKey ? 'Edit API Key' : 'Create API Key'}</h3>
            <form onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label>Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Zapier Integration" />
              </div>
              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description..." />
              </div>
              <div className={styles.formGroup}>
                <label>Permissions</label>
                <div className={styles.permissionsGrid}>
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm} className={styles.permissionCheckbox}>
                      <input 
                        type="checkbox" 
                        checked={formData.permissions.includes(perm)}
                        onChange={() => handlePermissionChange(perm)}
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {secretModal.isOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Your API Key Secret</h3>
            <div className={styles.warningBox}>
              <strong>Important:</strong> Please copy this secret key now. You will not be able to see it again after closing this window.
            </div>
            <div className={styles.secretBox}>
              {secretModal.secret}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={copyToClipboard}>Copy to Clipboard</button>
              <button className={styles.primaryBtn} onClick={() => setSecretModal({ isOpen: false, secret: '' })}>I have copied it</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
