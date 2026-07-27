const fs = require('fs');
let content = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

const badChunk = `
  // Construct draft role for simulator
  const draftRole = editingRole ? {
    name: editForm.name,
    permissions: Array.from(selectedPermissions),
    data_scopes: editForm.data_scopes,
    enabled_modules: editForm.enabled_modules,
    page_permissions: editForm.page_permissions
  } : null;

  return (
) => window.removeEventListener('keydown', handleKeyDown);
`;

const goodChunk = `
    return () => window.removeEventListener('keydown', handleKeyDown);
`;

content = content.replace(badChunk, goodChunk);
fs.writeFileSync('client/src/pages/config/RolesManager.jsx', content);
