const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');
c = c.replace(/\\\\`/g, '`');
c = c.replace(/\\\\\\$/g, '$');
c = c.replace(/\\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Fixed escape sequences');
