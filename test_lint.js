const { execSync } = require('child_process');
const fs = require('fs');

try {
  const out = execSync('node targeted_fix.js', { 
    cwd: 'd:\\Digicloudify softwares\\CRM-Interior-Construction',
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  fs.writeFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\test_lint.txt', out || 'success');
  
  const eslintOut = execSync('npx eslint . --fix', { 
    cwd: 'd:\\Digicloudify softwares\\CRM-Interior-Construction',
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  fs.writeFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\lint_final8.txt', eslintOut || 'success');

} catch (e) {
  const errOutput = (e.stdout ? e.stdout.toString() : '') + '\\n' + (e.stderr ? e.stderr.toString() : '') + '\\n' + e.message;
  fs.writeFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\lint_final8.txt', errOutput);
}
