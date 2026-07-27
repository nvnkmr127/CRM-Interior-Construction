const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

const badChunk = `
  // Construct draft role for simulator
  const draftRole = editingRole ? {
    name: editForm.name,
    permissions: Array.from(selectedPermissions),
    data_scopes: editForm.data_scopes,
    enabled_modules: editForm.enabled_modules,
    page_permissions: editForm.page_permissions
  } : null;
`;

c = c.replace(badChunk, '');
fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Fixed');
