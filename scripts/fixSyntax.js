const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/pages/config/RolesManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const badCode = `
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
  }, [isModalOpen]);`;

const goodCode = `
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);
`;

content = content.replace(badCode, goodCode);

// Now find where to actually put the draftRole and the return statement.
// The main return is at the end of the file or before the render components.
// We need to inject draftRole computation where it was intended: right before the main `return (`.

const returnSearch = `  return (
    <div className={layoutStyles.pageContainer}>`;

const draftRoleInjection = `
  const draftRole = editingRole ? {
    name: formData.name,
    permissions: Array.from(formData.permissions || []),
    data_scopes: formData.data_scopes,
    enabled_modules: formData.enabled_modules,
    page_permissions: formData.page_permissions
  } : null;

  return (
    <div className={layoutStyles.pageContainer}>`;

content = content.replace(returnSearch, draftRoleInjection);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully fixed RolesManager.jsx syntax");
