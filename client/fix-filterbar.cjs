const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');

// The corrupted block starts with `<div className={styles.filterBarContainer}>`
// and ends with `      )}` just before `<ResponsiveGridLayout`.
const startIdx = code.indexOf('<div className={styles.filterBarContainer}>');
const endIdx = code.indexOf('<ResponsiveGridLayout');

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `      {isEditMode && (
        <div style={{ display: 'flex', gap: '8px', padding: '16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <select 
            value={currentPreset} 
            onChange={(e) => {
              const val = e.target.value;
              setCurrentPreset(val);
              if (val === 'default') setLayout(DEFAULT_DASHBOARD_LAYOUT);
              else if (val === 'executive') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
              else if (val === 'marketing') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
              else if (val === 'sales') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['sales_cycle', 'pipeline_vel', 'win_rate', 'sales_prod', 'goal_tracking'].includes(l.i)));
              else if (val === 'manager') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['lead_kpis', 'revenue_kpis', 'sla', 'lost_leads', 'benchmark_analytics', 'executive'].includes(l.i)));
              else if (savedLayouts[val]) setLayout(savedLayouts[val]);
            }} 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          >
            <option value="default">Default View</option>
            <option value="executive">Executive View</option>
            <option value="marketing">Marketing View</option>
            <option value="sales">Sales View</option>
            <option value="manager">Manager View</option>
            {Object.keys(savedLayouts).length > 0 && <optgroup label="My Custom Layouts">
              {Object.keys(savedLayouts).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>}
          </select>
          <button className={styles.rangePill} onClick={() => setLayout(DEFAULT_DASHBOARD_LAYOUT)}>Reset Layout</button>
          <button className={styles.rangePillActive} onClick={() => setLibraryOpen(true)}>+ Add Widget</button>
          <button className={styles.rangePillActive} onClick={saveLayout}>Save Default</button>
          <button className={styles.rangePillActive} onClick={saveCustomLayout}>Save As...</button>
          <button className={styles.clearAllBtn} onClick={() => setIsEditMode(false)}>Exit Edit Mode</button>
        </div>
      )}

      `;

  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', code);
  console.log('Fixed filterBarContainer and isEditMode block');
} else {
  console.log('Could not find boundaries');
}
