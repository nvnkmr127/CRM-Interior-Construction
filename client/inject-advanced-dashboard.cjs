const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
if (!content.includes('WidgetContainer')) {
  content = content.replace(
    "import BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';",
    "import BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';\nimport WidgetContainer from '../../components/analytics/WidgetContainer';\nimport WidgetLibraryModal from '../../components/analytics/WidgetLibraryModal';"
  );
}

// 2. Library State & Handlers
if (!content.includes('libraryOpen')) {
  content = content.replace(
    "const [alertsOpen, setAlertsOpen] = useState(false);",
    "const [alertsOpen, setAlertsOpen] = useState(false);\n  const [libraryOpen, setLibraryOpen] = useState(false);"
  );

  const addWidgetFn = `
  const addWidget = (widgetId) => {
    // Determine default sizing based on ID roughly, or use a generic 6x4
    const newWidget = { i: widgetId, x: 0, y: 100, w: 12, h: 4, minW: 6, minH: 3 };
    setLayout(prev => [...prev, newWidget]);
    setLibraryOpen(false);
  };
`;
  content = content.replace(
    "const saveLayout = () => {",
    addWidgetFn + "\n  const saveLayout = () => {"
  );
}

// 3. Add Widget Library Button to Customizer
if (!content.includes('setLibraryOpen(true)')) {
  content = content.replace(
    "<button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>",
    "<button className={styles.rangePillActive} onClick={() => setLibraryOpen(true)}>+ Add Widget</button>\n          <button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>"
  );
}

// 4. Update the layout wrapping to use WidgetContainer!
// Currently we have:
// {layout.some(l => l.i === 'xxx') && (
//   <div key="xxx">
// We want to replace it with:
// {layout.some(l => l.i === 'xxx') && (
//   <div key="xxx">
//     <WidgetContainer id="xxx" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
// And replace the closing:
//   </div>
// )}
// with:
//     </WidgetContainer>
//   </div>
// )}

const WIDGETS = [
  'lead_kpis', 'funnel', 'revenue_kpis', 'revenue_charts', 'sales_cycle', 'pipeline_vel', 
  'lost_leads', 'win_rate', 'sla', 'ai_revenue', 'ai_predict', 'sales_prod', 
  'marketing', 'geo', 'customer', 'financial', 'forecast', 'executive', 'goal_tracking', 'benchmark_analytics'
];

WIDGETS.forEach(id => {
  // Opening Tag
  const oldOpen = `<div key="${id}">`;
  const newOpen = `<div key="${id}">\n    <WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`;
  if (content.includes(oldOpen) && !content.includes(`WidgetContainer id="${id}"`)) {
    content = content.replace(oldOpen, newOpen);
    
    // We must find the END of this widget. 
    // It is followed by `</div>\n)}`.
    // We can use regex.
    const endRegex = new RegExp(`(<WidgetContainer id="${id}"[\\s\\S]*?)(<\\/div>\\s*\\)\\})`, 'g');
    content = content.replace(endRegex, "$1    </WidgetContainer>\n$2");
  }

  // Handle the special case where the script wrapped it with class="widget-drag-handle"
  const oldOpenHandle = `<div key="${id}" className="widget-drag-handle">`;
  const newOpenHandle = `<div key="${id}">\n    <WidgetContainer id="${id}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>`;
  if (content.includes(oldOpenHandle) && !content.includes(`WidgetContainer id="${id}"`)) {
    content = content.replace(oldOpenHandle, newOpenHandle);
    
    const endRegex2 = new RegExp(`(<WidgetContainer id="${id}"[\\s\\S]*?)(<\\/div>\\s*\\)\\})`, 'g');
    content = content.replace(endRegex2, "$1    </WidgetContainer>\n$2");
  }
});

// 5. Inject the WidgetLibraryModal component at the bottom
if (!content.includes('<WidgetLibraryModal')) {
  content = content.replace(
    "{/* ── Advanced Drill-Down Modal ── */}",
    "{/* ── Widget Library Modal ── */}\n      <WidgetLibraryModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} layout={layout} onAddWidget={addWidget} />\n\n      {/* ── Advanced Drill-Down Modal ── */}"
  );
}

fs.writeFileSync(file, content);
console.log('Successfully injected advanced dashboard framework');
