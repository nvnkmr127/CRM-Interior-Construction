const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'api', 'mockInterceptor.js');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const refs = [];
lines.forEach((line, index) => {
  if (line.includes('mockDatabase.projects')) {
    refs.push(`${index + 1}: ${line.trim()}`);
  }
});

fs.writeFileSync(path.join(__dirname, 'scratch_refs.txt'), refs.join('\n'));
console.log('Done');
