const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'api', 'mockInterceptor.js');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const results = [];
lines.forEach((line, index) => {
  if (line.includes('users') || line.includes('/users') || line.includes('mockDatabase.users') || line.includes('role')) {
    results.push({ line: index + 1, content: line.trim() });
  }
});

fs.writeFileSync(path.join(__dirname, 'scratch_output.json'), JSON.stringify(results, null, 2));
console.log('Done');
