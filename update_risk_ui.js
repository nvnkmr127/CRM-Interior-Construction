const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import RiskSummary')) {
  content = content.replace('import BudgetValidator from', `import RiskSummary from '../../components/finance/RiskSummary';\nimport BudgetValidator from`);
}

// Render RiskSummary inside the card, just above BudgetValidator
const cardBodyRegex = /(<BudgetValidator approvalId=\{app\.id\})/g;
content = content.replace(cardBodyRegex, `<RiskSummary approvalId={app.id} />\n                    $1`);

fs.writeFileSync(file, content);
console.log('Frontend patched with RiskSummary');
