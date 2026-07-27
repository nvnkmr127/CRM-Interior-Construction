import React, { useState, useMemo } from 'react';
import { Modal, Button } from '../../components/ui';
import styles from './CompareRolesModal.module.css';

export default function CompareRolesModal({ isOpen, onClose, roles = [], schemaModules = [], schemaActions = [] }) {
  const [roleAId, setRoleAId] = useState('');
  const [roleBId, setRoleBId] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(true);

  const roleA = roles.find(r => r.id === roleAId);
  const roleB = roles.find(r => r.id === roleBId);

  const comparisonData = useMemo(() => {
    if (!roleA || !roleB) return [];

    const data = [];

    const getPerms = (role) => (role.permissions || []);
    const getModules = (role) => (role.enabled_modules || []);
    const getScopes = (role) => (role.data_scopes || {});
    
    const aPerms = getPerms(roleA);
    const bPerms = getPerms(roleB);
    const aMods = getModules(roleA);
    const bMods = getModules(roleB);
    const aScopes = getScopes(roleA);
    const bScopes = getScopes(roleB);

    // 1. Modules
    schemaModules.forEach(mod => {
      const inA = aMods.includes(mod.id);
      const inB = bMods.includes(mod.id);
      if (inA !== inB || !showDiffOnly) {
        data.push({
          category: 'Module',
          item: mod.label,
          valA: inA ? 'Enabled' : '-',
          valB: inB ? 'Enabled' : '-',
          diffType: inA && !inB ? 'removed' : (!inA && inB ? 'added' : 'same')
        });
      }

      // Scope
      const scopeA = aScopes[mod.id] || 'N/A';
      const scopeB = bScopes[mod.id] || 'N/A';
      if (scopeA !== scopeB || !showDiffOnly) {
        data.push({
          category: `Scope: ${mod.label}`,
          item: 'Data Scope',
          valA: scopeA,
          valB: scopeB,
          diffType: scopeA !== scopeB ? 'changed' : 'same'
        });
      }

      // Actions
      schemaActions.forEach(act => {
        const permKey = `${mod.id}:${act.id}`;
        const inA = aPerms.includes(permKey);
        const inB = bPerms.includes(permKey);
        if (inA !== inB || !showDiffOnly) {
          data.push({
            category: `Permission: ${mod.label}`,
            item: act.label,
            valA: inA ? 'Yes' : '-',
            valB: inB ? 'Yes' : '-',
            diffType: inA && !inB ? 'removed' : (!inA && inB ? 'added' : 'same')
          });
        }
      });
    });

    return data;
  }, [roleA, roleB, schemaModules, schemaActions, showDiffOnly]);

  const handleExportCSV = () => {
    if (!comparisonData.length) return;
    
    const headers = ['Category', 'Item', `Role A (${roleA.name})`, `Role B (${roleB.name})`, 'Difference'];
    const rows = comparisonData.map(d => [
      `"${d.category}"`,
      `"${d.item}"`,
      `"${d.valA}"`,
      `"${d.valB}"`,
      `"${d.diffType}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Role_Comparison_${roleA.name}_vs_${roleB.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compare Roles" maxWidth="900px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label className={styles.label}>Role A (Base)</label>
            <select 
              className={styles.select} 
              value={roleAId} 
              onChange={e => setRoleAId(e.target.value)}
            >
              <option value="">Select Role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className={styles.label}>Role B (Compare)</label>
            <select 
              className={styles.select} 
              value={roleBId} 
              onChange={e => setRoleBId(e.target.value)}
            >
              <option value="">Select Role...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {roleA && roleB && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={showDiffOnly} 
                  onChange={e => setShowDiffOnly(e.target.value)}
                />
                Show Differences Only
              </label>
              <Button variant="secondary" onClick={handleExportCSV}>Export CSV</Button>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Item</th>
                    <th>{roleA.name} (A)</th>
                    <th>{roleB.name} (B)</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>No differences found.</td>
                    </tr>
                  ) : (
                    comparisonData.map((row, i) => (
                      <tr key={i} className={styles[`diff_${row.diffType}`]}>
                        <td>{row.category}</td>
                        <td>{row.item}</td>
                        <td>{row.valA}</td>
                        <td>{row.valB}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
