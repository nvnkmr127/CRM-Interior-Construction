const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

// 1. Add handleDeleteRole
const deleteFunc = `
  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role? This cannot be undone.')) return;
    try {
      await api.delete('/roles/' + roleId);
      setRoles(roles.filter(r => r.id !== roleId));
      if (editingRole && editingRole.id === roleId) {
        setIsModalOpen(false);
        setEditingRole(null);
      }
      toast.success('Role deleted successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete role');
    }
  };

  const handleSave = async () => {`;

c = c.replace('  const handleSave = async () => {', deleteFunc);

// 2. Add Delete to DataTable columns
const dataTableActions = `<Button variant="ghost" size="sm" onClick={() => handleOpenAuditModal(r)}>Audit History</Button>`;
const dataTableActionsWithDelete = `<Button variant="ghost" size="sm" onClick={() => handleOpenAuditModal(r)}>Audit History</Button>
          {r.name !== 'superadmin' && r.name !== 'Super Admin' && (
            <Button variant="danger" size="sm" onClick={() => handleDeleteRole(r.id)}>Delete</Button>
          )}`;

c = c.replace(dataTableActions, dataTableActionsWithDelete);

// 3. Add Delete to the Edit form
const formActions = `<div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '16px' }}>
                <Button variant="primary" onClick={handleSave}>Save Role</Button>
                <Button variant="ghost" onClick={() => setSearchParams({})}>Cancel</Button>
              </div>`;
const formActionsWithDelete = `<div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '16px', alignItems: 'center' }}>
                <Button variant="primary" onClick={handleSave}>Save Role</Button>
                <Button variant="ghost" onClick={() => setSearchParams({})}>Cancel</Button>
                {editingRole && editingRole.name !== 'superadmin' && editingRole.name !== 'Super Admin' && (
                  <Button variant="danger" style={{ marginLeft: 'auto' }} onClick={() => handleDeleteRole(editingRole.id)}>Delete Role</Button>
                )}
              </div>`;

c = c.replace(formActions, formActionsWithDelete);

fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Added Delete button');
