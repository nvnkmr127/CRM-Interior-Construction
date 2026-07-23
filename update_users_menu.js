const fs = require('fs');

const path = 'client/src/pages/config/UsersManager.jsx';
let content = fs.readFileSync(path, 'utf8');

// I will insert Super Admin specific context menu items right after Offboard Employee
const contextMenuActions = `
              { label: 'Offboard Employee', danger: true, onClick: () => setOffboardingTarget(contextMenu.user) },
              { divider: true },
              { label: '🔥 Login as User (Impersonate)', onClick: async () => {
                if(window.confirm('WARNING: All actions performed will be logged against your audit trail. Proceed?')) {
                  await api.post(\`/superadmin/impersonate/\${contextMenu.user.id}\`);
                  toast.success('Impersonation mode activated');
                }
              } },
              { label: '🔥 Force Logout All Sessions', onClick: async () => {
                if(window.confirm('Force terminate all active sessions for this user?')) {
                  await api.post(\`/superadmin/force-logout/\${contextMenu.user.id}\`);
                  toast.success('Sessions terminated');
                }
              } },
              { label: '🔥 Emergency Account Lock', danger: true, onClick: async () => {
                if(window.confirm('CRITICAL: Lock this account immediately?')) {
                  await api.post(\`/superadmin/emergency-lock/\${contextMenu.user.id}\`);
                  toast.success('Account locked');
                  fetchUsers();
                }
              } }
`;

content = content.replace("{ label: 'Offboard Employee', danger: true, onClick: () => setOffboardingTarget(contextMenu.user) }", contextMenuActions);

fs.writeFileSync(path, content, 'utf8');
console.log('Done UsersManager');
