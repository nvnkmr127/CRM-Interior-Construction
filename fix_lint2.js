const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const before = content;

      content = content.replace(/\bif \(\s*err\b/g, 'if (error');
      content = content.replace(/\(err\)\s*=>/g, '(error) =>');
      content = content.replace(/\(e\)\s*=>/g, '(error) =>');
      content = content.replace(/String\(err\)/g, 'String(error)');
      content = content.replace(/error\.g\./g, 'e.g.');

      if (content !== before) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
processDir(path.join(__dirname, 'server', 'src'));

const financialPath = path.join(__dirname, 'server', 'src', 'routes', 'financialApprovals.js');
if (fs.existsSync(financialPath)) {
  let finContent = fs.readFileSync(financialPath, 'utf8');
  
  // Fix params.length
  finContent = finContent.replace(/ANY\(\$\{params\.length \+ 1\}\)/g, 'ANY($${values.length + 1})');
  
  // Fix tenantId in reject route
  finContent = finContent.replace(/const \{ id \} = req\.params;/g, 'const { id } = req.params;\n    const tenantId = req.tenantId;');
  
  // Fix copy paste sort_by in comments route
  finContent = finContent.replace(/ORDER BY CASE WHEN '\$\{sort_by \|\| ''\}' = 'priority_desc'.*?fa\.updated_at DESC/g, 'ORDER BY c.created_at ASC');
  
  // Empty blocks
  finContent = finContent.replace(/catch\s*\(\s*error\s*\)\s*\{\}/g, 'catch(error){ /* no-op */ }');

  fs.writeFileSync(financialPath, finContent);
}

const dbPoolPath = path.join(__dirname, 'server', 'src', 'db', 'pool.js');
if (fs.existsSync(dbPoolPath)) {
  let pContent = fs.readFileSync(dbPoolPath, 'utf8');
  pContent = pContent.replace(/pool\.on\('error', \(err\)/g, "pool.on('error', (error)");
  fs.writeFileSync(dbPoolPath, pContent);
}

const dbResolverPath = path.join(__dirname, 'server', 'src', 'db', 'tenantResolver.js');
if (fs.existsSync(dbResolverPath)) {
  let rContent = fs.readFileSync(dbResolverPath, 'utf8');
  rContent = rContent.replace(/newPool\.on\('error', \(err\)/g, "newPool.on('error', (error)");
  fs.writeFileSync(dbResolverPath, rContent);
}

const automationQPath = path.join(__dirname, 'server', 'src', 'queues', 'automationQueue.js');
if (fs.existsSync(automationQPath)) {
  let qContent = fs.readFileSync(automationQPath, 'utf8');
  qContent = qContent.replace(/catch \(\s*e\s*\)/g, "catch (error)");
  qContent = qContent.replace(/\.catch\(\(e\)/g, ".catch((error)");
  fs.writeFileSync(automationQPath, qContent);
}
