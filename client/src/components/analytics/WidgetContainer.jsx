import React from 'react';

const WIDGET_TITLES = {
  lead_kpis: 'Lead KPI Cards',
  funnel: 'Funnel Analytics',
  revenue_kpis: 'Revenue KPI Cards',
  revenue_charts: 'Revenue Charts',
  sales_cycle: 'Sales Cycle & Stage Aging',
  pipeline_vel: 'Pipeline Velocity',
  lost_leads: 'Lost Leads Analytics',
  win_rate: 'Win Rate & Leaderboard',
  sla: 'SLA Dashboard',
  ai_revenue: 'AI Revenue Insights',
  ai_predict: 'AI Lead Prediction',
  sales_prod: 'Sales Productivity',
  marketing: 'Marketing Analytics',
  geo: 'Geographic Analytics',
  customer: 'Customer Analytics',
  financial: 'Financial Analytics',
  forecast: 'Revenue Forecasting',
  executive: 'Executive Summary',
  goal_tracking: 'Goal Tracking',
  benchmark_analytics: 'Benchmark Analytics'
};

export default function WidgetContainer({ id, isEditMode, layout, setLayout, children }) {
  const currentItem = layout.find(l => l.i === id);
  if (!currentItem) return null;

  const isCollapsed = currentItem.collapsed || false;
  const isPinned = currentItem.pinned || false;

  const toggleCollapse = () => {
    setLayout(prev => prev.map(l => {
      if (l.i === id) {
        const nextCollapsed = !l.collapsed;
        return {
          ...l,
          collapsed: nextCollapsed,
          // Store old height when collapsing, restore when expanding
          h: nextCollapsed ? 1 : (l.prevH || 4),
          prevH: nextCollapsed ? l.h : l.prevH,
          minH: nextCollapsed ? 1 : (l.prevMinH || 2),
          prevMinH: nextCollapsed ? l.minH : l.prevMinH,
          isResizable: !nextCollapsed // Prevent resizing when collapsed
        };
      }
      return l;
    }));
  };

  const togglePin = () => {
    setLayout(prev => {
      const next = prev.map(l => l.i === id ? { ...l, pinned: !l.pinned } : l);
      // Sort pinned to the top (y=0) so RGL reflows them
      const pinned = next.filter(l => l.pinned).map(l => ({ ...l, y: 0 }));
      const unpinned = next.filter(l => !l.pinned);
      return [...pinned, ...unpinned];
    });
  };

  const removeWidget = () => {
    setLayout(prev => prev.filter(l => l.i !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRadius: '12px', border: isPinned ? '2px solid var(--color-accent)' : '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', transition: 'all 0.3s ease' }}>
      
      {/* Widget Header Controls (Visible mainly in Edit Mode or when hovering) */}
      <div 
        className={isEditMode ? "widget-drag-handle" : ""} 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: isEditMode ? 'var(--color-surface-2)' : 'transparent', cursor: isEditMode ? 'grab' : 'default', borderBottom: (isEditMode || isCollapsed) ? '1px solid var(--color-border)' : 'none', minHeight: '40px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditMode && <span style={{ color: 'var(--color-text-secondary)', cursor: 'grab' }}>⋮⋮</span>}
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>
            {isPinned && '📌 '} {WIDGET_TITLES[id] || id}
          </span>
        </div>

        {isEditMode && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={togglePin}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: isPinned ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
              title={isPinned ? "Unpin Widget" : "Pin to Top"}
            >
              📌
            </button>
            <button 
              onClick={toggleCollapse}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? '🔽' : '🔼'}
            </button>
            <button 
              onClick={removeWidget}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: '#DC2626' }}
              title="Remove from Dashboard"
            >
              ❌
            </button>
          </div>
        )}
      </div>

      {/* Widget Content */}
      <div style={{ flex: 1, overflow: isCollapsed ? 'hidden' : 'auto', padding: isCollapsed ? 0 : '8px', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.3s' }}>
        {!isCollapsed && children}
      </div>

    </div>
  );
}
