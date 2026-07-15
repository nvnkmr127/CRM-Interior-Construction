const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('savedLayouts')) {
  // 1. Add savedLayouts state
  content = content.replace(
    "const [currentPreset, setCurrentPreset] = useState('default');",
    "const [currentPreset, setCurrentPreset] = useState('default');\n  const [savedLayouts, setSavedLayouts] = useState(() => {\n    try {\n      return JSON.parse(localStorage.getItem('crm_dashboard_saved_layouts')) || {};\n    } catch {\n      return {};\n    }\n  });"
  );

  // 2. Add save custom layout function
  const saveCustomLayoutFn = `
  const saveCustomLayout = () => {
    const name = prompt('Enter a name for this layout (e.g. Sales View):');
    if (!name) return;
    const nextSaved = { ...savedLayouts, [name]: layout };
    setSavedLayouts(nextSaved);
    localStorage.setItem('crm_dashboard_saved_layouts', JSON.stringify(nextSaved));
    setCurrentPreset(name);
  };
`;
  content = content.replace(
    "const saveLayout = () => {",
    saveCustomLayoutFn + "\n  const saveLayout = () => {"
  );

  // 3. Update the select dropdown to include custom saved layouts
  const selectRegex = /<select[\s\S]*?<option value="marketing">Marketing Preset<\/option>\s*<\/select>/;
  const newSelect = `<select 
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
            style={{ padding: '8px', borderRadius: '4px' }}
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
          </select>`;
  
  content = content.replace(selectRegex, newSelect);

  // 4. Update the save buttons to include "Save As"
  content = content.replace(
    '<button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>',
    '<button className={styles.rangePillActive} onClick={saveLayout}>Save Default</button>\n          <button className={styles.rangePillActive} onClick={saveCustomLayout}>Save As...</button>'
  );

  fs.writeFileSync(file, content);
  console.log('Successfully added custom layout saving');
} else {
  console.log('Already added');
}
