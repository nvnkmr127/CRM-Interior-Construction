const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/pages/config/RolesManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Imports
content = content.replace(
  "import CompareRolesModal from './CompareRolesModal'",
  "import CompareRolesModal from './CompareRolesModal'\nimport ImportRolesModal from './ImportRolesModal'\nimport * as XLSX from 'xlsx'"
);

// 2. Add isImportModalOpen state
content = content.replace(
  "const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)",
  "const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)\n  const [isImportModalOpen, setIsImportModalOpen] = useState(false)"
);

// 3. Add handleExportRoles
const exportFunc = `
  const handleExportRoles = () => {
    const exportData = roles.map(r => ({
      Name: r.name,
      Description: r.description,
      Permissions: (r.permissions || []).join(', '),
      DataScopes: JSON.stringify(r.data_scopes || {}),
      EnabledModules: (r.enabled_modules || []).join(', '),
      FieldPermissions: JSON.stringify(r.field_permissions || {}),
      PagePermissions: JSON.stringify(r.page_permissions || {}),
      SecurityPolicies: JSON.stringify(r.security_policies || {})
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roles");
    XLSX.writeFile(workbook, "Roles_Export.xlsx");
  }

  const filteredRoles`;

content = content.replace("const filteredRoles", exportFunc);

// 4. Add Export & Import Buttons
content = content.replace(
  "<Button variant=\"secondary\" onClick={() => setIsCompareModalOpen(true)}>Compare Roles</Button>",
  "<Button variant=\"secondary\" onClick={() => setIsImportModalOpen(true)}>Import</Button>\n              <Button variant=\"secondary\" onClick={handleExportRoles}>Export</Button>\n              <Button variant=\"secondary\" onClick={() => setIsCompareModalOpen(true)}>Compare Roles</Button>"
);

// 5. Add ImportRolesModal component
content = content.replace(
  "schemaActions={schemaActions} \n      />\n    </div>",
  "schemaActions={schemaActions} \n      />\n\n      <ImportRolesModal\n        isOpen={isImportModalOpen}\n        onClose={() => setIsImportModalOpen(false)}\n        roles={roles}\n        schemaActions={schemaActions}\n        onSuccess={fetchRoles}\n      />\n    </div>"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully patched RolesManager.jsx");
