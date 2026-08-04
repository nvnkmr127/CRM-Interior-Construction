import React, { useState, useEffect } from 'react';
import { Modal, Input, Badge } from '../../components/ui';
import api from '../../api/axios';
import styles from './RolesManager.module.css'; // Reuse styles for tags

export default function EffectivePermissionViewer({ user, isOpen, onClose }) {
  const [effectivePerms, setEffectivePerms] = useState({});
  const [inheritedPerms, setInheritedPerms] = useState({});
  const [directPerms, setDirectPerms] = useState({});
  const [tempPerms, setTempPerms] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('final');

  useEffect(() => {
    if (isOpen && user) {
      fetchEffectivePermissions();
    }
  }, [isOpen, user]);

  const fetchEffectivePermissions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${user.id}/effective-permissions`);
      const allPerms = res.data.data || {};
      
      setEffectivePerms(allPerms);
      
      const inherited = {};
      const direct = {};
      const temp = {};
      
      Object.entries(allPerms).forEach(([action, sources]) => {
        const iSources = sources.filter(s => s.startsWith('Role:'));
        if (iSources.length > 0) inherited[action] = iSources;
        
        const dSources = sources.filter(s => s === 'Direct');
        if (dSources.length > 0) direct[action] = dSources;
        
        const tSources = sources.filter(s => s.startsWith('Temporary'));
        if (tSources.length > 0) temp[action] = tSources;
      });
      
      setInheritedPerms(inherited);
      setDirectPerms(direct);
      setTempPerms(temp);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSourceBadge = (source) => {
    if (source.startsWith('Role:')) {
      return <Badge variant="neutral" style={{ marginLeft: '8px' }}>{source}</Badge>;
    }
    if (source === 'Direct') {
      return <Badge variant="primary" style={{ marginLeft: '8px' }}>{source}</Badge>;
    }
    if (source.startsWith('Temporary')) {
      return <Badge variant="warning" style={{ marginLeft: '8px' }}>{source}</Badge>;
    }
    return <Badge style={{ marginLeft: '8px' }}>{source}</Badge>;
  };

  const getDisplayData = () => {
    switch (activeTab) {
      case 'inherited': return inheritedPerms;
      case 'direct': return directPerms;
      case 'temporary': return tempPerms;
      case 'final': default: return effectivePerms;
    }
  };

  const filteredPerms = Object.entries(getDisplayData()).filter(([action]) => 
    action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabStyle = (tabId) => ({
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: activeTab === tabId ? '2px solid var(--color-primary)' : '2px solid transparent',
    fontWeight: activeTab === tabId ? 600 : 400,
    color: activeTab === tabId ? 'var(--color-primary)' : 'var(--color-text-secondary)'
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Permission Viewer: ${user?.name}`} maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '16px' }}>
          <div style={tabStyle('inherited')} onClick={() => setActiveTab('inherited')}>Inherited</div>
          <div style={tabStyle('direct')} onClick={() => setActiveTab('direct')}>Direct</div>
          <div style={tabStyle('temporary')} onClick={() => setActiveTab('temporary')}>Temporary</div>
          <div style={tabStyle('final')} onClick={() => setActiveTab('final')}>Final Effective</div>
        </div>

        <Input  
          type="text" 
          placeholder="Search permissions (e.g., 'project:delete')" 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          autoFocus 
        />

        {loading ? (
          <p>Loading permissions...</p>
        ) : (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', maxHeight: '400px', overflowY: 'auto' }}>
            {filteredPerms.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                {searchQuery ? 'No matching permissions found.' : 'No permissions assigned.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--color-surface)', zIndex: 1, borderBottom: '2px solid var(--color-border)' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Permission Action</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPerms.map(([action, sources]) => (
                    <tr key={action} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px', fontWeight: 500 }}>{action}</td>
                      <td style={{ padding: '12px' }}>
                        {sources.map(s => <React.Fragment key={s}>{getSourceBadge(s)}</React.Fragment>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
