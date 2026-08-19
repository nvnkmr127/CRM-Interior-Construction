const fs = require('fs');
const path = require('path');

const clientSrcPath = path.join(__dirname, '../../client/src');
const endpoints = new Set();

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/api\.(get|post|put|delete|patch)\((['"`])(.*?)\2/g);
      if (matches) {
        matches.forEach(m => {
          const urlMatch = m.match(/api\.(?:get|post|put|delete|patch)\((['"`])(.*?)\1/);
          if (urlMatch && urlMatch[2]) {
            endpoints.add(urlMatch[2]);
          }
        });
      }
    }
  }
}

walk(clientSrcPath);
console.log('Endpoints found:', Array.from(endpoints).sort());
