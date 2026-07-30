/* eslint-disable react-hooks/immutability, no-unused-vars, no-empty, no-undef */
import React, { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import layoutStyles from './ConfigLayout.module.css'
import styles from './RolesManager.module.css'
import { Button, Modal, DataTable, Input, Select } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'
import { DATA_SCOPES, ACTION_DEPENDENCIES, PERMISSION_MODULES, PERMISSION_ACTIONS } from '../../constants/permissions'
import { FIELD_PERMISSIONS_SCHEMA } from '../../constants/fieldPermissions'
import { PAGE_PERMISSIONS_SCHEMA } from '../../constants/pagePermissions'

const BUILT_IN_TEMPLATES = [
  { id: 'tmpl-1', name: 'Project Manager', category: 'built-in', description: 'Full access to projects, schedules, and team assignments.', permissions: ['projects:view', 'projects:create', 'projects:edit', 'projects:delete', 'milestones:view', 'milestones:create', 'milestones:edit'], enabled_modules: ['projects', 'milestones'], data_scopes: { projects: 'department' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-2', name: 'Site Supervisor', category: 'built-in', description: 'Access to daily site reports, tasks, and labour tracking.', permissions: ['dailySiteReports:view', 'dailySiteReports:create', 'dailySiteReports:edit', 'tasks:view', 'tasks:create', 'tasks:edit'], enabled_modules: ['dailySiteReports', 'tasks'], data_scopes: { dailySiteReports: 'own', tasks: 'own' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-3', name: 'Sales Representative', category: 'built-in', description: 'Manage leads, pipeline, and initial quotations.', permissions: ['leads:view', 'leads:create', 'leads:edit', 'quotations:view', 'quotations:create'], enabled_modules: ['leads', 'quotations'], data_scopes: { leads: 'own', quotations: 'own' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-4', name: 'Finance Controller', category: 'built-in', description: 'Global access to budgets, invoices, and financial reporting.', permissions: ['invoices:view', 'invoices:create', 'invoices:edit', 'invoices:approve', 'budget:view', 'budget:create', 'budget:edit'], enabled_modules: ['invoices', 'budget'], data_scopes: { invoices: 'global', budget: 'global' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-5', name: 'Quality Inspector', category: 'built-in', description: 'Access to punch lists, snags, and QC forms.', permissions: ['qc:view', 'qc:create', 'qc:edit', 'snags:view', 'snags:create', 'snags:edit'], enabled_modules: ['qc', 'snags'], data_scopes: { qc: 'department', snags: 'department' }, page_permissions: {}, field_permissions: {}, security_policies: {} }
];

const TimeSelect = ({ value, onChange }) => {
  let hour = '12';
  let min = '00';
  let ampm = 'AM';
  
  if (value) {
    const [hStr, mStr] = value.split(':');
    let h = parseInt(hStr, 10) || 0;
    min = mStr || '00';
    if (h >= 12) {
      ampm = 'PM';
      if (h > 12) h -= 12;
    } else {
      ampm = 'AM';
      if (h === 0) h = 12;
    }
    hour = h.toString().padStart(2, '0');
  }

  const handleUpdate = (newHour, newMin, newAmpm) => {
    let h = parseInt(newHour, 10);
    if (isNaN(h)) h = 12;
    if (newAmpm === 'PM' && h !== 12) h += 12;
    if (newAmpm === 'AM' && h === 12) h = 0;
    
    let m = parseInt(newMin, 10);
    if (isNaN(m)) m = 0;
    if (m > 59) m = 59;
    if (m < 0) m = 0;
    
    onChange(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const handleHourChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(-2);
    let num = parseInt(val, 10);
    if (num > 12) val = '12';
    onChange(`${val || '12'}:${min}`);
  };

  const handleHourBlur = (e) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num) || num < 1) num = 12;
    handleUpdate(num.toString(), min, ampm);
  };

  const handleMinChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(-2);
    let num = parseInt(val, 10);
    if (num > 59) val = '59';
    onChange(`${hour}:${val || '00'}`);
  };

  const handleMinBlur = (e) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num) || num < 0) num = 0;
    handleUpdate(hour, num.toString(), ampm);
  };

  return (
    <div className="input-field" style={{ display: 'flex', gap: '2px', alignItems: 'center', padding: '4px 8px', width: 'fit-content' }}>
      <input 
        type="text"
        style={{ width: '32px', padding: '4px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', color: 'inherit', fontSize: 'inherit' }}
        value={hour} 
        onChange={handleHourChange}
        onBlur={handleHourBlur}
        placeholder="HH"
      />
      <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>:</span>
      <input 
        type="text"
        style={{ width: '32px', padding: '4px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', color: 'inherit', fontSize: 'inherit' }}
        value={min} 
        onChange={handleMinChange}
        onBlur={handleMinBlur}
        placeholder="MM"
      />
      <select 
        style={{ padding: '4px', marginLeft: '4px', border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text-secondary)', fontSize: 'inherit', cursor: 'pointer', appearance: 'none', fontWeight: 500 }}
        value={ampm} 
        onChange={e => handleUpdate(hour, min, e.target.value)}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};


export default function RolesManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [schemaModules, setSchemaModules] = useState([])
  const [schemaActions, setSchemaActions] = useState([])
  const [branches, setBranches] = useState([])
  const [departments, setDepartments] = useState([])
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    data_scopes: {},
    field_permissions: {},
    enabled_modules: [],
    page_permissions: {},
    security_policies: {},
    change_summary: ''
  })
  const [auditRoleTarget, setAuditRoleTarget] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilters, setAuditFilters] = useState({ user_id: '', date_from: '', date_to: '' })

  const [versionRoleTarget, setVersionRoleTarget] = useState(null)
  const [roleVersions, setRoleVersions] = useState([])
  const [versionLoading, setVersionLoading] = useState(false)
  const [expandedVersionId, setExpandedVersionId] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedModules, setExpandedModules] = useState({})

  const [isTemplateLibOpen, setIsTemplateLibOpen] = useState(false)
  const [templates, setTemplates] = useState(BUILT_IN_TEMPLATES)
  const [cloneSource, setCloneSource] = useState(null)
  const [cloneName, setCloneName] = useState('')
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [dependencyErrors, setDependencyErrors] = useState([])
  const [isDependencyRefOpen, setIsDependencyRefOpen] = useState(false)

  const searchInputRef = useRef(null)

  const toast = useToast()

  const isModalOpen = searchParams.has('action') || searchParams.has('edit');

  useEffect(() => {
    if (searchParams.has('edit') && roles.length > 0) {
      const roleId = searchParams.get('edit');
      const role = roles.find(r => r.id === roleId);
      if (role) {
        setEditingRole(role);
        setFormData({ name: role.name, description: role.description || '', permissions: [...(role.permissions || [])], data_scopes: { ...(role.data_scopes || {}) }, field_permissions: { ...(role.field_permissions || {}) }, enabled_modules: [...(role.enabled_modules || [])], page_permissions: { ...(role.page_permissions || {}) }, security_policies: { ...(role.security_policies || {}) }, change_summary: '' });
      }
    } else if (searchParams.has('action') && searchParams.get('action') === 'new') {
      setEditingRole(null);
      setFormData({ name: '', description: '', permissions: [], data_scopes: {}, field_permissions: {}, enabled_modules: [], page_permissions: {}, security_policies: {}, change_summary: '' });
    }

    // Reset search and filters when modal opens/closes
    setSearchQuery('');
    setShowSelectedOnly(false);
  }, [searchParams, roles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && isModalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return (
    ) => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    fetchRolesAndSchema()
  }, [])

  const fetchRolesAndSchema = async () => {
    try {
      const [rolesRes, schemaRes, usersRes, branchesRes, deptsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/permissions-schema'),
        api.get('/users?limit=100').catch(() => ({ data: { data: [] } })),
        api.get('/org/branches').catch(() => ({ data: { data: [] } })),
        api.get('/org/departments').catch(() => ({ data: { data: [] } }))
      ]);
      const r = rolesRes.data?.data || rolesRes.data;
      setRoles(Array.isArray(r) ? r : []);

      const schemaData = schemaRes.data?.data || schemaRes.data;
      if (schemaData && schemaData.modules && schemaData.modules.length > 0) {
        setSchemaModules(schemaData.modules);
        setSchemaActions(schemaData.actions || []);
      } else {
        setSchemaModules(PERMISSION_MODULES);
        setSchemaActions(PERMISSION_ACTIONS);
      }

      setUsers(usersRes.data?.data || usersRes.data || []);
      setBranches(branchesRes.data?.data || branchesRes.data || []);
      setDepartments(deptsRes.data?.data || deptsRes.data || []);
    } catch (err) {
      // Fallback if no endpoint exists yet
      setRoles([
        { id: 'role-superadmin', name: 'superadmin', description: 'Full access', permissions: ['*'] }
      ])
      setSchemaModules(PERMISSION_MODULES);
      setSchemaActions(PERMISSION_ACTIONS);
    }
  }

  const fetchRoleAuditLogs = async (roleId, filters) => {
    setAuditLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.append('entity', 'role');
      qs.append('entityId', roleId);
      if (filters?.user_id) qs.append('userId', filters.user_id);
      if (filters?.date_from) qs.append('startDate', filters.date_from);
      if (filters?.date_to) qs.append('endDate', filters.date_to);
      const res = await api.get(`/audit-logs?${qs.toString()}`);
      setAuditLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }

  const fetchRoleVersions = async (roleId) => {
    setVersionLoading(true);
    try {
      const res = await api.get(`/roles/${roleId}/versions`);
      setRoleVersions(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load version history');
    } finally {
      setVersionLoading(false);
    }
  }

  const handleOpenVersionModal = (role) => {
    setVersionRoleTarget(role);
    setExpandedVersionId(null);
    fetchRoleVersions(role.id);
  }

  const handleRollback = async (versionId) => {
    if (!window.confirm('Are you sure you want to rollback to this version?')) return;
    try {
      await api.patch(`/roles/${versionRoleTarget.id}/rollback/${versionId}`);
      toast.success('Rollback successful');
      fetchRolesAndSchema();
      setVersionRoleTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to rollback');
    }
  }

  const handleOpenAuditModal = (role) => {
    setAuditRoleTarget(role);
    fetchRoleAuditLogs(role.id, auditFilters);
  }

  const handleExportAuditLogs = async () => {
    // Basic implementation
    window.alert('Exporting logs...');
  }

  const handleOpenModal = (role = null) => {
    if (role) {
      setSearchParams({ edit: role.id });
    } else {
      setSearchParams({ action: 'new' });
    }
  }

  const handleTogglePermission = (permId) => {
    if (formData.permissions.includes('*')) {
      if (permId !== '*') return; // If superadmin, can't toggle specific perms easily
    }
    setFormData(prev => {
      const perms = new Set(prev.permissions)
      if (perms.has(permId)) {
        perms.delete(permId)
        // Auto-remove dependent permissions (if I remove 'view', also remove 'edit' and 'delete')
        const [mod, action] = permId.split(':');
        for (const [key, deps] of Object.entries(ACTION_DEPENDENCIES)) {
          if (deps.includes(action)) {
            perms.delete(`${mod}:${key}`);
          }
        }
      } else {
        perms.add(permId)
        // Auto-add required dependencies
        const [mod, action] = permId.split(':');
        if (ACTION_DEPENDENCIES[action]) {
          ACTION_DEPENDENCIES[action].forEach(dep => {
            perms.add(`${mod}:${dep}`);
          });
        }
      }
      return { ...prev, permissions: Array.from(perms) }
    })
  }

  const handleSelectAllModule = (moduleId, filteredActions) => {
    if (formData.permissions.includes('*')) return;

    setFormData(prev => {
      const perms = new Set(prev.permissions);
      filteredActions.forEach(action => {
        perms.add(`${moduleId}:${action.id}`);
        if (ACTION_DEPENDENCIES[action.id]) {
          ACTION_DEPENDENCIES[action.id].forEach(dep => {
            perms.add(`${moduleId}:${dep}`);
          });
        }
      });
      return { ...prev, permissions: Array.from(perms) };
    });
  }

  const handleClearAllModule = (moduleId, actions) => {
    if (formData.permissions.includes('*')) return;

    setFormData(prev => {
      const perms = new Set(prev.permissions);
      actions.forEach(action => {
        perms.delete(`${moduleId}:${action.id}`);
        for (const [key, deps] of Object.entries(ACTION_DEPENDENCIES)) {
          if (deps.includes(action.id)) {
            perms.delete(`${moduleId}:${key}`);
          }
        }
      });
      return { ...prev, permissions: Array.from(perms) };
    });
  }

  const expandAll = () => {
    const allExpanded = {};
    schemaModules.forEach(m => allExpanded[m.id] = true);
    setExpandedModules(allExpanded);
  }

  const collapseAll = () => {
    const allCollapsed = {};
    schemaModules.forEach(m => allCollapsed[m.id] = false);
    setExpandedModules(allCollapsed);
  }

  const highlightText = (text, query) => {
    if (!query || !query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> : part
    );
  }

  const handleSelectAllGlobal = () => {
    if (formData.permissions.includes('*')) return;
    const allPerms = [];
    for (const mod of schemaModules) {
      for (const action of schemaActions) {
        allPerms.push(`${mod.id}:${action.id}`);
      }
    }
    setFormData(prev => ({ ...prev, permissions: allPerms }));
  }

  const handleClearAllGlobal = () => {
    if (formData.permissions.includes('*')) return;
    setFormData(prev => ({ ...prev, permissions: [] }));
  }

  const toggleModuleAccordion = (moduleId) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  }

  const handleToggleModuleVisibility = (moduleId) => {
    if (formData.permissions.includes('*')) return;
    setFormData(prev => {
      const em = new Set(prev.enabled_modules || []);
      if (em.has(moduleId)) {
        em.delete(moduleId);
      } else {
        em.add(moduleId);
      }
      return { ...prev, enabled_modules: Array.from(em) };
    });
  }

  const handleDataScopeChange = (moduleId, value) => {
    setFormData(prev => {
      let newValue = value;
      if (value === 'specific_branches' || value === 'specific_departments') {
        // If switching to specific, initialize the object format
        newValue = { type: value, ids: [] };
      }
      return { ...prev, data_scopes: { ...prev.data_scopes, [moduleId]: newValue } };
    });
  };

  const handleSpecificScopeIdsChange = (moduleId, type, id) => {
    setFormData(prev => {
      const currentScope = prev.data_scopes[moduleId];
      const scopeType = typeof currentScope === 'object' ? currentScope.type : currentScope;

      // Ensure we are working with the correct object format
      let ids = Array.isArray(currentScope?.ids) ? [...currentScope.ids] : [];

      if (ids.includes(id)) {
        ids = ids.filter(i => i !== id);
      } else {
        ids.push(id);
      }

      return {
        ...prev,
        data_scopes: {
          ...prev.data_scopes,
          [moduleId]: { type: scopeType, ids }
        }
      };
    });
  };

  const saveRole = async () => {
    if (!formData.name) return toast.error('Role name is required')

    // Validate Dependencies
    if (!formData.permissions.includes('*')) {
      const errors = [];
      const permSet = new Set(formData.permissions);
      for (const perm of formData.permissions) {
        const [mod, action] = perm.split(':');
        if (ACTION_DEPENDENCIES[action]) {
          for (const dep of ACTION_DEPENDENCIES[action]) {
            if (!permSet.has(`${mod}:${dep}`)) {
              errors.push(`'${action}' on ${mod} requires '${dep}'`);
            }
          }
        }
      }
      if (errors.length > 0) {
        setDependencyErrors(errors);
        return; // Prevent saving, modal will open since dependencyErrors.length > 0
      }
    }

    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, formData)
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...formData } : r))
        toast.success('Role updated successfully')
      } else {
        const newRole = { ...formData, id: `role-${Date.now()}` }
        try {
          await api.post('/roles', formData)
        } catch (e) { } // Ignore mock backend errors
        fetchRolesAndSchema()
        setRoles(prev => [...prev, newRole])
        toast.success('Role created successfully')
      }
      setSearchParams({})
    } catch (err) {
      toast.error('Failed to save role')
    }
  }

  const handleSave = saveRole;

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/roles/templates')
      setTemplates(res.data.data || res.data)
    } catch (err) {
      toast.error('Failed to load templates')
    }
  }

  const handleOpenTemplateLib = () => {
    fetchTemplates()
    setIsTemplateLibOpen(true)
  }

  const handleSaveAsTemplate = async (role) => {
    const templateName = window.prompt(`Enter a name for the new template based on '${role.name}':`)
    if (!templateName) return;
    try {
      await api.post('/roles/templates', {
        name: templateName,
        description: `Template saved from ${role.name}`,
        permissions: role.permissions,
        data_scopes: role.data_scopes,
        field_permissions: role.field_permissions,
        enabled_modules: role.enabled_modules,
        page_permissions: role.page_permissions
      });
      toast.success('Saved as template successfully');
    } catch (err) {
      toast.error('Failed to save template');
    }
  }

  const executeClone = async () => {
    if (!cloneName) return toast.error('Role name is required');
    try {
      const res = await api.post('/roles/clone', {
        sourceId: cloneSource.id,
        newName: cloneName,
        isTemplate: cloneSource.isTemplate
      });
      setRoles(prev => [...prev, res.data.data || res.data]);
      toast.success('Role created successfully');
      setIsCloneModalOpen(false);
      setIsTemplateLibOpen(false);
      setCloneName('');
      setCloneSource(null);
    } catch (err) {
      toast.error('Failed to clone role');
    }
  }

  const handleDeleteRole = async (id) => {
    const roleToDelete = roles.find(r => r.id === id);
    if (!roleToDelete) return;
    if (roleToDelete.name === 'superadmin' || roleToDelete.name === 'Super Admin') {
      toast.error('Cannot delete superadmin role');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the role '${roleToDelete.name}'?`)) return;
    
    try {
      await api.delete(`/roles/${id}`);
      setRoles(prev => prev.filter(r => r.id !== id));
      toast.success('Role deleted');
    } catch (err) {
      // Fallback for mock environment
      setRoles(prev => prev.filter(r => r.id !== id));
      toast.success('Role deleted');
    }
  }

  const columns = [
    {
      key: 'name', label: 'Role Name', width: '15%',
      render: (r) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{r.name}</span>
    },
    {
      key: 'description', label: 'Description', width: '25%',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.description || '-'}</span>
    },
    {
      key: 'permissions', label: 'Permissions', width: '20%',
      render: (r) => {
        if (r.permissions?.includes('*')) return <span className={styles.tag} style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>Full Access (*)</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
            <span className={styles.tag}>{r.permissions?.length || 0} permissions</span>
          </div>
        )
      }
    },
    {
      key: 'actions', label: 'Actions', align: 'right', width: '550px',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => { setCloneSource({ id: r.id, isTemplate: false, name: r.name }); setCloneName(`${r.name} - Copy`); setIsCloneModalOpen(true); }}>Duplicate</Button>
          <Button variant="ghost" size="sm" onClick={() => handleSaveAsTemplate(r)}>Save as Template</Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenVersionModal(r)}>Version History</Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenAuditModal(r)}>Audit History</Button>
          {r.name !== 'superadmin' && r.name !== 'Super Admin' ? (
            <Button variant="danger" size="sm" onClick={() => handleDeleteRole(r.id)}>Delete</Button>
          ) : (
            <Button variant="danger" size="sm" style={{ visibility: 'hidden', pointerEvents: 'none' }}>Delete</Button>
          )}
        </div>
      )
    }
  ]

  // Filter modules based on search query and selected filter
  const filteredModules = useMemo(() => {
    // 1. First, map over schemaModules and inject schemaActions so each module has all actions available.
    let result = schemaModules.map(m => ({ ...m, actions: schemaActions }));

    // 2. If "Selected Only" is checked, filter out actions that are not in formData.permissions
    if (showSelectedOnly) {
      result = result.map(module => {
        const selectedActions = module.actions.filter(action => formData.permissions.includes(`${module.id}:${action.id}`));
        if (selectedActions.length > 0) {
          return { ...module, actions: selectedActions };
        }
        return null;
      }).filter(Boolean);
    }

    // 3. If a searchQuery exists, completely filter the modules to match the dropdown.
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(module => module.label.toLowerCase().trim() === query);
    }

    return result;
  }, [searchQuery, schemaModules, schemaActions, showSelectedOnly, formData.permissions]);

  // Auto-expand matched modules during search
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== '') {
      setExpandedModules(prev => {
        const newExpanded = { ...prev };
        filteredModules.forEach(m => {
          newExpanded[m.id] = true;
        });
        return newExpanded;
      });
    }
  }, [searchQuery, filteredModules]);

  return (
    <div className={!isModalOpen ? "mx-auto max-w-7xl p-4 sm:p-8 space-y-8" : "w-full h-full p-4 sm:p-6 flex flex-col"}>
      <div className={!isModalOpen ? layoutStyles.configSection : ""} style={isModalOpen ? { display: 'flex', flexDirection: 'column', minHeight: '100%', flex: 1 } : {}}>
        {!isModalOpen ? (
          <>
            <div className={layoutStyles.sectionHeader}>
              <div>
                <h2 className={layoutStyles.sectionTitle}>Roles & Permissions</h2>
                <p className={layoutStyles.sectionDesc}>Manage access controls and functional roles</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary" onClick={handleOpenTemplateLib}>Template Library</Button>
                <Button variant="primary" onClick={() => handleOpenModal()}>+ Add Role</Button>
              </div>
            </div>
            <DataTable columns={columns} data={roles} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className={layoutStyles.sectionHeader} style={{ marginBottom: '24px' }}>
              <div>
                <h2 className={layoutStyles.sectionTitle}>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                <p className={layoutStyles.sectionDesc}>Configure granular module permissions below.</p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="ghost" onClick={() => setSearchParams({})}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save Role</Button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(500px, 2fr)', gap: '24px', flex: 1, alignItems: 'start' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Card: Basic Details */}
                <div style={{ background: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--color-text)' }}>Basic Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className={styles.formGroup} style={{ margin: 0 }}>
                      <label className={styles.label}>Role Name</label>
                      <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Sales Manager"
                        disabled={formData.name === 'superadmin'}
                      />
                    </div>
                    
                    {!editingRole && roles.length > 0 && (
                      <div className={styles.formGroup} style={{ margin: 0 }}>
                        <label className={styles.label}>Clone Permissions From Existing Role</label>
                        <select 
                          className="input-field"
                          style={{ width: '100%', padding: '10px' }}
                          onChange={e => {
                            const roleToClone = roles.find(r => r.id === e.target.value);
                            if (!roleToClone) return;
                            if (!window.confirm(`Are you sure you want to overwrite current permissions with the '${roleToClone.name}' role template?`)) return;
                            setFormData(prev => ({
                              ...prev,
                              permissions: roleToClone.permissions || [],
                              enabled_modules: roleToClone.enabled_modules || [],
                              data_scopes: roleToClone.data_scopes || {},
                              page_permissions: roleToClone.page_permissions || {},
                              field_permissions: roleToClone.field_permissions || {},
                              security_policies: roleToClone.security_policies || {}
                            }));
                          }}
                          value=""
                        >
                          <option value="" disabled>Select a role to copy permissions...</option>
                          {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className={styles.formGroup} style={{ margin: 0 }}>
                      <label className={styles.label}>Description</label>
                      <Input
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                </div>

                {/* Card: Module Visibility */}
                <div style={{ background: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text)' }}>Module Visibility</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                    Enable or disable entire modules for this role. Disabled modules will be hidden from navigation.
                  </p>
                  {formData.permissions.includes('*') ? (
                    <div style={{ padding: '12px', background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', borderRadius: 'var(--radius-md)' }}>
                      Superadmins implicitly have all modules enabled.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                      {schemaModules.map(mod => (
                        <label key={mod.id} className={styles.checkboxContainer}>
                          <input
                            type="checkbox"
                            checked={(formData.enabled_modules || []).includes(mod.id)}
                            onChange={() => handleToggleModuleVisibility(mod.id)}
                          />
                          {mod.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card: Security Policies */}
                <div style={{ background: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--color-text)' }}>Security Policies</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Allowed Login Times */}
                    <div>
                      <label className={styles.label}>Allowed Login Times</label>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Restrict when this role can log in (e.g. 09:00 AM to 06:00 PM).</p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <TimeSelect
                          value={formData.security_policies.allowed_login_times?.start || ''}
                          onChange={val => setFormData(prev => ({ ...prev, security_policies: { ...prev.security_policies, allowed_login_times: { ...(prev.security_policies.allowed_login_times || {}), start: val } } }))}
                        />
                        <span style={{ color: 'var(--color-text-secondary)' }}>to</span>
                        <TimeSelect
                          value={formData.security_policies.allowed_login_times?.end || ''}
                          onChange={val => setFormData(prev => ({ ...prev, security_policies: { ...prev.security_policies, allowed_login_times: { ...(prev.security_policies.allowed_login_times || {}), end: val } } }))}
                        />
                      </div>
                    </div>

                    {/* Allowed Days */}
                    <div>
                      <label className={styles.label}>Allowed Days</label>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Restrict which days this role can log in.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                          const isChecked = formData.security_policies.allowed_days ? formData.security_policies.allowed_days.includes(idx) : false;
                          return (
                            <label key={day} className={styles.checkboxContainer}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData(prev => {
                                    const currentDays = prev.security_policies.allowed_days || [];
                                    let newDays = checked ? [...currentDays, idx] : currentDays.filter(d => d !== idx);
                                    return { ...prev, security_policies: { ...prev.security_policies, allowed_days: newDays } };
                                  });
                                }}
                              />
                              {day}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    {/* Allowed IPs */}
                    <div>
                      <label className={styles.label}>Allowed IP Addresses</label>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Comma separated list of IPs or CIDR blocks.</p>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="192.168.1.1, 10.0.0.0/24"
                        value={formData.security_policies.allowed_ips ? formData.security_policies.allowed_ips.join(', ') : ''}
                        onChange={e => {
                          const ips = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => ({ ...prev, security_policies: { ...prev.security_policies, allowed_ips: ips } }))
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Trusted Browsers */}
                    <div>
                      <label className={styles.label}>Trusted Browsers</label>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Comma separated list (e.g. Chrome, Firefox).</p>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Chrome, Safari"
                        value={formData.security_policies.trusted_browsers ? formData.security_policies.trusted_browsers.join(', ') : ''}
                        onChange={e => {
                          const browsers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => ({ ...prev, security_policies: { ...prev.security_policies, trusted_browsers: browsers } }))
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Allowed Devices */}
                    <div>
                      <label className={styles.label}>Allowed Devices</label>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>Comma separated list (e.g. Desktop, Mobile).</p>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Desktop, Mobile"
                        value={formData.security_policies.allowed_devices ? formData.security_policies.allowed_devices.join(', ') : ''}
                        onChange={e => {
                          const devices = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setFormData(prev => ({ ...prev, security_policies: { ...prev.security_policies, allowed_devices: devices } }))
                        }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
                
                {/* Card: Permissions */}
                <div style={{ background: 'var(--color-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Permissions</h3>
                    {!formData.permissions.includes('*') && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="ghost" size="sm" onClick={() => setIsDependencyRefOpen(true)}>View Dependencies</Button>
                        <Button variant="ghost" size="sm" onClick={handleSelectAllGlobal}>Select All</Button>
                        <Button variant="ghost" size="sm" onClick={handleClearAllGlobal}>Clear All</Button>
                      </div>
                    )}
                  </div>

                  {formData.permissions.includes('*') ? (
                    <div style={{ padding: '12px', background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', borderRadius: 'var(--radius-md)', width: '100%' }}>
                      This role has full system access (*).
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                          <div style={{ flex: 1 }}>
                            <Select 
                              label="Select Module to Configure"
                              options={[
                                { value: '', label: 'Select a module...' },
                                ...schemaModules.map(m => ({ value: m.label, label: m.label }))
                              ]}
                              value={searchQuery}
                              onChange={v => setSearchQuery(v)}
                            />
                          </div>
                        </div>

                        {(() => {
                          const selectedModuleRaw = schemaModules.find(m => m.label === searchQuery);
                          const module = selectedModuleRaw ? { ...selectedModuleRaw, actions: schemaActions } : null;

                          if (!module) {
                            return (
                              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                                Please select a module from the dropdown above to instantly display and configure its required permissions.
                              </div>
                            );
                          }

                          const currentScope = formData.data_scopes[module.id];
                          const scopeType = typeof currentScope === 'object' ? currentScope?.type : (currentScope || 'all');
                          const scopeIds = typeof currentScope === 'object' ? (currentScope?.ids || []) : [];

                          return (
                            <div style={{ padding: '24px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '12px' }}>
                                <h3 style={{ margin: 0, color: 'var(--color-text)' }}>{module.label} Permissions</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <Button variant="ghost" size="sm" onClick={() => handleSelectAllModule(module.id, module.actions)}>Select All</Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleClearAllModule(module.id, module.actions)}>Clear</Button>
                                </div>
                              </div>

                              <div style={{ marginBottom: '24px' }}>
                                <label className={styles.label} style={{ fontSize: '14px', marginBottom: '12px' }}>Required Permission List</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                  {module.actions.map(action => {
                                    const permId = `${module.id}:${action.id}`;
                                    return (
                                      <label key={permId} className={styles.checkboxContainer}>
                                        <input
                                          type="checkbox"
                                          checked={formData.permissions.includes(permId)}
                                          onChange={() => handleTogglePermission(permId)}
                                        />
                                        {action.label}
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>

                              <div style={{ marginBottom: '24px' }}>
                                <label className={styles.label} style={{ fontSize: '14px', marginBottom: '12px' }}>Data Scope</label>
                                <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                  <select
                                    className="input-field"
                                    style={{ width: '100%', maxWidth: '100%', padding: '10px' }}
                                    value={scopeType}
                                    onChange={(e) => handleDataScopeChange(module.id, e.target.value)}
                                  >
                                    {DATA_SCOPES.map(scope => (
                                      <option key={scope.id} value={scope.id} title={scope.description}>{scope.label}</option>
                                    ))}
                                  </select>
                                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                                    {DATA_SCOPES.find(s => s.id === scopeType)?.description}
                                  </p>

                                  {scopeType === 'specific_branches' && (
                                    <div style={{ marginTop: '16px', background: 'var(--color-background-soft)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                      <label className={styles.label} style={{ fontSize: '12px', marginBottom: '8px' }}>Select Permitted Branches</label>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                        {branches.map(b => (
                                          <label key={b.id} className={styles.checkboxContainer} style={{ fontSize: '12px' }}>
                                            <input
                                              type="checkbox"
                                              checked={scopeIds.includes(b.id)}
                                              onChange={() => handleSpecificScopeIdsChange(module.id, scopeType, b.id)}
                                            />
                                            {b.name}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {scopeType === 'specific_departments' && (
                                    <div style={{ marginTop: '16px', background: 'var(--color-background-soft)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                      <label className={styles.label} style={{ fontSize: '12px', marginBottom: '8px' }}>Select Permitted Departments</label>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                        {departments.map(d => (
                                          <label key={d.id} className={styles.checkboxContainer} style={{ fontSize: '12px' }}>
                                            <input
                                              type="checkbox"
                                              checked={scopeIds.includes(d.id)}
                                              onChange={() => handleSpecificScopeIdsChange(module.id, scopeType, d.id)}
                                            />
                                            {d.name}
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {FIELD_PERMISSIONS_SCHEMA[module.id] && (
                                <div style={{ marginBottom: '24px' }}>
                                  <label className={styles.label} style={{ fontSize: '14px', marginBottom: '12px' }}>Field Level Permissions</label>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                    {FIELD_PERMISSIONS_SCHEMA[module.id].map(field => {
                                      const currentPerm = formData.field_permissions?.[module.id]?.[field.id] || 'editable';
                                      return (
                                        <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: 500 }}>{field.label}</span>
                                          <select
                                            className="input-field"
                                            style={{ padding: '8px', width: '100%', fontSize: '13px' }}
                                            value={currentPerm}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setFormData(prev => ({
                                                ...prev,
                                                field_permissions: {
                                                  ...prev.field_permissions,
                                                  [module.id]: {
                                                    ...(prev.field_permissions[module.id] || {}),
                                                    [field.id]: val
                                                  }
                                                }
                                              }));
                                            }}
                                          >
                                            <option value="editable">Editable</option>
                                            <option value="read_only">Read Only</option>
                                            <option value="hidden">Hidden</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {PAGE_PERMISSIONS_SCHEMA[module.id] && (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label className={styles.label} style={{ fontSize: '14px', margin: 0 }}>Page / Tab Access</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <Button variant="ghost" size="sm" onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          page_permissions: {
                                            ...prev.page_permissions,
                                            [module.id]: PAGE_PERMISSIONS_SCHEMA[module.id].map(p => p.id)
                                          }
                                        }));
                                      }}>Select All</Button>
                                      <Button variant="ghost" size="sm" onClick={() => {
                                        setFormData(prev => ({
                                          ...prev,
                                          page_permissions: {
                                            ...prev.page_permissions,
                                            [module.id]: []
                                          }
                                        }));
                                      }}>Clear</Button>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                                    Select which tabs should be visible. If none are selected, all tabs are visible by default.
                                  </p>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                                    {PAGE_PERMISSIONS_SCHEMA[module.id].map(page => {
                                      const isChecked = formData.page_permissions?.[module.id]?.includes(page.id) || false;
                                      return (
                                        <label key={page.id} className={styles.checkboxContainer}>
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setFormData(prev => {
                                                const currentPages = prev.page_permissions?.[module.id] || [];
                                                let newPages = [];
                                                if (checked) {
                                                  newPages = [...currentPages, page.id];
                                                } else {
                                                  newPages = currentPages.filter(p => p !== page.id);
                                                }
                                                return {
                                                  ...prev,
                                                  page_permissions: {
                                                    ...prev.page_permissions,
                                                    [module.id]: newPages
                                                  }
                                                };
                                              });
                                            }}
                                          />
                                          {page.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Role Audit Modal */}
        <Modal isOpen={!!auditRoleTarget} onClose={() => setAuditRoleTarget(null)} title={`Audit History: ${auditRoleTarget?.name}`} maxWidth="800px">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input-field"
              style={{ padding: '6px', minWidth: '150px' }}
              value={auditFilters.user_id}
              onChange={e => {
                const newFilters = { ...auditFilters, user_id: e.target.value };
                setAuditFilters(newFilters);
                fetchRoleAuditLogs(auditRoleTarget.id, newFilters);
              }}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input
              type="date"
              className="input-field"
              style={{ padding: '6px' }}
              value={auditFilters.date_from}
              onChange={e => {
                const newFilters = { ...auditFilters, date_from: e.target.value };
                setAuditFilters(newFilters);
                fetchRoleAuditLogs(auditRoleTarget.id, newFilters);
              }}
            />
            <span>to</span>
            <input
              type="date"
              className="input-field"
              style={{ padding: '6px' }}
              value={auditFilters.date_to}
              onChange={e => {
                const newFilters = { ...auditFilters, date_to: e.target.value };
                setAuditFilters(newFilters);
                fetchRoleAuditLogs(auditRoleTarget.id, newFilters);
              }}
            />
            <Button variant="secondary" onClick={handleExportAuditLogs} style={{ marginLeft: 'auto' }}>Export Logs</Button>
          </div>

          {auditLoading ? (
            <p>Loading timeline...</p>
          ) : auditLogs.length === 0 ? (
            <p>No audit history found for this role.</p>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {auditLogs.map(log => {
                let oldObj = {}, newObj = {};
                try { oldObj = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : (log.old_value || {}); } catch (e) { }
                try { newObj = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : (log.new_value || {}); } catch (e) { }

                const isCreate = log.action === 'Created';
                const keys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

                return (
                  <div key={log.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      <div>
                        <strong>{log.user_name || 'System'}</strong> {isCreate ? 'created' : 'updated'} role via {log.browser || 'Unknown'} from IP {log.ip_address || 'Unknown'}
                      </div>
                      <div>{new Date(log.created_at).toLocaleString()}</div>
                    </div>

                    <div style={{ background: 'var(--color-background-soft)', padding: '12px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
                      {keys.length === 0 ? (
                        <span style={{ color: 'var(--color-text-secondary)' }}>No detailed changes recorded.</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {keys.map(key => {
                            const oldVal = oldObj[key];
                            const newVal = newObj[key];
                            if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;

                            return (
                              <div key={key} style={{ borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{key}</div>
                                {oldVal !== undefined && (
                                  <div style={{ color: '#d32f2f', textDecoration: 'line-through' }}>
                                    - {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                                  </div>
                                )}
                                {newVal !== undefined && (
                                  <div style={{ color: '#2e7d32' }}>
                                    + {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setAuditRoleTarget(null)}>Close</Button>
          </div>
        </Modal>

        {/* Template Library Modal */}
        <Modal isOpen={isTemplateLibOpen} onClose={() => setIsTemplateLibOpen(false)} title="Template Library" maxWidth="700px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>Select a built-in or custom template to quickly create a new role.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
              {BUILT_IN_TEMPLATES.map(t => (
                <div key={t.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>{t.name}</h4>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: t.category === 'built-in' ? 'var(--color-primary-light)' : 'var(--color-secondary)', color: t.category === 'built-in' ? 'var(--color-primary-dark)' : 'white' }}>
                        {t.category === 'built-in' ? 'Built-in' : 'Custom'}
                      </span>
                    </div>
                    {t.description && <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>{t.description}</p>}
                  </div>
                  <Button variant="secondary" size="small" style={{ alignSelf: 'flex-start' }} onClick={() => {
                    setCloneSource({ id: t.id, isTemplate: true, name: t.name });
                    setCloneName(`${t.name} (Custom)`);
                    setIsCloneModalOpen(true);
                  }}>Use Template</Button>
                </div>
              ))}
              {BUILT_IN_TEMPLATES.length === 0 && <p>No templates available.</p>}
            </div>
          </div>
        </Modal>

        {/* Clone Prompt Modal */}
        <Modal isOpen={isCloneModalOpen} onClose={() => { setIsCloneModalOpen(false); setCloneName(''); setCloneSource(null); }} title="Create Role">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>New Role Name</label>
              <Input value={cloneName} onChange={e => setCloneName(e.target.value)} autoFocus placeholder="e.g. Project Manager (Senior)" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <Button variant="ghost" onClick={() => { setIsCloneModalOpen(false); setCloneName(''); setCloneSource(null); }}>Cancel</Button>
              <Button variant="primary" onClick={executeClone}>Create Role</Button>
            </div>
          </div>
        </Modal>

        {/* Dependency Errors Warning Modal */}
        <Modal isOpen={dependencyErrors.length > 0} onClose={() => setDependencyErrors([])} title="Missing Permission Dependencies">
          <div style={{ color: 'var(--color-danger)', background: 'var(--color-danger-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Cannot save role. The following dependencies are missing:</p>
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
              {dependencyErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            Certain actions inherently require other permissions to function correctly. For example, you cannot 'delete' an item if you cannot 'view' it. Please select the required permissions and try again.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setDependencyErrors([])}>I Understand</Button>
          </div>
        </Modal>

        {/* Dependency Reference Modal */}
        <Modal isOpen={isDependencyRefOpen} onClose={() => setIsDependencyRefOpen(false)} title="Permission Dependencies Reference" maxWidth="600px">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              The table below outlines the global dependencies applied across all modules. When you assign an action on the left, the system ensures the role also holds the required actions on the right.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px' }}>Action</th>
                  <th style={{ padding: '12px 8px' }}>Requires</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ACTION_DEPENDENCIES).map(([action, deps]) => (
                  <tr key={action} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 500 }}>{action}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)' }}>
                      {deps.map(d => <span key={d} style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', marginRight: '4px', border: '1px solid var(--color-border)' }}>{d}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>

        {/* Role Versions Modal */}
        <Modal isOpen={!!versionRoleTarget} onClose={() => setVersionRoleTarget(null)} title={`Version History: ${versionRoleTarget?.name}`} maxWidth="800px">
          {versionLoading ? (
            <div>Loading versions...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
              {roleVersions.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                  No versions found.
                </div>
              ) : (
                roleVersions.map((v, i) => {
                  const isCurrent = i === 0;
                  const isExpanded = expandedVersionId === v.id;

                  // Diff Calculation
                  const previousVersion = roleVersions[i + 1] || { permissions: [], data_scopes: {}, field_permissions: {}, enabled_modules: [], page_permissions: {} };
                  const curPerms = typeof v.permissions === 'string' ? JSON.parse(v.permissions || '[]') : (v.permissions || []);
                  const prevPerms = typeof previousVersion.permissions === 'string' ? JSON.parse(previousVersion.permissions || '[]') : (previousVersion.permissions || []);

                  const addedPerms = curPerms.filter(p => !prevPerms.includes(p));
                  const removedPerms = prevPerms.filter(p => !curPerms.includes(p));

                  return (
                    <div key={v.id} style={{ padding: '16px', background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                            Version {v.version_number} {isCurrent && <span className={styles.tag} style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', marginLeft: '8px' }}>Current</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            By: {v.editor_name || 'System'} • {new Date(v.created_at).toLocaleString()}
                          </div>
                          <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
                            <strong>Summary:</strong> {v.change_summary || 'No summary provided.'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}>
                            {isExpanded ? 'Hide Changes' : 'View Changes'}
                          </Button>
                          {!isCurrent && (
                            <Button variant="secondary" size="sm" onClick={() => handleRollback(v.id)}>Rollback</Button>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-background-soft)', borderRadius: '4px', fontSize: '13px' }}>
                          <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Permissions Diff</h5>
                          {addedPerms.length === 0 && removedPerms.length === 0 ? (
                            <span style={{ color: 'var(--color-text-secondary)' }}>No permission changes in this version.</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'monospace' }}>
                              {addedPerms.map(p => (
                                <div key={`add-${p}`} style={{ color: '#2e7d32' }}>+ {p}</div>
                              ))}
                              {removedPerms.map(p => (
                                <div key={`rem-${p}`} style={{ color: '#d32f2f', textDecoration: 'line-through' }}>- {p}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Modal>

      </div>
    </div>
  )
}
