const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import ConstructionSummary')) {
  content = content.replace('import RiskSummary from', `import ConstructionSummary from '../../components/finance/ConstructionSummary';\nimport RiskSummary from`);
}

// Add state to track construction validation
if (!content.includes('const [constructionStates, setConstructionStates] = useState({});')) {
  content = content.replace('const [budgetStates, setBudgetStates] = useState({});', `const [budgetStates, setBudgetStates] = useState({});\n  const [constructionStates, setConstructionStates] = useState({});`);
}

// Render ConstructionSummary inside the card, just above BudgetValidator
const cardBodyRegex = /(<BudgetValidator approvalId=\{app\.id\})/g;
content = content.replace(cardBodyRegex, `<ConstructionSummary approvalId={app.id} onValidationComplete={(state) => setConstructionStates(prev => ({...prev, [app.id]: state}))} />\n                    $1`);

// Update Approve button disabled state
const approveBtnRegex = /disabled=\{budgetStates\[app\.id\] === 'exceeded'\}/g;
content = content.replace(approveBtnRegex, `disabled={budgetStates[app.id] === 'exceeded' || constructionStates[app.id] === 'error'}`);

const styleRegex = /style=\{budgetStates\[app\.id\] === 'exceeded' \? \{ opacity: 0\.5, cursor: 'not-allowed', background: '#9ca3af' \} : \{\}\}/g;
content = content.replace(styleRegex, `style={(budgetStates[app.id] === 'exceeded' || constructionStates[app.id] === 'error') ? { opacity: 0.5, cursor: 'not-allowed', background: '#9ca3af' } : {}}`);


fs.writeFileSync(file, content);
console.log('Frontend patched with ConstructionSummary');
