const { exec } = require('child_process');
const fs = require('fs');

exec('npx eslint .', (err, stdout, stderr) => {
  fs.writeFileSync('lint_output2.txt', stdout + '\n' + stderr);
});
