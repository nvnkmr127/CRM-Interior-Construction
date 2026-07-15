const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. IMPORTS
if (!content.includes('GoalTrackingWidget')) {
  content = content.replace(
    "import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';",
    "import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';\nimport GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';\nimport BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';\nimport WidgetContainer from '../../components/analytics/WidgetContainer';\nimport WidgetLibraryModal from '../../components/analytics/WidgetLibraryModal';"
  );
}

// 2. LAYOUT DEFAULTS
if (!content.includes('goal_tracking')) {
  content = content.replace(
    "{ i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 }",
    "{ i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 },\n  { i: 'goal_tracking', x: 0, y: 75, w: 12, h: 6, minW: 4, minH: 4 },\n  { i: 'benchmark_analytics', x: 0, y: 81, w: 12, h: 6, minW: 6, minH: 5 }"
  );
}

// 3. STATE AND HANDLERS (Library & Custom Layouts)
if (!content.includes('savedLayouts')) {
  // Replace currentPreset state to inject all new states
  content = content.replace(
    "const [currentPreset, setCurrentPreset] = useState('default');",
    "const [currentPreset, setCurrentPreset] = useState('default');\n  const [savedLayouts, setSavedLayouts] = useState(() => {\n    try {\n      return JSON.parse(localStorage.getItem('crm_dashboard_saved_layouts')) || {};\n    } catch {\n      return {};\n    }\n  });\n  const [libraryOpen, setLibraryOpen] = useState(false);"
  );

  // Add the addWidget and saveCustomLayout functions right before saveLayout
  const extraFns = `
  const addWidget = (widgetId) => {
    const newWidget = { i: widgetId, x: 0, y: 100, w: 12, h: 4, minW: 6, minH: 3 };
    setLayout(prev => [...prev, newWidget]);
    setLibraryOpen(false);
  };
  
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
    extraFns + "\n  const saveLayout = () => {"
  );
}

// 4. PRESETS DROPDOWN & BUTTONS
if (!content.includes('Save As...')) {
  // Replace the entire select for layout presets
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

  // Replace buttons
  content = content.replace(
    '<button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>',
    '<button className={styles.rangePillActive} onClick={() => setLibraryOpen(true)}>+ Add Widget</button>\n          <button className={styles.rangePillActive} onClick={saveLayout}>Save Default</button>\n          <button className={styles.rangePillActive} onClick={saveCustomLayout}>Save As...</button>'
  );
}

// 5. WIDGET WRAPPERS
// We will replace each widget's outer `div` very carefully.
const WIDGETS = [
  'lead_kpis', 'funnel', 'revenue_kpis', 'revenue_charts', 'sales_cycle', 'pipeline_vel', 
  'lost_leads', 'win_rate', 'sla', 'ai_revenue', 'ai_predict', 'sales_prod', 
  'marketing', 'geo', 'customer', 'financial', 'forecast', 'executive'
];

WIDGETS.forEach(id => {
  // Opening Tag
  const oldOpen1 = `<div key="${id}" className="widget-drag-handle">`;
  const oldOpen2 = `<div key="${id}">`;
  const newOpen = `<div key="${id}">\n    <WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`;
  
  // Safe replacement: Only replace the FIRST occurrence of the div opening tag inside the ResponsiveGridLayout
  if (content.includes(oldOpen1) && !content.includes(`WidgetContainer id="${id}"`)) {
    content = content.replace(oldOpen1, newOpen);
    // Now we must replace the closing `</div>\n)}` for THIS widget specifically.
    // The easiest way to NOT mangle is to split the content by `<div key="${id}">` and find the first `</div>\n)}` in the second half.
    const parts = content.split(`WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`);
    if (parts.length > 1) {
      parts[1] = parts[1].replace(/<\/div>\s*\)\}/, '    </WidgetContainer>\n  </div>\n)}');
      content = parts.join(`WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`);
    }
  } else if (content.includes(oldOpen2) && !content.includes(`WidgetContainer id="${id}"`)) {
    content = content.replace(oldOpen2, newOpen);
    const parts = content.split(`WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`);
    if (parts.length > 1) {
      parts[1] = parts[1].replace(/<\/div>\s*\)\}/, '    </WidgetContainer>\n  </div>\n)}');
      content = parts.join(`WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`);
    }
  }
});

// 6. ADD GOAL TRACKING AND BENCHMARK ANALYTICS JSX BLOCKS
if (!content.includes('<GoalTrackingWidget')) {
  const newWidgetsJSX = `
{layout.some(l => l.i === 'goal_tracking') && (
  <div key="goal_tracking">
    <WidgetContainer id="goal_tracking" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
      <GoalTrackingWidget onClick={handleCardClick} />
    </WidgetContainer>
  </div>
)}
{layout.some(l => l.i === 'benchmark_analytics') && (
  <div key="benchmark_analytics">
    <WidgetContainer id="benchmark_analytics" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
      <BenchmarkAnalyticsWidget onClick={handleCardClick} />
    </WidgetContainer>
  </div>
)}
`;
  content = content.replace('</ResponsiveGridLayout>', newWidgetsJSX + '      </ResponsiveGridLayout>');
}

// 7. INJECT WIDGET LIBRARY MODAL
if (!content.includes('<WidgetLibraryModal')) {
  content = content.replace(
    "{/* ── Advanced Drill-Down Modal ── */}",
    "{/* ── Widget Library Modal ── */}\n      <WidgetLibraryModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} layout={layout} onAddWidget={addWidget} />\n\n      {/* ── Advanced Drill-Down Modal ── */}"
  );
}

fs.writeFileSync(file, content);
console.log('Successfully applied all fixes safely!');
