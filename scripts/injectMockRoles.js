const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/api/mockInterceptor.js');
let content = fs.readFileSync(filePath, 'utf8');

const injectionString = `
          // --- ROLES & PERMISSIONS MOCK DATA START ---
          
          if (!mockDatabase.users) {
            mockDatabase.users = [
              { id: 'u1', name: 'Alice Admin', email: 'alice@example.com', role_id: 'superadmin' },
              { id: 'u2', name: 'Bob Sales', email: 'bob@example.com', role_id: 'role-sales' },
              { id: 'u3', name: 'Charlie Field', email: 'charlie@example.com', role_id: 'role-field' },
              { id: 'u4', name: 'Diana Field', email: 'diana@example.com', role_id: 'role-field' }
            ];
          }
          if (!mockDatabase.branches) {
            mockDatabase.branches = [
              { id: 'b1', name: 'New York HQ' },
              { id: 'b2', name: 'London Office' },
              { id: 'b3', name: 'Remote' }
            ];
          }
          if (!mockDatabase.departments) {
            mockDatabase.departments = [
              { id: 'd1', name: 'Engineering' },
              { id: 'd2', name: 'Sales' },
              { id: 'd3', name: 'Operations' }
            ];
          }
          if (!mockDatabase.roles) {
            mockDatabase.roles = [
              {
                id: 'superadmin',
                name: 'Super Admin',
                description: 'Full system access',
                permissions: ['*'],
                enabled_modules: [],
                data_scopes: {},
                page_permissions: {},
                field_permissions: {},
                security_policies: {}
              },
              {
                id: 'role-sales',
                name: 'Sales Director',
                description: 'Access to CRM and leads',
                permissions: [
                  'leads:view', 'leads:create', 'leads:edit', 'leads:delete',
                  'quotations:view', 'quotations:create', 'quotations:edit',
                  'dashboard:view'
                ],
                enabled_modules: ['leads', 'quotations', 'dashboard'],
                data_scopes: { 'leads': 'department', 'quotations': 'team' },
                page_permissions: {},
                field_permissions: {},
                security_policies: { allowed_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }
              },
              {
                id: 'role-field',
                name: 'Field Engineer',
                description: 'On-site tasks and reporting',
                permissions: [
                  'projects:view',
                  'dailySiteReports:view', 'dailySiteReports:create', 'dailySiteReports:edit'
                ],
                enabled_modules: ['projects', 'dailySiteReports'],
                data_scopes: { 'projects': 'own', 'dailySiteReports': 'own' },
                page_permissions: {},
                field_permissions: {},
                security_policies: {}
              }
            ];
          }

          if (url.includes('/roles/permissions-schema')) {
            // Handled dynamically by constants, return empty array here to satisfy Promise.all
            responseData.data = { modules: [], actions: [] };
          }
          else if (url.endsWith('/roles') && method === 'get') {
            responseData.data = mockDatabase.roles;
          }
          else if (url.endsWith('/roles') && method === 'post') {
            const newRole = {
              id: 'role-' + Date.now(),
              ...JSON.parse(config.data),
              created_at: new Date().toISOString()
            };
            mockDatabase.roles.push(newRole);
            persistDb();
            responseData.data = newRole;
          }
          else if (url.match(/\\/roles\\/([^/]+)$/) && method === 'patch') {
            const id = url.split('/').pop();
            const idx = mockDatabase.roles.findIndex(r => r.id === id);
            if (idx > -1) {
              mockDatabase.roles[idx] = { ...mockDatabase.roles[idx], ...JSON.parse(config.data) };
              persistDb();
              responseData.data = mockDatabase.roles[idx];
            } else {
              responseData.success = false;
            }
          }
          else if (url.match(/\\/roles\\/([^/]+)$/) && method === 'delete') {
            const id = url.split('/').pop();
            mockDatabase.roles = mockDatabase.roles.filter(r => r.id !== id);
            persistDb();
            responseData.data = { success: true };
          }
          else if (url.endsWith('/users') && method === 'get') {
            responseData.data = mockDatabase.users;
          }
          else if (url.endsWith('/branches') && method === 'get') {
            responseData.data = mockDatabase.branches;
          }
          else if (url.endsWith('/departments') && method === 'get') {
            responseData.data = mockDatabase.departments;
          }
          // --- ROLES & PERMISSIONS MOCK DATA END ---
`;

if (!content.includes('ROLES & PERMISSIONS MOCK DATA START')) {
  content = content.replace('          else if (isMutation) {', injectionString + '\\n          else if (isMutation) {');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully injected mock endpoints');
} else {
  console.log('Mock endpoints already injected');
}
