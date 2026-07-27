const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/pages/config/RolesManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Imports
if (!content.includes('import RolesList')) {
  content = content.replace(
    "import ImportRolesModal from './ImportRolesModal'",
    "import ImportRolesModal from './ImportRolesModal'\nimport RolesList from './RolesList'\nimport RoleEditor from './RoleEditor'"
  );
}

// 2. Replace the main render block
const renderStartStr = `  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
      <div className={layoutStyles.configSection}>`;
      
// Wait, is it `className="mx-auto ...` or `className={layoutStyles.pageContainer}`?
// Let's use regex to replace everything between `return (` and `<CompareRolesModal`
const regex = /return\s*\(\s*<div[^>]*>([\s\S]*?)<CompareRolesModal/m;

const newRender = `return (
    <div className={layoutStyles.pageContainer}>
      {!isModalOpen ? (
        <RolesList 
          roles={roles}
          users={users}
          onAddRole={() => {
            setEditingRole(null);
            setFormData({ name: '', description: '', permissions: [], data_scopes: {}, field_permissions: {}, enabled_modules: [], page_permissions: {}, security_policies: {}, change_summary: '' });
            setSearchParams({ action: 'new' });
          }}
          onEditRole={(id) => {
            const role = roles.find(r => r.id === id);
            if (role) {
              setEditingRole(role);
              setFormData({ name: role.name, description: role.description || '', permissions: [...(role.permissions || [])], data_scopes: { ...(role.data_scopes || {}) }, field_permissions: { ...(role.field_permissions || {}) }, enabled_modules: [...(role.enabled_modules || [])], page_permissions: { ...(role.page_permissions || {}) }, security_policies: { ...(role.security_policies || {}) }, change_summary: '' });
              setSearchParams({ edit: id });
            }
          }}
          onDeleteRole={deleteRole}
          onCloneRole={(role) => { setCloneSource(role); setIsCloneModalOpen(true); }}
          onCompareRoles={() => setIsCompareModalOpen(true)}
          onExportRoles={handleExportRoles}
          onOpenTemplateLib={handleOpenTemplateLib}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
        />
      ) : (
        <RoleEditor 
          editingRole={editingRole || {}}
          formData={formData}
          setFormData={setFormData}
          schemaModules={schemaModules}
          schemaActions={schemaActions}
          handleSaveRole={handleSaveRole}
          handleCancelEdit={() => setSearchParams({})}
          setIsSimulatorOpen={setIsSimulatorOpen}
        />
      )}
      
      <CompareRolesModal`;

content = content.replace(regex, newRender);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully injected new UI components");
