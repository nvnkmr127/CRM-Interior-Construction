const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client', 'src', 'pages', 'projects', 'PaymentsTab.jsx');
const content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');
const matches = [];
lines.forEach((line, index) => {
  if (line.includes('setPayments')) {
    matches.push(`${index + 1}: ${line.trim()}`);
  }
});

fs.writeFileSync(path.join(__dirname, 'payments_set.txt'), matches.join('\n'));
console.log('Done');
