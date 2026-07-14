const fs = require('fs');

const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject Imports
const importStatement = `import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
const ResponsiveGridLayout = WidthProvider(Responsive);
`;

if (!content.includes('react-grid-layout')) {
  content = content.replace("import { getLeadAnalytics", importStatement + "import { getLeadAnalytics");
}

// 2. Add State for layout
const layoutState = `
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('default');
  const [layout, setLayout] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_dashboard_layout')) || DEFAULT_DASHBOARD_LAYOUT;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  const saveLayout = () => {
    localStorage.setItem('crm_dashboard_layout', JSON.stringify(layout));
    setIsEditMode(false);
  };
`;

const defaultLayoutDef = `
const DEFAULT_DASHBOARD_LAYOUT = [
  { i: 'lead_kpis', x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'funnel', x: 0, y: 2, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'revenue_kpis', x: 0, y: 6, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'revenue_charts', x: 0, y: 8, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'sales_cycle', x: 0, y: 13, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'pipeline_vel', x: 0, y: 17, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'lost_leads', x: 0, y: 20, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'win_rate', x: 0, y: 24, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'sla', x: 0, y: 28, w: 12, h: 3, minW: 6, minH: 2 },
  { i: 'ai_revenue', x: 0, y: 31, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'ai_predict', x: 0, y: 35, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'sales_prod', x: 0, y: 39, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'marketing', x: 0, y: 44, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'geo', x: 0, y: 49, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'customer', x: 0, y: 54, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'financial', x: 0, y: 59, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'forecast', x: 0, y: 64, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 }
];
`;

if (!content.includes('DEFAULT_DASHBOARD_LAYOUT')) {
  content = content.replace("export default function LeadAnalyticsPage() {", defaultLayoutDef + "\nexport default function LeadAnalyticsPage() {\n");
  content = content.replace("const [filters, setFilters] = useState(DEFAULT_FILTERS);", layoutState + "\n  const [filters, setFilters] = useState(DEFAULT_FILTERS);");
}

// 3. Add Customizer UI
const customizerUI = `
      {/* ── Dashboard Customizer ── */}
      {isEditMode && (
        <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Dashboard Customizer</span>
          <select 
            value={currentPreset} 
            onChange={(e) => {
              setCurrentPreset(e.target.value);
              if (e.target.value === 'default') setLayout(DEFAULT_DASHBOARD_LAYOUT);
              if (e.target.value === 'executive') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['executive', 'revenue_kpis', 'ai_revenue', 'forecast'].includes(l.i)));
              if (e.target.value === 'marketing') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['marketing', 'lead_kpis', 'funnel', 'geo'].includes(l.i)));
            }} 
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="default">Default Preset</option>
            <option value="executive">Executive Preset</option>
            <option value="marketing">Marketing Preset</option>
          </select>
          <button className={styles.rangePill} onClick={() => setLayout(DEFAULT_DASHBOARD_LAYOUT)}>Reset Layout</button>
          <button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>
          <button className={styles.clearAllBtn} onClick={() => setIsEditMode(false)}>Exit Edit Mode</button>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        onLayoutChange={(newLayout) => setLayout(newLayout)}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        useCSSTransforms={true}
      >
`;

if (!content.includes('Dashboard Customizer')) {
  // Inject exactly after the active chips block
  content = content.replace("{/* ── Lead KPI Cards ── */}", customizerUI + "\n        {/* ── Lead KPI Cards ── */}");
}

// 4. Wrap everything and close the tag
const endTag = `
      </ResponsiveGridLayout>
`;
if (!content.includes('</ResponsiveGridLayout>')) {
  // We need to inject this right before the modals.
  content = content.replace("{/* ── Reporting Center Modal ── */}", endTag + "\n      {/* ── Reporting Center Modal ── */}");
}

// Write it out
fs.writeFileSync(file, content);
console.log('Refactor script completed');
