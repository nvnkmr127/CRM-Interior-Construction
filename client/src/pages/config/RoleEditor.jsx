import React, { useState, useEffect, useMemo } from 'react';
import styles from './RoleEditor.module.css';
import { Button, Input } from '../../components/ui';

import { useConfirm } from '../../store/confirmContext';

const TimeSelect = ({ value, onChange }) => {
  const { confirm } = useConfirm();

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
    if (newAmpm === 'PM' && h !== 12) h += 12;
    if (newAmpm === 'AM' && h === 12) h = 0;
    
    onChange(`${h.toString().padStart(2, '0')}:${newMin}`);
  };

  const selectStyle = {
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select 
        style={selectStyle}
        value={hour} 
        onChange={e => handleUpdate(e.target.value, min, ampm)}
      >
        {Array.from({length: 12}, (_, i) => i + 1).map(h => {
          const hs = h.toString().padStart(2, '0');
          return <option key={hs} value={hs}>{hs}</option>
        })}
      </select>
      <span style={{ fontWeight: 600 }}>:</span>
      <select 
        style={selectStyle}
        value={min} 
        onChange={e => handleUpdate(hour, e.target.value, ampm)}
      >
        {Array.from({length: 60}, (_, i) => i).map(m => {
          const ms = m.toString().padStart(2, '0');
          return <option key={ms} value={ms}>{ms}</option>
        })}
      </select>
      <select 
        style={{ ...selectStyle, marginLeft: '4px' }}
        value={ampm} 
        onChange={e => handleUpdate(hour, min, e.target.value)}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default function RoleEditor({
  editingRole,
  formData,
  setFormData,
  schemaModules,
  schemaActions,
  schemaFieldPermissions = {},
  schemaPagePermissions = {},
  handleSaveRole,
  handleCancelEdit,
  setIsSimulatorOpen
}) {
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const [existingRoles, setExistingRoles] = useState([]);
  useEffect(() => {
    import('../../api/axios').then(module => {
      const api = module.default;
      api.get('/roles')
        .then(res => {
          const r = res.data?.data || res.data;
          setExistingRoles(Array.isArray(r) ? r : []);
        })
        .catch(() => setExistingRoles([]));
    });
  }, []);

  const handleCloneRole = async (roleId) => {
    const roleToClone = existingRoles.find(r => r.id === roleId);
    if (!roleToClone) return;
    if (!await confirm(`Are you sure you want to overwrite current permissions with the '${roleToClone.name}' role template?`)) return;
    
    setIsDirty(true);
    setFormData(prev => ({
      ...prev,
      permissions: roleToClone.permissions || [],
      enabled_modules: roleToClone.enabled_modules || [],
      data_scopes: roleToClone.data_scopes || {},
      page_permissions: roleToClone.page_permissions || {},
      field_permissions: roleToClone.field_permissions || {},
      security_policies: roleToClone.security_policies || {}
    }));
  };

  // Group modules by category (mocking category if not present)
  const categorizedModules = useMemo(() => {
    const groups = {};
    schemaModules.forEach(mod => {
      const cat = mod.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(mod);
    });
    return groups;
  }, [schemaModules]);

  // Toggle category
  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Expand all by default initially
  useEffect(() => {
    const initial = {};
    Object.keys(categorizedModules).forEach(cat => initial[cat] = true);
    setExpandedCategories(initial);
  }, [categorizedModules]);

  // Handle changes and mark dirty
  const handlePermissionChange = (moduleId, actionId, checked) => {
    setIsDirty(true);
    const permKey = `${moduleId}:${actionId}`;
    let newPerms = [...(formData.permissions || [])];
    
    if (newPerms.includes('*')) return;

    if (checked) {
      if (!newPerms.includes(permKey)) newPerms.push(permKey);
    } else {
      newPerms = newPerms.filter(p => p !== permKey);
    }

    setFormData(prev => ({ ...prev, permissions: newPerms }));
  };

  const toggleModule = (moduleId, checked) => {
    setIsDirty(true);
    let newMods = [...(formData.enabled_modules || [])];
    if (checked) {
      if (!newMods.includes(moduleId)) newMods.push(moduleId);
    } else {
      newMods = newMods.filter(m => m !== moduleId);
    }
    setFormData(prev => ({ ...prev, enabled_modules: newMods }));
  };

  const togglePagePermission = (moduleId, pageId) => {
    setIsDirty(true);
    const current = (formData.page_permissions || {})[moduleId] || [];
    let updated;
    if (current.includes(pageId)) {
      updated = current.filter(id => id !== pageId);
    } else {
      updated = [...current, pageId];
    }
    setFormData(prev => ({
      ...prev,
      page_permissions: {
        ...prev.page_permissions,
        [moduleId]: updated
      }
    }));
  };

  const handleFieldPermissionChange = (module, field, newLevel) => {
    setIsDirty(true);
    setFormData(prev => {
      const updatedModuleFields = { ...(prev.field_permissions?.[module] || {}) };
      updatedModuleFields[field] = newLevel;
      return {
        ...prev,
        field_permissions: {
          ...prev.field_permissions,
          [module]: updatedModuleFields
        }
      };
    });
  };

  // Standard action badges
  const getBadgeStyle = (actionId, isActive) => {
    if (!isActive) return styles.badgeInactive;
    if (actionId.includes('view') || actionId.includes('read')) return styles.badgeView;
    if (actionId.includes('create') || actionId.includes('add')) return styles.badgeCreate;
    if (actionId.includes('edit') || actionId.includes('update')) return styles.badgeEdit;
    if (actionId.includes('delete') || actionId.includes('remove')) return styles.badgeDelete;
    if (actionId.includes('approve') || actionId.includes('verify')) return styles.badgeApprove;
    return styles.badgeDefault;
  };

  // Filter modules based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categorizedModules;
    const lowerQuery = searchQuery.toLowerCase();
    const result = {};
    
    Object.entries(categorizedModules).forEach(([cat, mods]) => {
      const filteredMods = mods.filter(m => 
        m.label.toLowerCase().includes(lowerQuery) || 
        m.id.toLowerCase().includes(lowerQuery) ||
        (schemaActions.find(sa => sa.id === m.id)?.actions || []).some(a => a.label.toLowerCase().includes(lowerQuery))
      );
      if (filteredMods.length > 0) {
        result[cat] = filteredMods;
      }
    });
    return result;
  }, [categorizedModules, searchQuery, schemaActions]);

  const handleKeyDown = (e, callback) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  };

  const isGlobalAdmin = (formData.permissions || []).includes('*');

  return (
    <div className={styles.editorContainer}>
      <div className={styles.stickyHeader}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={handleCancelEdit}>&larr; Back</button>
            <h2 className={styles.title}>{editingRole.id ? 'Edit Role' : 'Create Role'}</h2>
          </div>
          <div className={styles.headerRight}>
            <Button variant="secondary" onClick={async () => setIsSimulatorOpen(true)}>Simulate Draft</Button>
            <Button variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveRole}>Save Role</Button>
          </div>
        </div>

        {isDirty && (
          <div className={styles.unsavedBanner} role="alert">
            <span className={styles.unsavedIcon}>⚠️</span>
            You have unsaved changes. Remember to save your role before leaving.
          </div>
        )}

        <div className={styles.tabsContainer}>
          {['general', 'pages', 'fields', 'security', 'audit'].map(tab => (
            <button
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
              onClick={async () => setActiveTab(tab)}
            >
              {tab === 'general' ? 'General & Matrix' :
               tab === 'pages' ? 'Page Permissions' :
               tab === 'fields' ? 'Field Permissions' :
               tab === 'security' ? 'Security Policies' : 'Audit'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'general' && (
          <div className={styles.matrixArea}>
            <div className={styles.formStack}>
              <div className={styles.inputGroup}>
                <label>Role Name <span className={styles.required}>*</span></label>
                <Input 
                  value={formData.name || ''} 
                  onChange={e => { setIsDirty(true); setFormData(p => ({...p, name: e.target.value})) }} 
                  placeholder="e.g. Sales Manager"
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Description</label>
                <Input 
                  value={formData.description || ''} 
                  onChange={e => { setIsDirty(true); setFormData(p => ({...p, description: e.target.value})) }} 
                  placeholder="Brief description of this role's responsibilities"
                />
              </div>
              
              {!editingRole.id && existingRoles.length > 0 && (
                <div className={styles.inputGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Clone Permissions From Existing Role</label>
                  <select 
                    className={styles.scopeSelect} 
                    style={{ width: '100%', maxWidth: '400px' }}
                    onChange={e => handleCloneRole(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Select a role to copy permissions...</option>
                    {existingRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={styles.searchBar}>
              <Input 
                placeholder="Search modules, pages, or actions (Ctrl+F)..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                icon="🔍"
              />
            </div>
            
            <div className={styles.matrixHeaders}>
              <div className={styles.colModule}>Module</div>
              <div className={styles.colScope}>Data Scope</div>
              <div className={styles.colActions}>Permissions</div>
            </div>
          
            <div className={styles.matrixBody}>
              {Object.entries(filteredCategories).length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No modules found matching "{searchQuery}"</p>
                </div>
              ) : (
                Object.entries(filteredCategories).map(([category, modules]) => (
                  <div key={category} className={styles.categoryGroup}>
                    <div 
                      className={styles.categoryHeader} 
                      onClick={async () => toggleCategory(category)}
                      tabIndex={0}
                      onKeyDown={(e) => handleKeyDown(e, () => toggleCategory(category))}
                      role="button"
                    >
                      <span className={styles.categoryTitle}>{category}</span>
                      <span className={styles.categoryCount}>({modules.length} modules)</span>
                      <span className={styles.expandIcon}>
                        {expandedCategories[category] ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    {expandedCategories[category] && (
                      <div className={styles.categoryContent}>
                        {modules.map(module => {
                          const isModuleEnabled = (formData.enabled_modules || []).includes(module.id);
                          const modActions = schemaActions.find(sa => sa.id === module.id)?.actions || [];

                          return (
                            <div key={module.id} className={styles.matrixRow}>
                              <div className={styles.colModule}>
                                <label className={styles.checkboxLabel}>
                                  <input 
                                    type="checkbox"
                                    checked={isGlobalAdmin || isModuleEnabled}
                                    disabled={isGlobalAdmin}
                                    onChange={(e) => toggleModule(module.id, e.target.checked)}
                                    className={styles.checkbox}
                                  />
                                  <span className={styles.moduleName}>{module.label}</span>
                                </label>
                              </div>
                              
                              <div className={styles.colScope}>
                                <select 
                                  className={styles.scopeSelect}
                                  value={(formData.data_scopes || {})[module.id] || 'team'}
                                  onChange={(e) => {
                                    setIsDirty(true);
                                    setFormData(p => ({
                                      ...p, 
                                      data_scopes: { ...p.data_scopes, [module.id]: e.target.value }
                                    }));
                                  }}
                                  disabled={isGlobalAdmin || !isModuleEnabled}
                                >
                                  <option value="all">Everything</option>
                                  <option value="branch">Branch Only</option>
                                  <option value="department">Department Only</option>
                                  <option value="team">Team Only</option>
                                  <option value="own">Own Records</option>
                                </select>
                              </div>

                              <div className={styles.colActions}>
                                {modActions.length === 0 ? (
                                  <span className={styles.noActions}>No granular actions</span>
                                ) : (
                                  <div className={styles.badgeContainer}>
                                    {modActions.map(action => {
                                      const isActive = isGlobalAdmin || (formData.permissions || []).includes(`${module.id}:${action.id}`);
                                      return (
                                        <div 
                                          key={action.id}
                                          className={`${styles.badge} ${getBadgeStyle(action.id, isActive)} ${!isModuleEnabled && !isGlobalAdmin ? styles.badgeDisabled : ''}`}
                                          onClick={async () => {
                                            if (isGlobalAdmin || !isModuleEnabled) return;
                                            handlePermissionChange(module.id, action.id, !isActive);
                                          }}
                                        >
                                          {action.label}
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
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'pages' && (
          <div className={styles.advancedSection}>
            <h3 className={styles.sectionTitle}>Page & Tab Permissions</h3>
            <p className={styles.sectionDesc}>Control which specific tabs and sub-pages users can see within enabled modules.</p>
            {isGlobalAdmin ? (
              <div className={styles.alertSuperadmin}>Superadmin has access to all pages. Granular page permissions are bypassed.</div>
            ) : (
              <div className={styles.grid2Col}>
                {Object.keys(schemaPagePermissions).map(module => (
                  <div key={module} className={styles.configCard}>
                    <h4 className={styles.cardHeader}>{module.charAt(0).toUpperCase() + module.slice(1)} Module</h4>
                    <div className={styles.cardBody}>
                      {schemaPagePermissions[module].map(page => {
                        const isChecked = (formData.page_permissions?.[module] || []).includes(page.id);
                        return (
                          <label key={page.id} className={styles.checkboxLabel}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => togglePagePermission(module, page.id)}
                            />
                            {page.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'fields' && (
          <div className={styles.advancedSection}>
            <h3 className={styles.sectionTitle}>Field-Level Permissions</h3>
            <p className={styles.sectionDesc}>Restrict visibility or editability of specific sensitive fields.</p>
            {isGlobalAdmin ? (
              <div className={styles.alertSuperadmin}>Superadmin has Read/Write access to all fields.</div>
            ) : (
              <div className={styles.grid2Col}>
                {Object.keys(schemaFieldPermissions).map(module => (
                  <div key={module} className={styles.configCard}>
                    <h4 className={styles.cardHeader}>{module.charAt(0).toUpperCase() + module.slice(1)} Module</h4>
                    <table className={styles.fieldTable}>
                      <thead>
                        <tr>
                          <th>Field</th><th>Hidden</th><th>Read-Only</th><th>Read/Write</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schemaFieldPermissions[module].map(field => {
                          const level = formData.field_permissions?.[module]?.[field.id] || 'rw';
                          return (
                            <tr key={field.id}>
                              <td>{field.label}</td>
                              <td><input type="radio" checked={level === 'hidden'} onChange={() => handleFieldPermissionChange(module, field.id, 'hidden')} /></td>
                              <td><input type="radio" checked={level === 'ro'} onChange={() => handleFieldPermissionChange(module, field.id, 'ro')} /></td>
                              <td><input type="radio" checked={level === 'rw'} onChange={() => handleFieldPermissionChange(module, field.id, 'rw')} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className={styles.advancedSection}>
            <h3 className={styles.sectionTitle}>Security Policies</h3>
            <p className={styles.sectionDesc}>Configure access restrictions like time, IP, and device enforcement.</p>
            
            <div className={styles.configCard}>
              <div className={styles.cardBody} style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  
                  <div className={styles.inputGroup}>
                    <label style={{ fontSize: '14px', marginBottom: '4px' }}>Allowed Login Days</label>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px', marginTop: 0 }}>Select the days this role is allowed to access the system. Leave all unselected to allow any day.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                        const isSelected = (formData.security_policies?.allowed_days || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={async () => {
                              setIsDirty(true);
                              let newDays = [...(formData.security_policies?.allowed_days || [])];
                              if (isSelected) {
                                newDays = newDays.filter(d => d !== day);
                              } else {
                                newDays.push(day);
                              }
                              setFormData(p => ({ ...p, security_policies: { ...p.security_policies, allowed_days: newDays } }));
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: isSelected ? '#fff' : 'var(--color-text)',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '600px' }}>
                    <div className={styles.inputGroup}>
                      <label style={{ fontSize: '14px' }}>Login Time (Start)</label>
                      <TimeSelect 
                        value={formData.security_policies?.allowed_time_start || ''}
                        onChange={val => {
                          setIsDirty(true);
                          setFormData(p => ({ ...p, security_policies: { ...p.security_policies, allowed_time_start: val } }));
                        }}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label style={{ fontSize: '14px' }}>Login Time (End)</label>
                      <TimeSelect 
                        value={formData.security_policies?.allowed_time_end || ''}
                        onChange={val => {
                          setIsDirty(true);
                          setFormData(p => ({ ...p, security_policies: { ...p.security_policies, allowed_time_end: val } }));
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className={styles.advancedSection}>
            <h3 className={styles.sectionTitle}>Change Summary</h3>
            <p className={styles.sectionDesc}>Provide a reason for these role modifications. This will be logged in the Version History.</p>
            <div className={styles.inputGroup}>
              <textarea 
                className={styles.textarea}
                rows="4"
                placeholder="e.g. Added Delete permission for Leads module, restricted scope to Team Only."
                value={formData.change_summary || ''}
                onChange={e => {
                  setIsDirty(true);
                  setFormData(p => ({ ...p, change_summary: e.target.value }));
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
