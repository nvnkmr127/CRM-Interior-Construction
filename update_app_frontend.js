const fs = require('fs');

const path = 'client/src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

const importStr = "const SuperAdminSettings = lazy(() => import('./pages/config/SuperAdminSettings'))\n";
content = content.replace("const RolesManager = lazy(() => import('./pages/config/RolesManager'))", "const RolesManager = lazy(() => import('./pages/config/RolesManager'))\n" + importStr);

const routeStr = `          <Route path="config" element={<ConfigPage />}>
            <Route index element={<Navigate to="team-members" replace />} />
            <Route path="super-admin" element={<ProtectedRoute roles={['superadmin']}><SuperAdminSettings /></ProtectedRoute>} />`;

content = content.replace(/<Route path="config" element=\{<ConfigPage \/>\}>\s*<Route index element=\{<Navigate to="team-members" replace \/>\} \/>/, routeStr);

fs.writeFileSync(path, content, 'utf8');
console.log('App updated');
