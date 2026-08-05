const { execSync } = require('child_process');
const fs = require('fs');
try {
  execSync('git checkout server/src/queues/automationQueue.js', { cwd: 'd:\\\\Digicloudify softwares\\\\CRM-Interior-Construction' });
  execSync('git checkout server/src/routes/financialApprovals.js', { cwd: 'd:\\\\Digicloudify softwares\\\\CRM-Interior-Construction' });
} catch (e) {
  fs.writeFileSync('d:\\\\Digicloudify softwares\\\\CRM-Interior-Construction\\\\git_out.txt', e.message);
}

// Then manually patch automationQueue.js properly
let aq = fs.readFileSync('d:\\\\Digicloudify softwares\\\\CRM-Interior-Construction\\\\server\\\\src\\\\queues\\\\automationQueue.js', 'utf8');
aq = aq.replace(/function isConnectionError\(err\)/g, 'function isConnectionError(error)');
aq = aq.replace(/if \(!err\)/g, 'if (!error)');
aq = aq.replace(/if \(isConnectionError\(e\)\)/g, 'if (isConnectionError(error))');
aq = aq.replace(/catch \(\s*e\s*\)/g, "catch (error)");
aq = aq.replace(/\.catch\(\(e\)/g, ".catch((error)");
fs.writeFileSync('d:\\\\Digicloudify softwares\\\\CRM-Interior-Construction\\\\server\\\\src\\\\queues\\\\automationQueue.js', aq);

// Let's also patch financialApprovals.js correctly
let fa = fs.readFileSync('d:\\\\Digicloudify softwares\\\\CRM-Interior-Construction\\\\server\\\\src\\\\routes\\\\financialApprovals.js', 'utf8');
fa = fa.replace(/const \{ id \} = req\.params;\n\s+const \{ rejectionReason \} = req\.body;/, "const { id } = req.params;\n    const tenantId = req.tenantId;\n    const { rejectionReason } = req.body;");
fa = fa.replace(/ORDER BY CASE WHEN '\$\{sort_by \|\| ''\}'/g, "ORDER BY c.created_at ASC; // '${sort_by || ''}'");
fa = fa.replace(/ANY\(\$\{params\.length \+ 1\}\)/g, "ANY($${values.length + 1})");
fs.writeFileSync('d:\\\\Digicloudify softwares\\\\CRM-Interior-Construction\\\\server\\\\src\\\\routes\\\\financialApprovals.js', fa);

