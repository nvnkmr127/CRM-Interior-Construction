const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/pages/config/RolesManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
content = content.replace(
  "import ImportRolesModal from './ImportRolesModal'",
  "import ImportRolesModal from './ImportRolesModal'\nimport PermissionSimulatorModal from './PermissionSimulatorModal'"
);

// 2. Add State
content = content.replace(
  "const [isImportModalOpen, setIsImportModalOpen] = useState(false)",
  "const [isImportModalOpen, setIsImportModalOpen] = useState(false)\n  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)"
);

// 3. Add Simulate button in header
content = content.replace(
  "<Button variant=\"secondary\" onClick={handleExportRoles}>Export</Button>",
  "<Button variant=\"secondary\" onClick={handleExportRoles}>Export</Button>\n              <Button variant=\"secondary\" onClick={() => setIsSimulatorOpen(true)}>Simulator</Button>"
);

// 4. Add Simulate Draft button in Editor form action bar (near the end of the form)
// Let's find: <Button variant="primary" onClick={handleSaveRole}>
// and insert before it.
content = content.replace(
  "<Button variant=\"primary\" onClick={handleSaveRole}>",
  "<Button variant=\"secondary\" onClick={() => setIsSimulatorOpen(true)}>Simulate Draft</Button>\n                <Button variant=\"primary\" onClick={handleSaveRole}>"
);

// 5. Build draft role object for Simulator
const draftRoleLogic = `
  // Construct draft role for simulator
  const draftRole = editingRole ? {
    name: editForm.name,
    permissions: Array.from(selectedPermissions),
    data_scopes: editForm.data_scopes,
    enabled_modules: editForm.enabled_modules,
    page_permissions: editForm.page_permissions
  } : null;

  return (
`;
content = content.replace("return (", draftRoleLogic);

// 6. Add Modal Component
content = content.replace(
  "onSuccess={fetchRoles}\n      />\n    </div>",
  "onSuccess={fetchRoles}\n      />\n\n      <PermissionSimulatorModal\n        isOpen={isSimulatorOpen}\n        onClose={() => setIsSimulatorOpen(false)}\n        roles={roles}\n        schemaModules={schemaModules}\n        schemaActions={schemaActions}\n        draftRole={draftRole}\n      />\n    </div>"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully patched RolesManager.jsx with Simulator");
