import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useAuth } from '../../store/authContext';
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
  const { user, refreshUser } = useAuth();

  const [stats, setStats] = useState(null);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showEditAdminPassword, setShowEditAdminPassword] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('workspaces');

  // Sidebar config states
  const [sidebarPlanConfigs, setSidebarPlanConfigs] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [planTabs, setPlanTabs] = useState([]);
  const [tabSearchQuery, setTabSearchQuery] = useState('');

  const PLAN_DEFAULTS = {
    starter: [
      'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar',
      'projects', 'tasks', 'reports', 'team-management', 'team-members', 'roles-permissions', 'organization'
    ],
    growth: [
      'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
      'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
      'analytics-delay', 'coordination', 'handover-dashboard', 'retention-dashboard', 'resource-capacity',
      'absences', 'vendor-performance', 'vendor-capacity', 'team-management', 'team-members',
      'roles-permissions', 'organization'
    ],
    enterprise: [
      'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
      'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
      'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload',
      'lead-stages', 'custom-fields', 'lead-forms', 'templates', 'trade-activities', 'qc-checklists',
      'conversion-checklist', 'automations', 'coordination', 'handover-dashboard', 'retention-dashboard',
      'resource-capacity', 'absences', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times',
      'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast',
      'financial-thresholds', 'team-management', 'team-members', 'roles-permissions', 'organization',
      'login-history', 'audit-trail', 'superadmin', 'api-keys', 'api-integration', 'webhooks',
      'email-templates', 'logs'
    ]
  };

  const AVAILABLE_TABS = [
    { id: 'dashboard', label: 'Dashboard', group: 'WORKSPACE' },
    { id: 'leads', label: 'Leads (Main Menu & List)', group: 'WORKSPACE' },
    { id: 'leads-dashboard', label: 'Leads: Dashboard', group: 'WORKSPACE', isSubItem: true },
    { id: 'leads-kanban', label: 'Leads: Kanban', group: 'WORKSPACE', isSubItem: true },
    { id: 'leads-calendar', label: 'Leads: Calendar', group: 'WORKSPACE', isSubItem: true },
    { id: 'leads-map', label: 'Leads: Map', group: 'WORKSPACE', isSubItem: true },
    { id: 'projects', label: 'Projects', group: 'WORKSPACE' },
    { id: 'tasks', label: 'My Tasks', group: 'WORKSPACE' },
    { id: 'reports', label: 'Reports Hub', group: 'WORKSPACE' },
    
    { id: 'analytics', label: 'Analytics (Main)', group: 'ANALYTICS' },
    { id: 'analytics-leads', label: 'Analytics: Lead Analytics', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-projects', label: 'Analytics: Project Analytics', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-csat', label: 'Analytics: Client Satisfaction', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-delay', label: 'Analytics: Delay Analysis', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-boq', label: 'Analytics: Budget Variance', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-resources', label: 'Analytics: Team Capacity', group: 'ANALYTICS', isSubItem: true },
    { id: 'analytics-resource-workload', label: 'Analytics: Team Workload', group: 'ANALYTICS', isSubItem: true },
    
    { id: 'lead-stages', label: 'Lead Stages', group: 'SALES SETUP' },
    { id: 'custom-fields', label: 'Custom Fields', group: 'SALES SETUP' },
    { id: 'lead-forms', label: 'Lead Forms', group: 'SALES SETUP' },
    
    { id: 'templates', label: 'Project Templates', group: 'PROJECT SETUP' },
    { id: 'trade-activities', label: 'Work Templates', group: 'PROJECT SETUP' },
    { id: 'qc-checklists', label: 'Quality Checklists', group: 'PROJECT SETUP' },
    { id: 'conversion-checklist', label: 'Conversion Checklist', group: 'PROJECT SETUP' },
    { id: 'automations', label: 'Automations', group: 'PROJECT SETUP' },
    
    { id: 'coordination', label: 'Project Coordination', group: 'PROJECT OPERATIONS' },
    { id: 'handover-dashboard', label: 'Handover Dashboard', group: 'PROJECT OPERATIONS' },
    { id: 'retention-dashboard', label: 'Client Retention', group: 'PROJECT OPERATIONS' },
    
    { id: 'resource-capacity', label: 'Team Capacity', group: 'RESOURCE OPERATIONS' },
    { id: 'absences', label: 'Leave Management', group: 'RESOURCE OPERATIONS' },
    
    { id: 'vendor-performance', label: 'Vendor Performance', group: 'VENDORS' },
    { id: 'vendor-capacity', label: 'Vendor Capacity', group: 'VENDORS' },
    { id: 'vendor-lead-times', label: 'Vendor Lead Times', group: 'VENDORS' },
    
    { id: 'finance-overview', label: 'Finance Overview', group: 'FINANCE' },
    { id: 'financial-approvals', label: 'Financial Approvals', group: 'FINANCE' },
    { id: 'analytics-profitability', label: 'Project Profitability', group: 'FINANCE', isSubItem: true },
    { id: 'analytics-collection-forecast', label: 'Collection Forecast', group: 'FINANCE', isSubItem: true },
    { id: 'financial-thresholds', label: 'Financial Thresholds', group: 'FINANCE' },
    
    { id: 'team-management', label: 'Team Management (Main Group)', group: 'TEAM & SECURITY' },
    { id: 'team-members', label: 'Team Members', group: 'TEAM & SECURITY', isSubItem: true },
    { id: 'roles-permissions', label: 'Roles & Permissions', group: 'TEAM & SECURITY', isSubItem: true },
    { id: 'organization', label: 'Organization', group: 'TEAM & SECURITY' },
    { id: 'login-history', label: 'Login History', group: 'TEAM & SECURITY' },
    { id: 'audit-trail', label: 'Audit Trail', group: 'TEAM & SECURITY' },
    
    { id: 'superadmin', label: 'Super Admin Center', group: 'DEVELOPER TOOLS' },
    { id: 'api-keys', label: 'API Keys', group: 'DEVELOPER TOOLS' },
    { id: 'api-integration', label: 'API Integration', group: 'DEVELOPER TOOLS' },
    { id: 'webhooks', label: 'Webhooks', group: 'DEVELOPER TOOLS' },
    { id: 'email-templates', label: 'Email Templates', group: 'DEVELOPER TOOLS' },
    { id: 'logs', label: 'Logs', group: 'DEVELOPER TOOLS' }
  ];

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
    admin_name: '',
    admin_email: '',
    admin_password: '',
    admin_user_id: null,
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

  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [companyForm, setCompanyForm] = useState({
    name: '',
    logo_url: '',
    accent_colour: '#4f46e5',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: ''
  });

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  useEffect(() => {
    if (selectedTenant) {
      const config = typeof selectedTenant.config === 'string' ? JSON.parse(selectedTenant.config || '{}') : (selectedTenant.config || {});
      setCompanyForm({
        name: selectedTenant.name || '',
        logo_url: config.logo_url || '',
        accent_colour: config.accent_colour || '#4f46e5',
        description: config.description || '',
        address: config.address || '',
        phone: config.phone || '',
        email: config.email || '',
        website: config.website || ''
      });
    }
  }, [selectedTenantId, tenants]);

  useEffect(() => {
    if (tenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [tenants, selectedTenantId]);

  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleSuperAdminLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTenantId) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const res = await api.post(`/superadmin/tenants/${selectedTenantId}/upload-logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setCompanyForm(prev => ({ ...prev, logo_url: res.data.data.logoUrl }));
        toast.success("Logo uploaded successfully!");
      }
    } catch (err) {
      toast.error("Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveCompanyDetails = async (e) => {
    e.preventDefault();
    if (!selectedTenantId) return;

    try {
      const res = await api.put(`/superadmin/tenants/${selectedTenantId}/settings`, {
        name: companyForm.name,
        logo_url: companyForm.logo_url,
        accent_colour: companyForm.accent_colour,
        description: companyForm.description,
        address: companyForm.address,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website
      });

      if (res.data?.success) {
        toast.success("Company branding details saved successfully!");
        fetchTenants(); // Reload tenants to sync local state
        window.dispatchEvent(new Event('app:tenant-updated'));
        window.dispatchEvent(new Event('app:sidebar-config-updated'));
        window.dispatchEvent(new Event('app:auth-change'));
        try {
          new BroadcastChannel('crm_admin_sync').postMessage({ type: 'BRANDING_UPDATED', tenantId: selectedTenantId });
        } catch (e) {}
        if (typeof refreshUser === 'function') {
          refreshUser();
        }
      }
    } catch (err) {
      toast.error("Failed to save company branding.");
    }
  };

  useEffect(() => {
    fetchLicenseStats();
    fetchTenants();
    fetchSidebarConfigs();
  }, []);



  useEffect(() => {
    const activePlanConfig = sidebarPlanConfigs.find(p => (p.plan_name || '').toLowerCase() === selectedPlan.toLowerCase());
    setPlanTabs(activePlanConfig ? activePlanConfig.enabled_tabs : (PLAN_DEFAULTS[selectedPlan] || AVAILABLE_TABS.map(t => t.id)));
  }, [selectedPlan, sidebarPlanConfigs]);

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

  const fetchSidebarConfigs = async () => {
    try {
      const res = await api.get('/superadmin/sidebar-config');
      if (res.data?.success) {
        setSidebarPlanConfigs(res.data.data.plans || []);
      }
    } catch (err) {
      console.error('Failed to load sidebar configurations:', err);
    }
  };

  const handleSavePlanConfig = async () => {
    try {
      const res = await api.post('/superadmin/sidebar-config/plan', {
        plan_name: selectedPlan,
        enabled_tabs: planTabs
      });
      if (res.data?.success) {
        toast.success(`Plan settings for "${selectedPlan}" saved successfully!`);
        fetchSidebarConfigs();
        window.dispatchEvent(new Event('app:sidebar-config-updated'));
        window.dispatchEvent(new Event('app:auth-change'));
        try {
          new BroadcastChannel('crm_admin_sync').postMessage({ type: 'PLAN_CONFIG_UPDATED', plan: selectedPlan });
        } catch (e) {}
        if (typeof refreshUser === 'function') {
          refreshUser();
        }
      }
    } catch (err) {
      toast.error('Failed to save plan configuration');
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
        setShowAdminPassword(false);
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
          try {
            new BroadcastChannel('crm_admin_sync').postMessage({ type: 'STATUS_UPDATED', tenantId: tenant.id });
          } catch (e) {}
        }
      } catch (err) {
        toast.error("Failed to toggle status.");
      }
    }
  };

  const handleDeleteTenant = async (tenant) => {
    if (tenant.id === user?.tenant?.id || tenant.id === user?.tenant_id) {
      toast.error("You cannot delete the workspace you are currently logged into.");
      return;
    }
    if (await confirm(`Are you sure you want to permanently delete workspace "${tenant.name}" (${tenant.slug})? All projects, leads, team members, and data associated with this workspace will be permanently removed.`)) {
      try {
        const res = await api.delete(`/superadmin/tenants/${tenant.id}`);
        if (res.data?.success) {
          toast.success(res.data?.data?.message || `Successfully deleted workspace "${tenant.name}"`);
          fetchTenants();
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete workspace.");
      }
    }
  };

  const handleEditSettings = (tenant) => {
    setEditingTenant(tenant);
    setShowEditAdminPassword(false);
    setSettings({
      name: tenant.name || '',
      plan: tenant.plan || 'starter',
      max_users: tenant.max_users || 10,
      admin_name: tenant.admin_name || '',
      admin_email: tenant.admin_email || '',
      admin_password: '',
      admin_user_id: tenant.admin_user_id || null,
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
        const updatedTenantId = editingTenant.id;
        setEditingTenant(null);
        setShowEditAdminPassword(false);
        fetchTenants();
        window.dispatchEvent(new Event('app:tenant-updated'));
        window.dispatchEvent(new Event('app:sidebar-config-updated'));
        window.dispatchEvent(new Event('app:auth-change'));
        try {
          new BroadcastChannel('crm_admin_sync').postMessage({ type: 'SETTINGS_UPDATED', tenantId: updatedTenantId });
        } catch (e) {}
        if (typeof refreshUser === 'function') {
          refreshUser();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save settings.");
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
        description="Organization-wide workspace provisioning, license optimization, access controls, and navigation settings." 
      />

      <div className={styles.tabContainer}>
        <button 
          className={`${styles.tab} ${activeTab === 'workspaces' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('workspaces')}
        >
          🏢 Client Workspaces
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sidebar' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('sidebar')}
        >
          ⚡ Sidebar Tabs Settings
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'company' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('company')}
        >
          🏢 Company Settings
        </button>
      </div>

      {activeTab === 'workspaces' && (
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
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedTenantId(tenant.id);
                                setActiveTab('company');
                              }}
                              style={{ height: '30px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                            >
                              Branding
                            </Button>
                            <Button 
                              variant={tenant.is_active ? 'danger' : 'success'}
                              size="sm"
                              onClick={() => handleToggleStatus(tenant)}
                              style={{ height: '30px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                            >
                              {tenant.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            {tenant.id !== user?.tenant?.id && tenant.id !== user?.tenant_id && (
                              <Button 
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteTenant(tenant)}
                                style={{ height: '30px', padding: '0 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', opacity: 0.85 }}
                                title="Permanently delete workspace"
                              >
                                Delete
                              </Button>
                            )}
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
              onClose={() => {
                setEditingTenant(null);
                setShowEditAdminPassword(false);
              }} 
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
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)', margin: '0' }}>Admin Account & Password</h3>

                <div className={styles.formRow}>
                  <Input 
                    label="Administrator Full Name"
                    type="text" 
                    placeholder="e.g. Sarah Jenkins" 
                    value={settings.admin_name} 
                    onChange={e => setSettings(prev => ({ ...prev, admin_name: e.target.value }))} 
                  />
                  <Input 
                    label="Administrator Email Address"
                    type="email" 
                    placeholder="e.g. admin@designstudioa.com" 
                    value={settings.admin_email} 
                    onChange={e => setSettings(prev => ({ ...prev, admin_email: e.target.value }))} 
                    autoComplete="username"
                  />
                </div>

                <Input 
                  label="Update Administrator Password"
                  type={showEditAdminPassword ? "text" : "password"} 
                  placeholder="Leave blank to keep current password" 
                  value={settings.admin_password} 
                  onChange={e => setSettings(prev => ({ ...prev, admin_password: e.target.value }))} 
                  autoComplete="new-password"
                  helperText="Enter a new password (min 8 characters) to reset the administrator password, or leave blank to keep unchanged."
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowEditAdminPassword(prev => !prev)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'inherit'
                      }}
                      title={showEditAdminPassword ? "Hide password" : "Show password"}
                      aria-label={showEditAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showEditAdminPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  }
                />

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
                    onClick={() => {
                      setEditingTenant(null);
                      setShowEditAdminPassword(false);
                    }}
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
      )}

      {activeTab === 'sidebar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease-out' }}>
          {/* Plan Selection Cards Row */}
          <div className={styles.planCardGrid}>
            {[
              { id: 'starter', title: 'Starter Plan', icon: '🌱', desc: 'Basic features & leads operations for early teams' },
              { id: 'growth', title: 'Growth Plan', icon: '🚀', desc: 'Smarter pipelines, coordination & key analytics' },
              { id: 'enterprise', title: 'Enterprise Plan', icon: '👑', desc: 'Full system control, developers APIs & financial tools' }
            ].map(p => (
              <div 
                key={p.id}
                className={`${styles.planCard} ${selectedPlan === p.id ? styles.activePlanCard : ''}`}
                onClick={() => setSelectedPlan(p.id)}
              >
                <div className={styles.planTitle}>
                  <span>{p.icon}</span> {p.title}
                </div>
                <div className={styles.planDesc}>{p.desc}</div>
              </div>
            ))}
          </div>

          <Card padding="lg">
            {/* Header Control Row with Search and Quick Selectors */}
            <div className={styles.tabsControlRow}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 4px 0' }}>
                  Tabs Visibility Settings: {selectedPlan.toUpperCase()} PLAN
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Enable or disable sidebar tabs visible to all workspaces subscribed to the {selectedPlan} plan.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Search sidebar tabs..." 
                  className={styles.tabSearchInput}
                  value={tabSearchQuery}
                  onChange={e => setTabSearchQuery(e.target.value)}
                />
                <Button size="sm" variant="secondary" onClick={() => setPlanTabs(PLAN_DEFAULTS[selectedPlan] || [])}>
                  Reset to Defaults
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPlanTabs(AVAILABLE_TABS.map(t => t.id))}>
                  Check All
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPlanTabs([])}>
                  Uncheck All
                </Button>
              </div>
            </div>

            {/* Grouped Tabs List */}
            <div className={styles.tabGroupsGrid} style={{ marginTop: '24px' }}>
              {/* Group the available tabs */}
              {(() => {
                const filtered = AVAILABLE_TABS.filter(t => 
                  t.label.toLowerCase().includes(tabSearchQuery.toLowerCase()) || 
                  t.group.toLowerCase().includes(tabSearchQuery.toLowerCase())
                );
                
                const groups = {};
                filtered.forEach(tab => {
                  if (!groups[tab.group]) {
                    groups[tab.group] = [];
                  }
                  groups[tab.group].push(tab);
                });

                const GROUP_ICONS = {
                  'WORKSPACE': '🏢',
                  'ANALYTICS': '📊',
                  'SALES SETUP': '◎',
                  'PROJECT SETUP': '◈',
                  'PROJECT OPERATIONS': '⚙',
                  'RESOURCE OPERATIONS': '👥',
                  'VENDORS': '🤝',
                  'FINANCE': '💰',
                  'TEAM & SECURITY': '🛡️',
                  'DEVELOPER TOOLS': '🔌'
                };

                if (Object.keys(groups).length === 0) {
                  return (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                      No sidebar tabs match your search query.
                    </div>
                  );
                }

                return Object.entries(groups).map(([groupName, tabs]) => (
                  <div key={groupName} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <span>{GROUP_ICONS[groupName] || '📂'}</span> {groupName}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {tabs.map(tab => (
                        <div 
                          key={tab.id} 
                          className={`${styles.tabItemRow} ${tab.isSubItem ? styles.subItemIndent : ''}`}
                        >
                          <div className={styles.tabLabelGroup}>
                            <span className={styles.tabLabelName}>{tab.label}</span>
                            <span className={styles.tabLabelSub}>ID: {tab.id}</span>
                          </div>
                          <Toggle 
                            checked={planTabs.includes(tab.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setPlanTabs(prev => [...prev, tab.id]);
                              } else {
                                setPlanTabs(prev => prev.filter(id => id !== tab.id));
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
              <Button 
                variant="primary" 
                onClick={handleSavePlanConfig}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
              >
                💾 Save Configuration for {selectedPlan.toUpperCase()} Plan
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'company' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease-out' }}>
          {/* Tenant Selector */}
          <Card padding="lg">
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 16px 0' }}>Select Workspace</h2>
            <div style={{ maxWidth: '400px' }}>
              <Select 
                label="Client Workspace"
                value={selectedTenantId}
                onChange={val => setSelectedTenantId(val)}
                options={tenants.map(t => ({ value: t.id, label: `${t.name} (${t.slug})` }))}
                required
              />
            </div>
          </Card>

          {selectedTenantId ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className={styles.formRow}>
                {/* Form Card */}
                <Card padding="lg">
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 16px 0' }}>Branding and Customization Details</h3>
                  <form onSubmit={handleSaveCompanyDetails} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <Input 
                      label="Company Name"
                      type="text" 
                      value={companyForm.name} 
                      onChange={e => setCompanyForm(prev => ({ ...prev, name: e.target.value }))} 
                      required
                    />
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className={styles.formRow}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Logo</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input 
                            type="url" 
                            className={styles.searchInput} 
                            value={companyForm.logo_url || ''} 
                            placeholder="https://example.com/logo.png"
                            onChange={e => setCompanyForm(prev => ({ ...prev, logo_url: e.target.value }))} 
                            style={{ flex: 1, height: '36px' }}
                          />
                          <label style={{ 
                            background: 'var(--color-bg-alt, #f3f4f6)',
                            border: '1px solid var(--color-border)', 
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            height: '36px',
                            boxSizing: 'border-box',
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--color-text)'
                          }}>
                            {uploadingLogo ? 'Uploading...' : 'Upload File'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleSuperAdminLogoUpload} 
                              style={{ display: 'none' }} 
                            />
                          </label>
                          {companyForm.logo_url && (
                            <button 
                              type="button"
                              onClick={() => setCompanyForm(prev => ({ ...prev, logo_url: '' }))}
                              style={{
                                background: 'var(--color-danger-bg, #fee2e2)',
                                border: '1px solid var(--color-danger, #ef4444)', 
                                borderRadius: 'var(--radius-md)',
                                padding: '8px 16px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                height: '36px',
                                boxSizing: 'border-box',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'var(--color-danger, #b91c1c)'
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Accent Colour</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input 
                            type="color" 
                            value={companyForm.accent_colour || '#4f46e5'} 
                            onChange={e => setCompanyForm(prev => ({ ...prev, accent_colour: e.target.value }))} 
                            style={{ width: '45px', height: '36px', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                          />
                          <input 
                            type="text" 
                            className={styles.searchInput} 
                            value={companyForm.accent_colour || '#4f46e5'} 
                            onChange={e => setCompanyForm(prev => ({ ...prev, accent_colour: e.target.value }))} 
                            placeholder="#4f46e5"
                            style={{ flex: 1, height: '36px' }}
                          />
                        </div>
                      </div>
                    </div>

                    <Input 
                      label="Description / Tagline"
                      type="text" 
                      value={companyForm.description || ''} 
                      placeholder="Brief tagline or company description"
                      onChange={e => setCompanyForm(prev => ({ ...prev, description: e.target.value }))} 
                    />

                    <Input 
                      label="Office Address"
                      type="text" 
                      value={companyForm.address || ''} 
                      placeholder="e.g. 123 Design St"
                      onChange={e => setCompanyForm(prev => ({ ...prev, address: e.target.value }))} 
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className={styles.formRow}>
                      <Input 
                        label="Phone Number"
                        type="tel" 
                        value={companyForm.phone || ''} 
                        placeholder="+1 (555) 123-4567"
                        onChange={e => setCompanyForm(prev => ({ ...prev, phone: e.target.value }))} 
                      />
                      <Input 
                        label="Email Address"
                        type="email" 
                        value={companyForm.email || ''} 
                        placeholder="contact@company.com"
                        onChange={e => setCompanyForm(prev => ({ ...prev, email: e.target.value }))} 
                      />
                    </div>

                    <Input 
                      label="Website URL"
                      type="url" 
                      value={companyForm.website || ''} 
                      placeholder="https://www.company.com"
                      onChange={e => setCompanyForm(prev => ({ ...prev, website: e.target.value }))} 
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <Button type="submit" variant="primary">
                        Save Branding Details
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Preview Card */}
                <Card padding="lg">
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-text)', margin: '0 0 16px 0' }}>Live Branding Preview</h3>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '16px', 
                    padding: '24px', 
                    border: '2px dashed var(--color-border)', 
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-surface-2)',
                    textAlign: 'center'
                  }}>
                    {companyForm.logo_url ? (
                      <img src={companyForm.logo_url} alt="Logo" style={{ width: '96px', height: '96px', objectFit: 'contain', background: 'white', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ 
                        width: '96px', 
                        height: '96px', 
                        borderRadius: '8px', 
                        background: companyForm.accent_colour, 
                        color: 'white', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justify: 'center', 
                        fontSize: '32px', 
                        fontWeight: '800' 
                      }}>
                        {companyForm.name ? companyForm.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                    )}
                    <div>
                      <h4 style={{ fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>{companyForm.name || 'Company Name'}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                        {companyForm.website || 'www.website.com'}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Sidebar Live Mockup</h4>
                    <div style={{ 
                      background: '#1e1e2f', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      color: 'white'
                    }}>
                      {companyForm.logo_url ? (
                        <img src={companyForm.logo_url} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '4px', 
                          background: companyForm.accent_colour, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justify: 'center',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: 'white'
                        }}>
                          {companyForm.name ? companyForm.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                      )}
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{companyForm.name || 'Interior CRM'}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No workspace selected. Please select a workspace to edit branding.
            </div>
          )}
        </div>
      )}

      {/* PROVISION WORKSPACE MODAL */}
      <Modal
        isOpen={isProvisionOpen}
        onClose={() => {
          setIsProvisionOpen(false);
          setShowAdminPassword(false);
        }}
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
            type={showAdminPassword ? "text" : "password"} 
            placeholder="Minimum 8 characters" 
            value={newTenant.adminPassword} 
            onChange={e => setNewTenant(prev => ({ ...prev, adminPassword: e.target.value }))} 
            required
            autoComplete="new-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowAdminPassword(prev => !prev)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'inherit'
                }}
                title={showAdminPassword ? "Hide password" : "Show password"}
                aria-label={showAdminPassword ? "Hide password" : "Show password"}
              >
                {showAdminPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            }
          />

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => {
                setIsProvisionOpen(false);
                setShowAdminPassword(false);
              }}
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
