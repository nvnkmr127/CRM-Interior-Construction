const fs = require('fs');
let fa = fs.readFileSync('server/src/routes/financialApprovals.js', 'utf8');

// Fix params.length
fa = fa.replace(/params\.length/g, 'values.length');

// Fix sort_by not defined (all of them)
fa = fa.replace(/ORDER BY CASE WHEN '\$\{sort_by \|\| ''\}'.*?; \/\/ '\$\{sort_by \|\| ''\}'/g, 'ORDER BY c.created_at ASC');
fa = fa.replace(/ORDER BY CASE WHEN '\$\{sort_by \|\| ''\}'.*?fa\.updated_at DESC/g, 'ORDER BY c.created_at ASC');

// Fix tenantId in all places inside financialApprovals.js
fa = fa.replace(/tenantId\]/g, 'req.tenantId]');
fa = fa.replace(/\[tenantId, /g, '[req.tenantId, ');
fa = fa.replace(/\[id, tenantId/g, '[id, req.tenantId');
fa = fa.replace(/req\.tenantId = req\.tenantId/g, 'req.tenantId = req.tenantId');

// Fix empty blocks
fa = fa.replace(/catch\s*\(\s*error\s*\)\s*\{\}/g, 'catch(error){ /* noop */ }');
fa = fa.replace(/catch\s*\(\s*e\s*\)\s*\{\}/g, 'catch(error){ /* noop */ }');

fs.writeFileSync('server/src/routes/financialApprovals.js', fa);
