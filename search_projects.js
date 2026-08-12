const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'api', 'mockInterceptor.js');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const matches = [];
lines.forEach((line, index) => {
  if (line.includes('projects') || line.includes('/projects')) {
    matches.push(`${index + 1}: ${line.trim()}`);
  }
});

fs.writeFileSync(path.join(__dirname, 'projects_match.txt'), matches.join('\n'));
console.log('Done');
