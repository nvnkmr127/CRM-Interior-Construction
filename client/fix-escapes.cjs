const fs = require('fs');
const path = require('path');
const dir = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let code = fs.readFileSync(filePath, 'utf8');
  let original = code;
  
  // Fix escaped backticks
  code = code.replace(/\\`/g, '`');
  // Fix escaped dollars
  code = code.replace(/\\\$/g, '$');

  if (code !== original) {
    fs.writeFileSync(filePath, code);
    console.log('Fixed syntax in ' + f);
  }
});
