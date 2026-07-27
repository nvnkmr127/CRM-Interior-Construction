const fs = require('fs');
let c = fs.readFileSync('client/src/api/mockInterceptor.js', 'utf8');

const auditEndpoint = `          } else if (url.match(/\\/audit-logs/) && method === 'get') {
            const urlParams = new URLSearchParams(url.split('?')[1] || '');
            const entityId = urlParams.get('entityId');
            const mockLogs = [
              { id: 'al-1', user_name: 'Pavan Kalyan', action: 'Created', browser: 'Chrome on Windows', ip_address: '192.168.1.5', created_at: new Date(Date.now() - 86400000 * 2).toISOString(), old_value: null, new_value: { name: 'Initial Role', permissions: ['view'] } },
              { id: 'al-2', user_name: 'Super Admin', action: 'Updated', browser: 'Safari on Mac', ip_address: '10.0.0.2', created_at: new Date(Date.now() - 3600000 * 5).toISOString(), old_value: { permissions: ['view'] }, new_value: { permissions: ['view', 'create', 'edit'] } },
              { id: 'al-3', user_name: 'System', action: 'Updated', browser: 'Unknown', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 3600000 * 1).toISOString(), old_value: { data_scopes: {} }, new_value: { data_scopes: { projects: 'department' } } }
            ];
            return [200, { data: mockLogs }];
`;

c = c.replace("} else if (url.match(/\\/roles\\/([^/]+)$/) && method === 'delete') {", auditEndpoint + "} else if (url.match(/\\/roles\\/([^/]+)$/) && method === 'delete') {");

fs.writeFileSync('client/src/api/mockInterceptor.js', c);
console.log('Injected audit logs mock endpoint');
