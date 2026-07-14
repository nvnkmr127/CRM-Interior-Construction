const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const SECTIONS = [
  { key: 'lead_kpis', comment: '{/* ── Lead KPI Cards ── */}' },
  { key: 'funnel', comment: '{/* ── Funnel Analytics ── */}' },
  { key: 'revenue_kpis', comment: '{/* ── Revenue KPI Cards ── */}' },
  { key: 'revenue_charts', comment: '{/* ── Revenue Charts Side-by-Side ── */}' },
  { key: 'sales_cycle', comment: '{/* ── Sales Cycle & Stage Aging ── */}' },
  { key: 'pipeline_vel', comment: '{/* ── Pipeline Velocity ── */}' },
  { key: 'lost_leads', comment: '{/* ── Lost Leads Analytics ── */}' },
  { key: 'win_rate', comment: '{/* ── Win Rate & Leaderboard ── */}' },
  { key: 'sla', comment: '{/* ── SLA Dashboard ── */}' },
  { key: 'ai_revenue', comment: '{/* ── AI Revenue Insights ── */}' },
  { key: 'ai_predict', comment: '{/* ── AI Lead Prediction ── */}' },
  { key: 'sales_prod', comment: '{/* ── Sales Productivity ── */}' },
  { key: 'marketing', comment: '{/* ── Marketing Analytics ── */}' },
  { key: 'geo', comment: '{/* ── Geographic Analytics ── */}' },
  { key: 'customer', comment: '{/* ── Customer Analytics ── */}' },
  { key: 'financial', comment: '{/* ── Financial Analytics ── */}' },
  { key: 'forecast', comment: '{/* ── Revenue Forecasting ── */}' },
  { key: 'executive', comment: '{/* ── Executive Summary ── */}' }
];

let newContent = content;

if (!newContent.includes('key="lead_kpis"')) {
  for (let i = 0; i < SECTIONS.length; i++) {
    const current = SECTIONS[i];
    const next = SECTIONS[i+1];
    
    // Instead of using \n which might mess up regex or parsing, we use actual strings.
    const openWrapper = "{layout.some(l => l.i === '" + current.key + "') && (\n  <div key=\"" + current.key + "\">\n    " + current.comment;
    newContent = newContent.replace(current.comment, openWrapper);
    
    if (next) {
      newContent = newContent.replace(next.comment, "  </div>\n)}\n\n" + next.comment);
    } else {
      newContent = newContent.replace("</ResponsiveGridLayout>", "  </div>\n)}\n</ResponsiveGridLayout>");
    }
  }
}

// Ensure there is an Edit Dashboard button in the filterControlsRow so the user can open it!
const editButton = `
            {/* Edit Dashboard Button */}
            <button
              className={styles.rangePill}
              style={{ background: isEditMode ? 'var(--color-accent)' : 'var(--color-surface-2)', color: isEditMode ? '#fff' : 'inherit', marginRight: '8px' }}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <span style={{ marginRight: '6px' }}>⚙️</span>
              Edit Dashboard
            </button>
`;
if (!newContent.includes('Edit Dashboard Button')) {
  newContent = newContent.replace("{/* Open Reporting Center Button */}", editButton + "\n            {/* Open Reporting Center Button */}");
}

// Add a quick bugfix for h2 headers breaking out of their divs (e.g., `<h2 className={styles.title}>Revenue Analytics</h2>`)
// They were historically scattered outside the `{/* ── Revenue KPI Cards ── */}` comment.
// It's safer to just wrap them with the closest comment by moving the `{/* ──` comment UP if needed, but our script wraps the whole section until the next comment, so the h2 will be included inside!
// Wait! `Revenue Analytics` h2 is at line 1303, and `Revenue KPI Cards` comment is at 1305. 
// It will fall inside the funnel component because `funnel` wraps until `revenue_kpis`. That's fine!

fs.writeFileSync(file, newContent);
console.log('Wrapped sections successfully');
