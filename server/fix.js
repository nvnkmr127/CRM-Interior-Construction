const fs = require('fs');
let code = fs.readFileSync('src/routes/financialApprovals.js', 'utf8');
code = code.replace(/\$\{sort \|\| ''\}/g, '\$\{sort_by \|\| \'\'\}');
code = code.replace(/sort === 'priority_asc'/g, 'sort_by === \'priority_asc\'');
fs.writeFileSync('src/routes/financialApprovals.js', code);
console.log('Done!');
