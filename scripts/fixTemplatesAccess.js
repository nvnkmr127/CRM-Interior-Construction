const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

c = c.replace('{templates.map(t =>', '{BUILT_IN_TEMPLATES.map(t =>');
c = c.replace('{templates.length === 0', '{BUILT_IN_TEMPLATES.length === 0');

fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Fixed');
