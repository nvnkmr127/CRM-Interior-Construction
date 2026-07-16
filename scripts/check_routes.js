const fs = require('fs');
const path = require('path');
const routesDir = 'server/src/routes';
const controllersDir = 'server/src/controllers';
const missing = [];
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const rf of routeFiles) {
  const code = fs.readFileSync(path.join(routesDir, rf), 'utf8');
  // Match lines like: const myController = require('../controllers/myController');
  const reqRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"](?:.*?\/)*controllers\/([a-zA-Z0-9_]+)['"]\)/g;
  let match;
  while ((match = reqRegex.exec(code)) !== null) {
    const varName = match[1];
    const ctlFileName = match[2] + '.js';
    const ctlPath = path.join(controllersDir, ctlFileName);
    
    if (!fs.existsSync(ctlPath)) {
      missing.push('Missing Controller File: ' + ctlFileName);
      continue;
    }
    
    const ctlCode = fs.readFileSync(ctlPath, 'utf8');
    
    // Find all usages like myController.someHandler
    const usageRegex = new RegExp(varName + '\\\\.([a-zA-Z0-9_]+)', 'g');
    let uMatch;
    while ((uMatch = usageRegex.exec(code)) !== null) {
      const funcName = uMatch[1];
      if (!ctlCode.includes(funcName)) {
        missing.push(rf + ' -> ' + ctlFileName + ' -> ' + funcName);
      }
    }
  }
}
console.log('Missing Mappings:', missing);
