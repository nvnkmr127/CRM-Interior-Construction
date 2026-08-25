import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './SuperAdminSettings.module.css';
import { useConfirm } from '../../store/confirmContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Button, Input, Badge, Card, Modal, PageHeader, Toggle, Select } from '../../components/ui';

export default function SuperAdminSettings() {
  usePageTitle('Super Admin command Center');
  useBreadcrumbs([
    { label: 'Settings', to: '/settings' },
    { label: 'Super Admin command Center' }
  ]);

  const { confirm } = useConfirm();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New tenant form state
  const [newTenant, setNewTenant] = useState({
    name: '',
    slug: '',
    plan: 'starter',
    max_users: 10,
    adminEmail: '',
    adminName: '',
    adminPassword: ''
  });

  // Editing tenant settings state
  const [editingTenant, setEditingTenant] = useState(null);
  const [settings, setSettings] = useState({
    name: '',
    plan: '',
    max_users: 10,
    mfa_required_all: false,
    session_timeout_minutes: 120,
    concurrent_login_limit: 3,
    password_min_length: 8,
    password_require_symbols: true,
    password_require_numbers: true,
    password_expiry_days: 0,
    password_prevent_reuse: 0,
    allowed_ips: '',
    allowed_countries: ''
  });

  useEffect(() => {
    fetchLicenseStats();
    fetchTenants();
  }, []);

  const fetchLicenseStats = () => {
    api.get('/superadmin/license')
      .then(res => setStats(res.data?.data))
      .catch(err => console.error('Failed to fetch stats:', err));
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/tenants');
      if (res.data?.success) {
        setTenants(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalReset = async () => {
    if (await confirm("CRITICAL WARNING: This will force ALL users in the organization to reset their passwords on next login. Proceed?")) {
      try {
        await api.post('/superadmin/global-password-reset');
        toast.success("Global password reset initiated.");
      } catch (err) {
        toast.error("Failed to initiate global reset.");
      }
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug || !newTenant.adminEmail || !newTenant.adminName || !newTenant.adminPassword) {
      toast.error("Please fill in all workspace details.");
      return;
    }

    try {
      const res = await api.post('/superadmin/tenants', newTenant);
      if (res.data?.success) {
        toast.success(`Successfully provisioned workspace "${newTenant.name}"`);
        setNewTenant({ name: '', slug: '', plan: 'starter', max_users: 10, adminEmail: '', adminName: '', adminPassword: '' });
        fetchTenants();
        setIsProvisionOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create workspace.");
    }
  };

  const handleToggleStatus = async (tenant) => {
    const action = tenant.is_active ? 'deactivate' : 'activate';
    if (await confirm(`Are you sure you want to ${action} workspace "${tenant.name}"?`)) {
      try {
        const res = await api.patch(`/superadmin/tenants/${tenant.id}/status`, { is_active: !tenant.is_active });
        if (res.data?.success) {
          toast.success(`Successfully ${action}d "${tenant.name}"`);
          fetchTenants();
        }
      } catch (err) {
        toast.error("Failed to toggle status.");
      }
    }
  };

  const handleEditSettings = (tenant) => {
    setEditingTenant(tenant);
    setSettings({
      name: tenant.name || '',
      plan: tenant.plan || 'starter',
      max_users: tenant.max_users || 10,
      mfa_required_all: tenant.mfa_required_all || false,
      session_timeout_minutes: tenant.session_timeout_minutes || 120,
      concurrent_login_limit: tenant.concurrent_login_limit || 3,
      password_min_length: tenant.password_min_length || 8,
      password_require_symbols: tenant.password_require_symbols !== undefined ? tenant.password_require_symbols : true,
      password_require_numbers: tenant.password_require_numbers !== undefined ? tenant.password_require_numbers : true,
      password_expiry_days: tenant.password_expiry_days || 0,
      password_prevent_reuse: tenant.password_prevent_reuse || 0,
      allowed_ips: Array.isArray(tenant.allowed_ips) ? tenant.allowed_ips.join(', ') : tenant.allowed_ips || '',
      allowed_countries: Array.isArray(tenant.allowed_countries) ? tenant.allowed_countries.join(', ') : tenant.allowed_countries || ''
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const formattedSettings = {
        ...settings,
        allowed_ips: settings.allowed_ips ? settings.allowed_ips.split(',').map(ip => ip.trim()) : [],
        allowed_countries: settings.allowed_countries ? settings.allowed_countries.split(',').map(c => c.trim().toUpperCase()) : []
      };

      const res = await api.put(`/superadmin/tenants/${editingTenant.id}/settings`, formattedSettings);
      if (res.data?.success) {
        toast.success("Settings updated successfully!");
        setEditingTenant(null);
        fetchTenants();
      }
    } catch (err) {
      toast.error("Failed to save settings.");
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeatPercentage = () => {
    if (!stats?.license_seats || !stats?.active_users) return 0;
    const pct = Math.round((stats.active_users / stats.license_seats) * 100);
    return Math.min(pct, 100);
  };

  const pct = getSeatPercentage();
  const progressColor = pct > 90 ? 'var(--color-danger)' : pct > 75 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Super Admin Command Center" 
        description="Organization-wide workspace provisioning, license optimization, and access controls." 
      />

      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--color-text)' }}>Active Workspaces</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Search workspaces..." 
                  className={styles.searchInput}
                  style={{ width: '260px', height: '38px', boxSizing: 'border-box' }}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Button 
                  variant="primary" 
                  onClick={() => setIsProvisionOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '38px', padding: '0 16px' }}
                >
                  🚀 Provision Workspace
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setIsSecurityOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '38px', padding: '0 16px' }}
                >
                  🔒 Emergency Security
                </Button>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading workspaces...</div>
            ) : filteredTenants.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                {searchQuery ? 'No workspaces match your search.' : 'No workspaces configured.'}
              </div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Organization Name</th>
                      <th className={styles.th}>Slug</th>
                      <th className={styles.th}>Plan</th>
                      <th className={styles.th}>Users</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map(tenant => (
                      <tr key={tenant.id} className={styles.tr}>
                        <td 
                          className={styles.td} 
                          style={{ fontWeight: '600', color: 'var(--color-accent)', cursor: 'pointer' }}
                          onClick={() => handleEditSettings(tenant)}
                        >
                          {tenant.name}
                        </td>
                        <td className={styles.td} style={{ color: 'var(--color-text-secondary)' }}>{tenant.slug}</td>
                        <td className={styles.td}>
                          <Badge variant="neutral" size="sm">
                            {tenant.plan || 'Starter'}
                          </Badge>
                        </td>
                        <td className={styles.td} style={{ fontWeight: '500' }}>{tenant.user_count || 0}</td>
                        <td className={styles.td}>
                          <Badge variant={tenant.is_active ? 'success' : 'danger'} size="sm" dot={true}>
                            {tenant.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className={styles.td} style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Button 
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditSettings(tenant)}
                              style={{ height: '30px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                            >
                              Configure
                            </Button>
                            <Button 
                              variant={tenant.is_active ? 'danger' : 'success'}
                              size="sm"
                              onClick={() => handleToggleStatus(tenant)}
                              style={{ height: '30px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                            >
                              {tenant.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Render settings editor when editing */}
          {editingTenant && (
            <Modal 
              isOpen={!!editingTenant} 
              onClose={() => setEditingTenant(null)} 
              title={`Configure "${editingTenant.name}"`}
              size="md"
            >
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)', margin: '4px 0 0 0' }}>Workspace Identity</h3>
                  <Input 
                    label="Organization Name"
                    type="text" 
                    value={settings.name} 
                    onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))} 
                    required
                  />
                  <div className={styles.formRow}>
                    <Select 
                      label="Billing Plan"
                      value={settings.plan}
                      onChange={val => setSettings(prev => ({ ...prev, plan: val }))}
                      options={[
                        { value: 'starter', label: 'Starter' },
                        { value: 'growth', label: 'Growth' },
                        { value: 'enterprise', label: 'Enterprise' }
                      ]}
                      required
                    />
                    <Input 
                      label="Max User Limit"
                      type="number" 
                      value={settings.max_users} 
                      onChange={e => setSettings(prev => ({ ...prev, max_users: Number(e.target.value) }))} 
                      required
                    />
                  </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)', margin: '0' }}>Security Policies</h3>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabelGroup}>
                    <span className={styles.toggleLabel}>Require MFA for all users</span>
                    <span className={styles.toggleDesc}>Mandate multi-factor authentication setup for this workspace</span>
                  </div>
                  <Toggle 
                    checked={settings.mfa_required_all} 
                    onChange={e => setSettings(prev => ({ ...prev, mfa_required_all: e.target.checked }))} 
                  />
                </div>

                <div className={styles.toggleRow}>
                  <div className={styles.toggleLabelGroup}>
                    <span className={styles.toggleLabel}>Enforce Numbers & Symbols</span>
                    <span className={styles.toggleDesc}>Require complex characters in password policy</span>
                  </div>
                  <Toggle 
                    checked={settings.password_require_symbols && settings.password_require_numbers} 
                    onChange={e => setSettings(prev => ({ 
                      ...prev, 
                      password_require_symbols: e.target.checked,
                      password_require_numbers: e.target.checked
                    }))} 
                  />
                </div>

                <div className={styles.formRow}>
                  <Input 
                    label="Session Timeout (minutes)"
                    type="number" 
                    value={settings.session_timeout_minutes} 
                    onChange={e => setSettings(prev => ({ ...prev, session_timeout_minutes: Number(e.target.value) }))} 
                  />
                  <Input 
                    label="Concurrent Login Limit"
                    type="number" 
                    value={settings.concurrent_login_limit} 
                    onChange={e => setSettings(prev => ({ ...prev, concurrent_login_limit: Number(e.target.value) }))} 
                  />
                </div>

                <div className={styles.formRow}>
                  <Input 
                    label="Min Password Length"
                    type="number" 
                    value={settings.password_min_length} 
                    onChange={e => setSettings(prev => ({ ...prev, password_min_length: Number(e.target.value) }))} 
                  />
                  <Input 
                    label="Password Expiry (days)"
                    type="number" 
                    placeholder="0 to disable"
                    value={settings.password_expiry_days} 
                    onChange={e => setSettings(prev => ({ ...prev, password_expiry_days: Number(e.target.value) }))} 
                  />
                </div>

                <div className={styles.formRow}>
                  <Input 
                    label="Prevent Password Reuse (count)"
                    type="number" 
                    placeholder="0 to disable"
                    value={settings.password_prevent_reuse} 
                    onChange={e => setSettings(prev => ({ ...prev, password_prevent_reuse: Number(e.target.value) }))} 
                  />
                  <div />
                </div>

                <Input 
                  label="Allowed IPs (comma separated)"
                  type="text" 
                  placeholder="e.g. 192.168.1.1, 10.0.0.1" 
                  value={settings.allowed_ips} 
                  onChange={e => setSettings(prev => ({ ...prev, allowed_ips: e.target.value }))} 
                />

                <Input 
                  label="Allowed Countries (comma separated ISO codes)"
                  type="text" 
                  placeholder="e.g. US, IN, GB" 
                  value={settings.allowed_countries} 
                  onChange={e => setSettings(prev => ({ ...prev, allowed_countries: e.target.value }))} 
                />

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button 
                    variant="secondary"
                    onClick={() => setEditingTenant(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary"
                  >
                    Save Settings
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      </div>

      {/* PROVISION WORKSPACE MODAL */}
      <Modal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        title="Register New Client Workspace"
        size="md"
      >
        <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Input 
            label="Workspace Organization Name"
            type="text" 
            placeholder="e.g. Design Studio A" 
            value={newTenant.name} 
            onChange={e => setNewTenant(prev => ({ ...prev, name: e.target.value }))} 
            required
          />

          <Input 
            label="Workspace Slug (URL / Login Handle)"
            type="text" 
            placeholder="e.g. design-studio-a" 
            value={newTenant.slug} 
            onChange={e => setNewTenant(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} 
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select 
              label="Billing Plan"
              value={newTenant.plan}
              onChange={val => setNewTenant(prev => ({ ...prev, plan: val }))}
              options={[
                { value: 'starter', label: 'Starter' },
                { value: 'growth', label: 'Growth' },
                { value: 'enterprise', label: 'Enterprise' }
              ]}
              required
            />
            <Input 
              label="Max User Limit"
              type="number" 
              value={newTenant.max_users} 
              onChange={e => setNewTenant(prev => ({ ...prev, max_users: Number(e.target.value) }))} 
              required
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />

          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)' }}>Admin User Account Setup</h3>

          <Input 
            label="Administrator Full Name"
            type="text" 
            placeholder="e.g. Sarah Jenkins" 
            value={newTenant.adminName} 
            onChange={e => setNewTenant(prev => ({ ...prev, adminName: e.target.value }))} 
            required
          />

          <Input 
            label="Administrator Email Address"
            type="email" 
            placeholder="e.g. admin@designstudioa.com" 
            value={newTenant.adminEmail} 
            onChange={e => setNewTenant(prev => ({ ...prev, adminEmail: e.target.value }))} 
            required
            autoComplete="username"
          />

          <Input 
            label="Administrator Password"
            type="password" 
            placeholder="Minimum 8 characters" 
            value={newTenant.adminPassword} 
            onChange={e => setNewTenant(prev => ({ ...prev, adminPassword: e.target.value }))} 
            required
            autoComplete="new-password"
          />

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => setIsProvisionOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary"
            >
              Provision Workspace Environment
            </Button>
          </div>
        </form>
      </Modal>

      {/* EMERGENCY SECURITY MODAL */}
      <Modal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        title="Emergency Security & License Control"
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* LICENSE SECTION */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Total Seats</div>
              <div className={styles.statValue}>{stats?.license_seats || '--'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Active Users</div>
              <div className={styles.statValue}>{stats?.active_users || '--'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTitle}>Seat Utilization</div>
              <div className={styles.statValue} style={{ color: progressColor }}>
                {pct}%
              </div>
              <div className={styles.utilizationContainer}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${pct}%`, backgroundColor: progressColor }}
                  />
                </div>
                <div className={styles.progressLabel}>
                  <span>{stats?.active_users || 0} used</span>
                  <span>{stats?.license_seats || 0} total</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECURITY SECTION */}
          <div className={styles.dangerAlert}>
            <h2 className={styles.dangerTitle}>Critical Security Actions</h2>
            <p className={styles.dangerDesc}>These actions are highly destructive, immediately log out active users, and will be logged to the immutable audit trail.</p>
            <Button 
              onClick={handleGlobalReset}
              variant="danger"
              style={{ marginTop: '16px' }}
            >
              Trigger Global Password Reset
            </Button>
          </div>

          {/* INTEGRATION SECTION */}
          <Card padding="lg">
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: 'var(--color-text)' }}>SSO & SAML Configuration</h2>
            <p style={{ marginBottom: '20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Configure external identity providers (Okta, Azure Active Directory, Google Workspace) to enforce unified login rules.</p>
            <Button 
              onClick={async () => toast.info('SSO setup portal opening...')}
              variant="primary"
            >
              Configure IdP Setup
            </Button>
          </Card>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button 
              variant="secondary"
              onClick={() => setIsSecurityOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
