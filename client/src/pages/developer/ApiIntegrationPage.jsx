import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [tokens, setTokens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });

  const [secretModal, setSecretModal] = useState({ isOpen: false, secret: '' });
  
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [keysRes, statsRes] = await Promise.all([
        api.get('/api/developer/tokens', { withCredentials: true }),
        api.get('/api/developer/tokens/dashboard', { withCredentials: true })
      ]);
      setTokens(keysRes.data.data);
      setStats(statsRes.data.data.stats);
      setRecentLogs(statsRes.data.data.recentLogs);
    } catch (error) {
      toast.error('Failed to load API data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (token = null) => {
    if (token) {
      setEditingToken(token);
      setFormData({
        name: token.name,
        description: token.description || '',
        permissions: token.permissions || []
      });
    } else {
      setEditingToken(null);
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
      if (editingToken) {
        await api.put(`/api/developer/tokens/${editingToken.id}`, formData, { withCredentials: true });
        toast.success('API Token updated successfully');
      } else {
        const res = await api.post('/api/developer/tokens', formData, { withCredentials: true });
        toast.success('API Token created successfully');
        setSecretModal({ isOpen: true, secret: res.data.data.rawSecret });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save API Token');
    }
  };

  const handleToggleStatus = async (token) => {
    const newStatus = token.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/api/developer/tokens/${token.id}`, { status: newStatus }, { withCredentials: true });
      toast.success(`API Token ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRegenerate = async (id) => {
    if (!window.confirm('Are you sure? Any applications using this key will immediately stop working.')) return;
    try {
      const res = await api.post(`/api/developer/tokens/${id}/regenerate`, {}, { withCredentials: true });
      toast.success('API Token regenerated successfully');
      setSecretModal({ isOpen: true, secret: res.data.data.rawSecret });
      fetchData();
    } catch (error) {
      toast.error('Failed to regenerate key');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/developer/tokens/${id}`, { withCredentials: true });
      toast.success('API Token deleted successfully');
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
        <button className={styles.newUserBtn} onClick={() => handleOpenModal()}>+ New API Token</button>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.tableControls}>
          <div className={styles.tableControlsLeft}>
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <button className={styles.exportBtn} onClick={() => setExportMenuOpen(!exportMenuOpen)}>
                Export ▼
              </button>
              {exportMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4,
                  background: 'white', border: '1px solid #e5e7eb',
                  borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10, minWidth: 150, overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} onClick={() => {
                    setExportMenuOpen(false);
                    const headers = ['Name', 'Description', 'Permissions', 'Status', 'Last Used', 'Created'];
                    const rows = tokens.map(token => [
                      token.name || 'Unnamed Token',
                      token.description || '-',
                      (token.permissions || []).join(' | '),
                      token.is_active ? 'Active' : 'Revoked',
                      token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never',
                      new Date(token.created_at).toLocaleDateString()
                    ]);
                    const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "api_tokens_export.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}>Export as CSV</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} onClick={() => {
                    setExportMenuOpen(false);
                    const headers = ['Name', 'Description', 'Permissions', 'Status', 'Last Used', 'Created'];
                    const rows = tokens.map(token => [
                      token.name || 'Unnamed Token',
                      token.description || '-',
                      (token.permissions || []).join(' | '),
                      token.is_active ? 'Active' : 'Revoked',
                      token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never',
                      new Date(token.created_at).toLocaleDateString()
                    ]);
                    const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "api_tokens_export.xlsx");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}>Export as Excel</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} onClick={() => { 
                    setExportMenuOpen(false); 
                    const headers = ['Name', 'Description', 'Permissions', 'Status', 'Last Used', 'Created'];
                    const rows = tokens.map(token => [
                      token.name || 'Unnamed Token',
                      token.description || '-',
                      (token.permissions || []).join(', '),
                      token.is_active ? 'Active' : 'Revoked',
                      token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never',
                      new Date(token.created_at).toLocaleDateString()
                    ]);
                    const doc = new jsPDF();
                    doc.text("API Tokens Export", 14, 15);
                    autoTable(doc, {
                      head: [headers],
                      body: rows,
                      startY: 20,
                    });
                    doc.save('api_tokens_export.pdf');
                  }}>Export as PDF</div>
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }}></div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }} onClick={() => { setExportMenuOpen(false); window.print(); }}>Print Table</div>
                </div>
              )}
            </div>
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
            {tokens.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No API tokens found.</td></tr>
            ) : tokens.map(token => (
              <tr key={token.id}>
                <td><strong>{token.name || 'Unnamed Token'}</strong></td>
                <td>{token.description || '-'}</td>
                <td>
                  <span className={styles.permissionPill}>
                    {token.permissions ? token.permissions.length : 0} rules
                  </span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${token.status === 'active' ? styles.success : styles.error}`}>
                    {token.status || 'unknown'}
                  </span>
                </td>
                <td>{token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never'}</td>
                <td>{new Date(token.created_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.options}>
                    <button className={styles.editBtn} onClick={() => handleOpenModal(token)} title="Edit Token">
                      <span role="img" aria-label="edit">✎</span>
                    </button>
                    <button className={styles.editBtn} onClick={() => handleToggleStatus(token)} title={token.status === 'active' ? 'Disable Token' : 'Enable Token'}>
                      <span role="img" aria-label="toggle status">{token.status === 'active' ? '⏸' : '▶'}</span>
                    </button>
                    <button className={styles.editBtn} onClick={() => handleRegenerate(token.id)} title="Regenerate Token">
                      <span role="img" aria-label="regenerate">🔄</span>
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(token.id)} title="Delete Token">
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
            Showing 1 to {tokens.length} of {tokens.length} entries
          </div>
          <div className={styles.pagination}>
            <button className={styles.pageBtn}>Previous</button>
            <button className={`${styles.pageBtn} ${styles.pageBtnActive}`}>1</button>
            <button className={styles.pageBtn}>Next</button>
          </div>
        </div>
      </div>

      <div className={`${styles.tableContainer} ${styles.noPrint}`} style={{ marginTop: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Recent Usage Logs</h3>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Token Name</th>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {(!recentLogs || recentLogs.length === 0) ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No recent activity.</td></tr>
            ) : recentLogs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.key_name || 'Deleted Token'}</td>
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
            <h3>{editingToken ? 'Edit API Token' : 'Create API Token'}</h3>
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
            <h3>Your API Token Secret</h3>
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
