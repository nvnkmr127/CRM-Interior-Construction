import { useState } from 'react';
import { Modal, Button, Input, Select, DataTable } from '../../components/ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function BulkUserModals({ 
  isOpen, 
  onClose, 
  type, // 'role', 'status', 'add', 'import'
  selectedUsers, 
  roles,
  departments = [],
  allUsers = [],
  onSuccess 
}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  
  // States for specific actions
  const [newRole, setNewRole] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newManager, setNewManager] = useState('');
  
  // State for Bulk Add (Manual)
  const [manualUsers, setManualUsers] = useState([ { name: '', email: '', role_id: '' } ]);
  
  // State for Import
  const [importFile, setImportFile] = useState(null);
  
  const handleBulkUpdate = async (updates) => {
    setLoading(true);
    try {
      const userIds = selectedUsers.map(u => u.id);
      const res = await api.patch('/users/bulk/update', { userIds, updates });
      toast.success(
        <div>
          Bulk update successful. <Button size="small" variant="ghost" onClick={() => revertBulkUpdate(res.data.data.oldStates)}>Undo</Button>
        </div>, 
        { duration: 10000 }
      );
      onSuccess();
    } catch (err) {
      toast.error('Bulk update failed');
    } finally {
      setLoading(false);
    }
  };
  
  const revertBulkUpdate = async (oldStates) => {
    try {
      await api.post('/users/bulk/revert', { oldStates });
      toast.success('Reverted bulk action');
      onSuccess();
    } catch (err) {
      toast.error('Failed to revert');
    }
  };

  const handleBulkAdd = async () => {
    setLoading(true);
    try {
      const validUsers = manualUsers.filter(u => u.name && u.email);
      if (validUsers.length === 0) throw new Error('No valid users');
      
      const res = await api.post('/users/bulk/import', { users: validUsers });
      toast.success(`Successfully added ${res.data.data.created} users`);
      onSuccess();
    } catch (err) {
      toast.error('Bulk add failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return toast.error('Select a CSV file first');
    
    setLoading(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const users = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim());
        const user = {};
        headers.forEach((h, idx) => {
          if (h === 'name') user.name = values[idx];
          if (h === 'email') user.email = values[idx];
          // Simple parsing, assuming role names would need to be mapped to IDs in a real scenario
          // Here we just pass raw text, backend ignores unrecognized or attempts to handle
        });
        if (user.name && user.email) users.push(user);
      }
      
      const res = await api.post('/users/bulk/import', { users });
      toast.success(`Imported ${res.data.data.created} users`);
      onSuccess();
    } catch (err) {
      toast.error('Failed to parse or import CSV');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  let title = '';
  let content = null;
  let footer = null;

  if (type === 'role') {
    title = `Change Role for ${selectedUsers.length} Users`;
    content = (
      <Select 
        label="Select New Role" 
        options={roles.map(r => ({ label: r.name, value: r.id }))} 
        value={newRole}
        onChange={setNewRole} 
      />
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={() => handleBulkUpdate({ role_id: newRole })} disabled={loading || !newRole}>Confirm</Button>
      </>
    );
  } else if (type === 'status') {
    title = `Change Status for ${selectedUsers.length} Users`;
    content = (
      <Select 
        label="Select New Status" 
        options={[
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Suspended', value: 'suspended' }
        ]} 
        value={newStatus}
        onChange={setNewStatus} 
      />
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={() => handleBulkUpdate({ status: newStatus })} disabled={loading || !newStatus}>Confirm</Button>
      </>
    );
  } else if (type === 'department') {
    title = `Change Department for ${selectedUsers.length} Users`;
    content = (
      <Select 
        label="Select New Department" 
        options={departments.map(d => ({ label: d.name, value: d.id }))} 
        value={newDepartment}
        onChange={setNewDepartment} 
      />
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={() => handleBulkUpdate({ department_id: newDepartment })} disabled={loading || !newDepartment}>Confirm</Button>
      </>
    );
  } else if (type === 'manager') {
    title = `Change Manager for ${selectedUsers.length} Users`;
    content = (
      <Select 
        label="Select New Manager" 
        options={allUsers.map(u => ({ label: u.name || u.email, value: u.id }))} 
        value={newManager}
        onChange={setNewManager} 
      />
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={() => handleBulkUpdate({ manager_id: newManager })} disabled={loading || !newManager}>Confirm</Button>
      </>
    );
  } else if (type === 'add') {
    title = 'Bulk Add Users';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {manualUsers.map((u, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Input placeholder="Name" value={u.name} onChange={e => { const nm = [...manualUsers]; nm[i].name = e.target.value; setManualUsers(nm); }} />
            <Input placeholder="Email" value={u.email} onChange={e => { const nm = [...manualUsers]; nm[i].email = e.target.value; setManualUsers(nm); }} />
            <Select 
              options={[{label: 'Select Role...', value: ''}, ...roles.map(r => ({ label: r.name, value: r.id }))]}
              value={u.role_id}
              onChange={val => { const nm = [...manualUsers]; nm[i].role_id = val; setManualUsers(nm); }} 
            />
            <Button variant="ghost" onClick={() => setManualUsers(manualUsers.filter((_, idx) => idx !== i))}>X</Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setManualUsers([...manualUsers, { name: '', email: '', role_id: '' }])}>+ Add Row</Button>
      </div>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleBulkAdd} disabled={loading}>Add Users</Button>
      </>
    );
  } else if (type === 'import') {
    title = 'Import Users (CSV)';
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p>Upload a CSV with <code>name</code> and <code>email</code> columns.</p>
        <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files[0])} />
      </div>
    );
    footer = (
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" onClick={handleImport} disabled={loading || !importFile}>Upload & Import</Button>
      </>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size={type === 'add' ? 'lg' : 'md'}>
      {content}
    </Modal>
  );
}
