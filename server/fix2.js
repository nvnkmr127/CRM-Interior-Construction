const fs = require('fs');
let f = fs.readFileSync('src/routes/roles.js', 'utf8');

const target = `queueEmail(tenantId, u.id, u.email, 'Permissions Updated', 'permission_updated', { name: u.name });`;
const replacement = target + `\n        const { logAction } = require('../services/auditLog');\n        await logAction({ tenantId, userId: req.user.userId, action: 'employee.permissions_updated', entity: 'user', entityId: u.id, newValue: { role: rows[0].name } });`;

f = f.replace(target, replacement);
fs.writeFileSync('src/routes/roles.js', f);
console.log('Fixed roles.js');
