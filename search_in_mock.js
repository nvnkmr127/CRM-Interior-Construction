const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'api', 'mockInterceptor.js');
const fileContent = fs.readFileSync(filePath, 'utf8');

const lines = fileContent.split('\n');
const matched = [];
lines.forEach((line, index) => {
  if (line.includes('/projects') || line.includes('mockDatabase.projects')) {
    matched.push({ line: index + 1, content: line.trim() });
  }
});

fs.writeFileSync(path.join(__dirname, 'scratch_projects_output.json'), JSON.stringify(matched, null, 2));
console.log('Search complete. Found ' + matched.length + ' lines.');
