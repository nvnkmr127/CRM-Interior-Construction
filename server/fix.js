const fs = require('fs');
let f = fs.readFileSync('src/routes/users.js', 'utf8');

const target = `queueEmail(tenantId, userIdToUpdate, targetUser.email, 'Role Updated', 'role_changed', { name: targetUser.name, newRole: roleRows[0].name });`;
const replacement = target + `\n         const { logAction } = require('../services/auditLog');\n         await logAction({ tenantId, userId: reviewerId, action: 'employee.role_changed', entity: 'user', entityId: userIdToUpdate, newValue: { role: roleRows[0].name } });`;

f = f.replace(target, replacement);
fs.writeFileSync('src/routes/users.js', f);
console.log('Fixed users.js');
