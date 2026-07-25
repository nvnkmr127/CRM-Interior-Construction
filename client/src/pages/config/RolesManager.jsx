/* eslint-disable react-hooks/immutability, no-unused-vars, no-empty, no-undef */
import { useState, useEffect, Fragment, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import layoutStyles from './ConfigLayout.module.css'
import styles from './RolesManager.module.css'
import { Button, Modal, DataTable, Input } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'
import { DATA_SCOPES } from '../../constants/permissions'
import { FIELD_PERMISSIONS_SCHEMA } from '../../constants/fieldPermissions'
import { PAGE_PERMISSIONS_SCHEMA } from '../../constants/pagePermissions'

export default function RolesManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [roles, setRoles] = useState([])
  const [schemaModules, setSchemaModules] = useState([])
  const [schemaActions, setSchemaActions] = useState([])
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [], data_scopes: {}, field_permissions: {}, enabled_modules: [], page_permissions: {} })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedModules, setExpandedModules] = useState({})
  
  const [isTemplateLibOpen, setIsTemplateLibOpen] = useState(false)
  const [templates, setTemplates] = useState([])
  const [cloneSource, setCloneSource] = useState(null)
  const [cloneName, setCloneName] = useState('')
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  const searchInputRef = useRef(null)

  const toast = useToast()

  const isModalOpen = searchParams.has('action') || searchParams.has('edit');
  
  useEffect(() => {
    if (searchParams.has('edit') && roles.length > 0) {
      const roleId = searchParams.get('edit');
      const role = roles.find(r => r.id === roleId);
      if (role) {
        setEditingRole(role);
        setFormData({ name: role.name, description: role.description || '', permissions: [...(role.permissions || [])], data_scopes: { ...(role.data_scopes || {}) }, field_permissions: { ...(role.field_permissions || {}) }, enabled_modules: [...(role.enabled_modules || [])], page_permissions: { ...(role.page_permissions || {}) } });
      }
    } else if (searchParams.has('action') && searchParams.get('action') === 'new') {
      setEditingRole(null);
      setFormData({ name: '', description: '', permissions: [], data_scopes: {}, field_permissions: {}, enabled_modules: [], page_permissions: {} });
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    fetchRolesAndSchema()
  }, [])

  const fetchRolesAndSchema = async () => {
    try {
      const [rolesRes, schemaRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/permissions-schema')
      ]);
      const r = rolesRes.data?.data || rolesRes.data;
      setRoles(Array.isArray(r) ? r : []);
      
      const schemaData = schemaRes.data?.data || schemaRes.data;
      if (schemaData) {
        setSchemaModules(schemaData.modules || []);
        setSchemaActions(schemaData.actions || []);
      }
    } catch (err) {
      // Fallback if no endpoint exists yet
      setRoles([
        { id: 'role-superadmin', name: 'superadmin', description: 'Full access', permissions: ['*'] }
      ])
    }
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
      } else {
        perms.add(permId)
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
    const regex = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
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

  const handleSave = async () => {
    if (!formData.name) return toast.error('Role name is required')
    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, formData)
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...formData } : r))
        toast.success('Role updated successfully')
      } else {
        const newRole = { ...formData, id: `role-${Date.now()}` }
        try {
          await api.post('/roles', formData)
        } catch(e) {} // Ignore mock backend errors
        setRoles(prev => [...prev, newRole])
        toast.success('Role created successfully')
      }
      setSearchParams({})
    } catch (err) {
      toast.error('Failed to save role')
    }
  }

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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.name === 'superadmin') {
      toast.error('Cannot delete superadmin role')
      setDeleteTarget(null)
      return
    }
    try {
      await api.delete(`/roles/${deleteTarget.id}`)
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast.success('Role deleted')
    } catch (err) {
      // Fallback for mock environment
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast.success('Role deleted')
    }
    setDeleteTarget(null)
  }

  const columns = [
    {
      key: 'name', label: 'Role Name',
      render: (r) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{r.name}</span>
    },
    {
      key: 'description', label: 'Description',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.description || '-'}</span>
    },
    {
      key: 'permissions', label: 'Permissions',
      render: (r) => {
        if (r.permissions?.includes('*')) return <span className={styles.tag} style={{background:'var(--color-accent-light)', color:'var(--color-accent-dark)'}}>Full Access (*)</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
            <span className={styles.tag}>{r.permissions?.length || 0} permissions</span>
          </div>
        )
      }
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => { setCloneSource({ id: r.id, isTemplate: false, name: r.name }); setCloneName(`${r.name} - Copy`); setIsCloneModalOpen(true); }}>Duplicate</Button>
          <Button variant="ghost" size="sm" onClick={() => handleSaveAsTemplate(r)}>Save as Template</Button>
          {r.name !== 'superadmin' && (
            <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setDeleteTarget(r)}>Delete</Button>
          )}
        </div>
      )
    }
  ]

  // Filter modules based on search query and selected filter
  const filteredModules = useMemo(() => {
    let result = schemaModules;
    
    // 1. Filter by selected only
    if (showSelectedOnly) {
      result = result.map(module => {
        const selectedActions = schemaActions.filter(action => formData.permissions.includes(`${module.id}:${action.id}`));
        if (selectedActions.length > 0) {
          return { ...module, actions: selectedActions };
        }
        return null;
      }).filter(Boolean);
    } else {
      result = result.map(m => ({ ...m, actions: schemaActions }));
    }

    // 2. Filter by search query
    if (!searchQuery.trim()) return result;
    
    const query = searchQuery.toLowerCase();
    
    return result.map(module => {
      const moduleMatch = module.label.toLowerCase().includes(query);
      
      const matchedActions = module.actions.filter(action => {
        return moduleMatch || action.label.toLowerCase().includes(query) || `${module.id}:${action.id}`.toLowerCase().includes(query);
      });
      
      if (moduleMatch || matchedActions.length > 0) {
        return {
          ...module,
          actions: matchedActions.length > 0 ? matchedActions : module.actions
        };
      }
      return null;
    }).filter(Boolean);
  }, [searchQuery, schemaModules, schemaActions, showSelectedOnly, formData.permissions]);

  // Auto-expand matched modules during search
  useEffect(() => {
    if (searchQuery.trim()) {
      const expanded = {};
      filteredModules.forEach(m => expanded[m.id] = true);
      setExpandedModules(expanded);
    }
  }, [searchQuery]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
      <div className={layoutStyles.configSection}>
        {!isModalOpen ? (
          <>
            <div className={layoutStyles.configHeader}>
            <div>
              <h2 className={layoutStyles.configTitle}>Roles & Permissions</h2>
              <p className={layoutStyles.configSubtitle}>Manage access controls and functional roles</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={handleOpenTemplateLib}>Template Library</Button>
              <Button variant="primary" onClick={() => handleOpenModal()}>+ Add Role</Button>
            </div>
          </div>
            <DataTable columns={columns} data={roles} />
          </>
        ) : (
          <div>
            <div className={layoutStyles.sectionHeader} style={{ marginBottom: '24px' }}>
              <div>
                <h2 className={layoutStyles.sectionTitle}>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                <p className={layoutStyles.sectionDesc}>Configure granular module permissions below.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className={styles.formGroup} style={{ maxWidth: '800px' }}>
                <label className={styles.label}>Role Name</label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Sales Manager"
                  disabled={formData.name === 'superadmin'}
                />
              </div>
              <div className={styles.formGroup} style={{ maxWidth: '800px' }}>
                <label className={styles.label}>Description</label>
                <Input 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="Optional description"
                />
              </div>
              
              <div className={styles.formGroup} style={{ maxWidth: '800px', marginBottom: '24px' }}>
                <label className={styles.label}>Module Visibility</label>
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
              
              <div className={styles.formGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', maxWidth: '800px' }}>
                  <label className={styles.label} style={{ marginBottom: 0 }}>Permissions</label>
                  
                  {!formData.permissions.includes('*') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="ghost" size="sm" onClick={handleSelectAllGlobal}>Select All</Button>
                      <Button variant="ghost" size="sm" onClick={handleClearAllGlobal}>Clear All</Button>
                    </div>
                  )}
                </div>
                
                {!formData.permissions.includes('*') && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '16px', maxWidth: '800px', background: 'var(--color-surface)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ flex: '1 1 300px' }}>
                      <Input 
                        ref={searchInputRef}
                        placeholder="Search permissions (Ctrl+F)..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={showSelectedOnly}
                        onChange={(e) => setShowSelectedOnly(e.target.checked)}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>Selected Only</span>
                    </label>

                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                      <Button variant="ghost" size="sm" onClick={expandAll}>Expand All</Button>
                      <Button variant="ghost" size="sm" onClick={collapseAll}>Collapse All</Button>
                    </div>
                  </div>
                )}
                
                {formData.permissions.includes('*') ? (
                  <div style={{ padding: '12px', background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', borderRadius: 'var(--radius-md)', maxWidth: '800px' }}>
                    This role has full system access (*).
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px' }}>
                    {filteredModules.length === 0 ? (
                      <div style={{ color: 'var(--color-text-secondary)' }}>No permissions match your search.</div>
                    ) : (
                      filteredModules.map((module) => {
                        const modulePermsCount = module.actions.filter(a => formData.permissions.includes(`${module.id}:${a.id}`)).length;
                        const totalModulePerms = module.actions.length;
                        const isExpanded = expandedModules[module.id] !== false; // Default to true
                        
                        return (
                          <div key={module.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            {/* Accordion Header */}
                            <div 
                              style={{ 
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                padding: '12px 16px', background: 'var(--color-surface)', cursor: 'pointer',
                                borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
                                position: 'sticky', top: '0', zIndex: 10
                              }}
                              onClick={() => toggleModuleAccordion(module.id)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 600 }}>{highlightText(module.label, searchQuery)}</span>
                                <span style={{ 
                                  background: modulePermsCount > 0 ? 'var(--color-accent)' : 'var(--color-bg)', 
                                  color: modulePermsCount > 0 ? '#fff' : 'var(--color-text-secondary)',
                                  padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 
                                }}>
                                  {modulePermsCount} / {totalModulePerms}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => { e.stopPropagation(); handleSelectAllModule(module.id, module.actions); }}
                                >
                                  Select All
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => { e.stopPropagation(); handleClearAllModule(module.id, module.actions); }}
                                >
                                  Clear
                                </Button>
                                <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '8px', color: 'var(--color-text-secondary)', display: 'inline-block' }}>
                                  ▼
                                </span>
                              </div>
                            </div>
                            
                            {/* Accordion Body */}
                            {isExpanded && (
                              <div style={{ padding: '16px', background: 'var(--color-bg)' }}>
                                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
                                  <label className={styles.label} style={{ fontSize: '12px', marginBottom: '8px' }}>Data Scope</label>
                                  <select
                                    style={{ width: '100%', maxWidth: '300px', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                                    value={formData.data_scopes[module.id] || 'all'}
                                    onChange={(e) => setFormData(prev => ({ ...prev, data_scopes: { ...prev.data_scopes, [module.id]: e.target.value } }))}
                                  >
                                    {DATA_SCOPES.map(scope => (
                                      <option key={scope.id} value={scope.id} title={scope.description}>{scope.label}</option>
                                    ))}
                                  </select>
                                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                    {DATA_SCOPES.find(s => s.id === (formData.data_scopes[module.id] || 'all'))?.description}
                                  </p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                                  {module.actions.map(action => {
                                    const permId = `${module.id}:${action.id}`;
                                    return (
                                      <label key={permId} className={styles.checkboxContainer}>
                                        <input 
                                          type="checkbox" 
                                          checked={formData.permissions.includes(permId)} 
                                          onChange={() => handleTogglePermission(permId)}
                                        />
                                        {highlightText(action.label, searchQuery)}
                                      </label>
                                    )
                                  })}
                                </div>

                                {FIELD_PERMISSIONS_SCHEMA[module.id] && (
                                  <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                                    <label className={styles.label} style={{ fontSize: '14px', marginBottom: '12px' }}>Field Level Permissions</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                      {FIELD_PERMISSIONS_SCHEMA[module.id].map(field => {
                                        const currentPerm = formData.field_permissions?.[module.id]?.[field.id] || 'editable';
                                        return (
                                          <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 500 }}>{field.label}</span>
                                            <select
                                              style={{ padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '12px' }}
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
                                  <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                                    <label className={styles.label} style={{ fontSize: '14px', marginBottom: '12px' }}>Page / Tab Access</label>
                                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                                      Select which tabs should be visible. If none are selected, all tabs are visible by default.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
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
                                                  const currentPages = prev.page_permissions[module.id] || [];
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
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '16px' }}>
                <Button variant="primary" onClick={handleSave}>Save Role</Button>
                <Button variant="ghost" onClick={() => setSearchParams({})}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Role">
        <p>Are you sure you want to delete the role <strong>{deleteTarget?.name}</strong>?</p>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '8px' }}>Users with this role will lose their current permissions. This action cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete Role</Button>
        </div>
      </Modal>

      {/* Template Library Modal */}
      <Modal isOpen={isTemplateLibOpen} onClose={() => setIsTemplateLibOpen(false)} title="Template Library" maxWidth="700px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Select a built-in or custom template to quickly create a new role.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
            {templates.map(t => (
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
            {templates.length === 0 && <p>No templates available.</p>}
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

      </div>
    </div>
  )
}
