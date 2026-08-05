const fs = require('fs');

// 1. password.js
let pw = fs.readFileSync('server/src/services/auth/password.js', 'utf8');
pw = pw.replace(/const allowedChars = \/\^\[a-zA-Z0-9\\\-_\\.\/\!\@#\$%\^&\*\]\+\$\/;/g, '');
pw = pw.replace(/\/\\[!\@#\$%\^&\*\(\)_\+\\-\\=\\\[\\\]\{\};':"\\\\|,\.<>\\/\?\]\+\//g, "/[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]+/");
fs.writeFileSync('server/src/services/auth/password.js', pw);

// 2. automationQueue.js
let aq = fs.readFileSync('server/src/queues/automationQueue.js', 'utf8');
aq = aq.replace(/function isConnectionError\(error\)/g, 'function isConnectionError(err)');
aq = aq.replace(/if \(!err\)/g, 'if (!error)');
fs.writeFileSync('server/src/queues/automationQueue.js', aq);

// 3. financialApprovals.js
let fa = fs.readFileSync('server/src/routes/financialApprovals.js', 'utf8');
fa = fa.replace(/const \{ id \} = req\.params;\n\s*const tenantId = req\.tenantId;/g, 'const { id } = req.params;\n    const tenantId = req.tenantId;');
// Add tenantId if not present after req.params
if (!fa.includes('const tenantId = req.tenantId;')) {
  fa = fa.replace(/const \{ id \} = req\.params;/g, 'const { id } = req.params;\n    const tenantId = req.tenantId;');
}
fa = fa.replace(/ORDER BY CASE WHEN '\$\{sort_by \|\| ''\}'.*?; \/\/ '\$\{sort_by \|\| ''\}'/g, 'ORDER BY c.created_at ASC');
fa = fa.replace(/ANY\(\$\{params\.length \+ 1\}\)/g, 'ANY($${values.length + 1})');
fa = fa.replace(/ANY\(\$1\)/g, 'ANY($$1)');
fs.writeFileSync('server/src/routes/financialApprovals.js', fa);
