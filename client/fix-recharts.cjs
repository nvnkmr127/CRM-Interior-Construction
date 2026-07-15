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
let modifiedCount = 0;

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('<ResponsiveContainer') && !code.includes('minWidth={0}')) {
    code = code.replace(/<ResponsiveContainer /g, '<ResponsiveContainer minWidth={0} minHeight={0} ');
    code = code.replace(/<ResponsiveContainer>/g, '<ResponsiveContainer minWidth={0} minHeight={0}>');
    fs.writeFileSync(file, code);
    modifiedCount++;
    console.log(`Modified: ${file}`);
  }
});

console.log(`Finished. Modified ${modifiedCount} files.`);
