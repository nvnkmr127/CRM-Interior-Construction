const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/components/finance/ConstructionSummary.jsx');
let content = fs.readFileSync(file, 'utf8');

// Add Material Requests and Advance Payments to the frontend grid
if (!content.includes('Material Requests')) {
  const gridItem = `</div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Material Reqs</span>
          <span className={styles.value}>{formatMoney(data.totalMaterialRequests || 0)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Advances</span>
          <span className={styles.value}>{formatMoney(data.totalAdvances || 0)}</span>
        </div>`;
  content = content.replace(/<\/div>\s*<\/div>\s*\{data\.validationFlags/g, gridItem + '\n      </div>\n\n      {data.validationFlags');
  fs.writeFileSync(file, content);
}

const utilFile = path.join(__dirname, 'server/src/utils/constructionValidator.js');
let utilContent = fs.readFileSync(utilFile, 'utf8');

if (!utilContent.includes('totalMaterialRequests: 0')) {
  utilContent = utilContent.replace('totalMilestones: 0,', 'totalMilestones: 0,\n    totalMaterialRequests: 0,\n    totalAdvances: 0,');
  
  const queries = `
  try {
    const { rows: mr } = await pool.query('SELECT SUM(estimated_cost) as total FROM material_requests WHERE project_id = $1', [projectId]);
    summary.totalMaterialRequests = Number(mr[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: adv } = await pool.query("SELECT SUM(amount) as total FROM site_expenses WHERE project_id = $1 AND expense_type = 'labour_advance'", [projectId]);
    summary.totalAdvances = Number(adv[0]?.total || 0);
  } catch(err){}
  `;
  utilContent = utilContent.replace('// 3. Mathematical Validation Engine', queries + '\n\n  // 3. Mathematical Validation Engine');
  fs.writeFileSync(utilFile, utilContent);
}

console.log('Patched final nouns');
