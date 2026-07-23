const fs = require('fs');
let f = fs.readFileSync('src/routes/users.js', 'utf8');

const target1 = `const newUserId = rows[0].id;`;
const replacement1 = target1 + `\n    const { logAction } = require('../services/auditLog');\n    await logAction({ tenantId, userId: req.user.userId, action: 'employee.created', entity: 'user', entityId: newUserId });`;

f = f.replace(target1, replacement1);

const target2 = `return success(res, { message: 'User deleted successfully' });`;
const replacement2 = `const { logAction } = require('../services/auditLog');\n    await logAction({ tenantId, userId: req.user.userId, action: 'employee.deleted', entity: 'user', entityId: userIdToDelete });\n    ` + target2;

f = f.replace(target2, replacement2);

fs.writeFileSync('src/routes/users.js', f);
console.log('Fixed users.js created/deleted logs');
