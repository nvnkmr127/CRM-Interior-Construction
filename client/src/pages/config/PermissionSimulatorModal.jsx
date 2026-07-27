import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../components/ui';
import styles from './PermissionSimulatorModal.module.css';
import api from '../../api/axios';

export default function PermissionSimulatorModal({ 
  isOpen, 
  onClose, 
  roles = [], 
  schemaModules = [], 
  schemaActions = [],
  draftRole = null // If passed, simulates the unsaved draft
}) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // If a draft is passed, we default to a "Draft Role" selection
  const [selectedRoleId, setSelectedRoleId] = useState(draftRole ? 'draft' : '');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  // Fetch users for the dropdown
  useEffect(() => {
    if (isOpen && users.length === 0) {
      api.get('/users').then(res => {
        if (res.data && res.data.success) {
          setUsers(res.data.payload || []);
        }
      }).catch(err => console.error("Failed to fetch users", err));
    }
  }, [isOpen, users.length]);

  // If draftRole changes (reopened), reset to draft
  useEffect(() => {
    if (isOpen && draftRole) {
      setSelectedRoleId('draft');
    }
  }, [isOpen, draftRole]);

  const activeRole = useMemo(() => {
    if (selectedRoleId === 'draft' && draftRole) return draftRole;
    return roles.find(r => r.id === selectedRoleId) || null;
  }, [selectedRoleId, draftRole, roles]);

  const activeModuleSchema = useMemo(() => {
    return schemaActions.find(m => m.id === selectedModuleId) || null;
  }, [selectedModuleId, schemaActions]);

  const simulationResults = useMemo(() => {
    if (!activeRole) return null;

    const rolePerms = activeRole.permissions || [];
    const roleModules = activeRole.enabled_modules || [];
    const roleScopes = activeRole.data_scopes || {};
    const rolePages = activeRole.page_permissions || {};

    const isGlobalAdmin = rolePerms.includes('*');

    const results = {
      globalAdmin: isGlobalAdmin,
      visibleModules: [],
      visiblePages: [],
      allowedActions: [],
      dataScope: 'None'
    };

    // Visible Modules
    results.visibleModules = schemaModules.filter(m => isGlobalAdmin || roleModules.includes(m.id));

    if (activeModuleSchema) {
      const modId = activeModuleSchema.id;
      
      // Visible Pages
      const modPagesSchema = schemaModules.find(m => m.id === modId)?.pages || [];
      if (isGlobalAdmin) {
         results.visiblePages = modPagesSchema;
      } else {
         const enabledPagesForMod = rolePages[modId] || [];
         results.visiblePages = modPagesSchema.filter(p => enabledPagesForMod.includes(p.id));
      }

      // Allowed Actions
      results.allowedActions = activeModuleSchema.actions.filter(a => {
        return isGlobalAdmin || rolePerms.includes(`${modId}:${a.id}`);
      });

      // Data Scope Interpretation
      const scopeVal = roleScopes[modId] || 'all';
      if (isGlobalAdmin) {
        results.dataScope = 'All Records Globally (Superadmin Override)';
      } else {
        switch (scopeVal) {
          case 'all': results.dataScope = 'All Records in Workspace'; break;
          case 'branch': results.dataScope = 'Records within Assigned Branch(es)'; break;
          case 'department': results.dataScope = 'Records within Assigned Department(es)'; break;
          case 'team': results.dataScope = 'Records Assigned to User or their Team'; break;
          case 'own': results.dataScope = 'Only Records Owned/Created by User'; break;
          default: results.dataScope = 'Unknown / None';
        }
      }
    }

    return results;
  }, [activeRole, activeModuleSchema, schemaModules]);


  const handleUserChange = (e) => {
    const uid = e.target.value;
    setSelectedUserId(uid);
    const user = users.find(u => u.id === uid);
    if (user && user.role_id) {
       setSelectedRoleId(user.role_id);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permission Simulator" maxWidth="800px">
      <div className={styles.container}>
        
        {/* Controls */}
        <div className={styles.controlsGrid}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Select User (Optional)</label>
            <select className={styles.select} value={selectedUserId} onChange={handleUserChange}>
              <option value="">-- No specific user --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Evaluating Role</label>
            <select className={styles.select} value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}>
              <option value="">-- Select Role --</option>
              {draftRole && <option value="draft">🔥 Unsaved Draft: {draftRole.name || 'New Role'}</option>}
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Target Module</label>
            <select className={styles.select} value={selectedModuleId} onChange={e => setSelectedModuleId(e.target.value)}>
              <option value="">-- Select Module to Test --</option>
              {schemaModules.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        {!activeRole ? (
          <div className={styles.emptyState}>Select a Role to begin simulation.</div>
        ) : (
          <div className={styles.resultsArea}>
            <h3 className={styles.resultsTitle}>
              Simulation Results for <span className={styles.highlight}>{activeRole.name || 'Draft Role'}</span>
            </h3>
            
            {simulationResults?.globalAdmin && (
              <div className={styles.alertSuperadmin}>
                <strong>Superadmin Warning:</strong> This role has the wildcard <code>*</code> permission. They have unrestricted access to all modules, pages, actions, and data scopes.
              </div>
            )}

            <div className={styles.grid2Col}>
              <div className={styles.resultCard}>
                <h4 className={styles.cardTitle}>Global Module Visibility</h4>
                <div className={styles.cardContent}>
                  {simulationResults.visibleModules.length > 0 ? (
                    <div className={styles.badgeList}>
                      {simulationResults.visibleModules.map(m => (
                        <span key={m.id} className={styles.badgeSolid}>{m.label}</span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.textMuted}>No modules visible.</span>
                  )}
                </div>
              </div>

              <div className={styles.resultCard}>
                <h4 className={styles.cardTitle}>Module-Specific Testing</h4>
                <div className={styles.cardContent}>
                  {!activeModuleSchema ? (
                    <span className={styles.textMuted}>Select a Target Module above to test specific access.</span>
                  ) : (
                    <div className={styles.moduleSpecific}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Visible Sub-Pages:</span>
                        {simulationResults.visiblePages.length > 0 ? (
                          <div className={styles.badgeListSmall}>
                            {simulationResults.visiblePages.map(p => <span key={p.id} className={styles.badgeOutline}>{p.label}</span>)}
                          </div>
                        ) : (
                          <span className={styles.textError}>None (Cannot access UI)</span>
                        )}
                      </div>

                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Allowed Actions/Buttons:</span>
                        {simulationResults.allowedActions.length > 0 ? (
                          <div className={styles.badgeListSmall}>
                            {simulationResults.allowedActions.map(a => <span key={a.id} className={styles.badgeOutlineSuccess}>{a.label}</span>)}
                          </div>
                        ) : (
                          <span className={styles.textError}>Read-only or No Access</span>
                        )}
                      </div>

                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Accessible Records:</span>
                        <span className={styles.textHighlight}>{simulationResults.dataScope}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
