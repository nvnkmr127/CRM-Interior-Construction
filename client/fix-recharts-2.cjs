const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics');

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('minWidth={0} minHeight={0}')) {
    code = code.replace(/minWidth=\{0\} minHeight=\{0\}/g, 'minWidth={1} minHeight={1}');
    fs.writeFileSync(file, code);
    console.log(`Modified to 1: ${file}`);
  }
});

console.log(`Finished fixing recharts warnings.`);
