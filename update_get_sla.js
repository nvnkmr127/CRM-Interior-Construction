const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const regexGet = /router\.get\('\/', async \(req, res, next\) => \{([\s\S]*?)try \{([\s\S]*?)const \{ rows \} = await pool\.query\(`([\s\S]*?)`\s*,\s*params\);/g;

// Create replacement
const newGet = `router.get('/', async (req, res, next) => {
$1try {$2
    // 1. Auto-escalate pending approvals
    const { rows: pendingRows } = await pool.query(
      "SELECT id, created_at, escalation_level FROM financial_approvals WHERE tenant_id = $1 AND status = 'pending'",
      [tenantId]
    );
    
    for (const row of pendingRows) {
      const hoursPending = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
      let newLevel = 0;
      if (hoursPending >= 72) newLevel = 3;
      else if (hoursPending >= 48) newLevel = 2;
      else if (hoursPending >= 24) newLevel = 1;
      
      if (newLevel > row.escalation_level) {
        await pool.query("UPDATE financial_approvals SET escalation_level = $1 WHERE id = $2", [newLevel, row.id]);
        logActivity(req, 'financial_approval', row.id, 'Escalated', null, JSON.stringify({ old_level: row.escalation_level, new_level: newLevel, hours_pending: Math.floor(hoursPending) }));
      }
    }

    const { rows } = await pool.query(\`$3\`, params);`;

content = content.replace(regexGet, newGet);

fs.writeFileSync(file, content);
console.log('Done GET patch');
