const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import BudgetValidator')) {
  content = content.replace('import ApprovalTimeline from', `import BudgetValidator from '../../components/finance/BudgetValidator';\nimport ApprovalTimeline from`);
}

// Add state to track budget validation in FinancialApprovalsPage
if (!content.includes('const [budgetStates, setBudgetStates] = useState({});')) {
  content = content.replace('export default function FinancialApprovalsPage() {', `export default function FinancialApprovalsPage() {\n  const [budgetStates, setBudgetStates] = useState({});`);
}

// Render BudgetValidator inside the card
const cardBodyRegex = /(<div className=\{styles\.detailRow\}>[\s\S]*?)(<ApprovalTimeline)/;
content = content.replace(cardBodyRegex, `$1<BudgetValidator approvalId={app.id} onValidationComplete={(data) => setBudgetStates(prev => ({...prev, [app.id]: data.status}))} />\n                    $2`);

// Disable Approve button if exceeded
const approveBtnRegex = /<button \n\s*className=\{styles\.approveBtn\}\n\s*onClick=\{([^}]+)\}\n\s*>/g;
content = content.replace(approveBtnRegex, `<button 
                        className={styles.approveBtn}
                        onClick={$1}
                        disabled={budgetStates[app.id] === 'exceeded'}
                        style={budgetStates[app.id] === 'exceeded' ? { opacity: 0.5, cursor: 'not-allowed', background: '#9ca3af' } : {}}
                      >`);

fs.writeFileSync(file, content);
console.log('Frontend patched with BudgetValidator');
