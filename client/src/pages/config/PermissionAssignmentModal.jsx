import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Input } from '../../components/ui';
import api from '../../api/axios';
import styles from './RolesManager.module.css'; // For common UI styling

export default function PermissionAssignmentModal({ user, isOpen, onClose }) {
  const [schemaModules, setSchemaModules] = useState([]);
  const [schemaActions, setSchemaActions] = useState([]);
  const [directPerms, setDirectPerms] = useState(new Set());
  const [tempPerms, setTempPerms] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Temp perm form state
  const [newTempPerms, setNewTempPerms] = useState(new Set());
  const [expiresDate, setExpiresDate] = useState('');
  const [expiresTime, setExpiresTime] = useState('');
  
  const [activeTab, setActiveTab] = useState('direct'); // direct | temporary

  useEffect(() => {
    if (isOpen) {
      fetchSchema();
      if (user) {
        // Load user's current direct and temp permissions
        const dPerms = typeof user.direct_permissions === 'string' ? JSON.parse(user.direct_permissions || '[]') : (user.direct_permissions || []);
        setDirectPerms(new Set(dPerms));
        
        const tPerms = typeof user.temporary_permissions === 'string' ? JSON.parse(user.temporary_permissions || '[]') : (user.temporary_permissions || []);
        setTempPerms(tPerms);
        
        // Reset temp form
        setNewTempPerms(new Set());
        setExpiresDate('');
        setExpiresTime('');
      }
    }
  }, [isOpen, user]);

  const fetchSchema = async () => {
    setSchemaLoading(true);
    try {
      const res = await api.get('/roles/permissions-schema');
      const data = res.data?.data || res.data;
      if (data) {
        setSchemaModules(data.modules || []);
        setSchemaActions(data.actions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await api.patch(`/users/${user.id}/permissions`, {
        direct_permissions: Array.from(directPerms),
        temporary_permissions: tempPerms
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTempPermission = () => {
    if (newTempPerms.size === 0) {
      alert("Please select at least one permission to grant.");
      return;
    }
    if (!expiresDate || !expiresTime) {
      alert("Please specify both date and time for expiration.");
      return;
    }
    const expiresAt = new Date(`${expiresDate}T${expiresTime}`).toISOString();
    if (new Date(expiresAt) <= new Date()) {
      alert("Expiration must be in the future.");
      return;
    }
    
    setTempPerms(prev => [
      ...prev,
      { permissions: Array.from(newTempPerms), expires_at: expiresAt, notified: false }
    ]);
    
    setNewTempPerms(new Set());
    setExpiresDate('');
    setExpiresTime('');
  };

  const handleRemoveTemp = (index) => {
    setTempPerms(prev => prev.filter((_, i) => i !== index));
  };

  const togglePerm = (permString, set, setFunc) => {
    const next = new Set(set);
    if (next.has(permString)) next.delete(permString);
    else next.add(permString);
    setFunc(next);
  };

  const renderSchemaSelection = (selectedSet, setFunc) => {
    if (schemaLoading) return <p>Loading modules...</p>;
    
    return (
      <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
        {schemaModules.map(mod => (
          <div key={mod.id} style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>{mod.label}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {schemaActions.map(action => {
                const permString = `${mod.id}:${action.id}`;
                const isSelected = selectedSet.has(permString);
                return (
                  <Badge 
                    key={permString}
                    variant={isSelected ? 'primary' : 'neutral'}
                    style={{ cursor: 'pointer', border: isSelected ? 'none' : '1px solid var(--color-border)' }}
                    onClick={() => togglePerm(permString, selectedSet, setFunc)}
                  >
                    {action.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const tabStyle = (id) => ({
    padding: '8px 16px', cursor: 'pointer', fontWeight: 500,
    borderBottom: activeTab === id ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: activeTab === id ? 'var(--color-primary)' : 'var(--color-text-secondary)'
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Permissions: ${user?.name}`} maxWidth="800px">
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div style={tabStyle('direct')} onClick={() => setActiveTab('direct')}>Direct Permissions</div>
        <div style={tabStyle('temporary')} onClick={() => setActiveTab('temporary')}>Temporary Permissions</div>
      </div>

      {activeTab === 'direct' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Select permissions to permanently assign to this user. These override their base role.
          </p>
          {renderSchemaSelection(directPerms, setDirectPerms)}
        </div>
      )}

      {activeTab === 'temporary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Create New Temporary Assignment</h4>
            {renderSchemaSelection(newTempPerms, setNewTempPerms)}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Expires Date</label>
                <Input type="date" value={expiresDate} onChange={e => setExpiresDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>Expires Time</label>
                <Input type="time" value={expiresTime} onChange={e => setExpiresTime(e.target.value)} />
              </div>
              <Button variant="primary" onClick={handleAddTempPermission}>Add to User</Button>
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Active Temporary Assignments</h4>
            {tempPerms.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No active temporary permissions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tempPerms.map((tp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)' }}>
                        Expires: {new Date(tp.expires_at).toLocaleString()}
                      </div>
                      <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {tp.permissions.map(p => <Badge key={p} variant="neutral" style={{ fontSize: '11px' }}>{p}</Badge>)}
                      </div>
                    </div>
                    <Button variant="ghost" size="small" onClick={() => handleRemoveTemp(idx)} style={{ color: 'var(--color-danger)' }}>Revoke</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Permissions'}</Button>
      </div>
    </Modal>
  );
}
