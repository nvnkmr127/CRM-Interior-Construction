const fs = require('fs');
let data = fs.readFileSync('src/routes/financialApprovals.js', 'utf8');

// The bad line starts with: 'ORDER BY CASE WHEN '${
data = data.split("'ORDER BY CASE WHEN '${").join("`ORDER BY CASE WHEN '${");

// The bad line ends with: END ${sort === 'priority_asc' ? 'ASC' : 'DESC'}, fa.updated_at DESC, fa.id DESC';
data = data.split("fa.id DESC';").join("fa.id DESC`;");
data = data.split("fa.id ASC';").join("fa.id ASC`;");
data = data.split("fa.updated_at DESC';").join("fa.updated_at DESC`;");

fs.writeFileSync('src/routes/financialApprovals.js', data);
console.log('Fixed syntax errors in financialApprovals.js');
