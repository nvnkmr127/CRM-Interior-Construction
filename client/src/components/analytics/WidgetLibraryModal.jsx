/* eslint-disable no-unused-vars */
import React from 'react';
import { Modal, Button } from '../ui';

const AVAILABLE_WIDGETS = [
  { id: 'lead_kpis', title: 'Lead KPI Cards', desc: 'High-level metrics for total leads, won deals, and conversion rates.' },
  { id: 'funnel', title: 'Funnel Analytics', desc: 'Visual drop-off and conversion rates across pipeline stages.' },
  { id: 'revenue_kpis', title: 'Revenue KPI Cards', desc: 'Pipeline value, won/lost revenue, and expected deal sizes.' },
  { id: 'revenue_charts', title: 'Revenue Charts', desc: 'Detailed bar and donut charts for revenue distribution.' },
  { id: 'sales_cycle', title: 'Sales Cycle & Stage Aging', desc: 'Time-in-stage metrics and SLA tracking.' },
  { id: 'pipeline_vel', title: 'Pipeline Velocity', desc: 'Speed at which deals move through your pipeline.' },
  { id: 'lost_leads', title: 'Lost Leads Analytics', desc: 'Reasons for lost deals and recovery opportunities.' },
  { id: 'win_rate', title: 'Win Rate & Leaderboard', desc: 'Win rate breakdowns by salesperson, team, and source.' },
  { id: 'sla', title: 'SLA Dashboard', desc: 'Critical alerts for overdue leads and missed follow-ups.' },
  { id: 'ai_revenue', title: 'AI Revenue Insights', desc: 'Machine learning insights on revenue trends.' },
  { id: 'ai_predict', title: 'AI Lead Prediction', desc: 'Propensity to win/lose forecasting.' },
  { id: 'sales_prod', title: 'Sales Productivity', desc: 'Activity tracking (calls, meetings, emails) and rankings.' },
  { id: 'marketing', title: 'Marketing Analytics', desc: 'Campaign ROI, Cost Per Lead, and Source attribution.' },
  { id: 'geo', title: 'Geographic Analytics', desc: 'Lead and revenue distribution by location.' },
  { id: 'customer', title: 'Customer Analytics', desc: 'Lifetime value, repeat purchase rate, and segmentation.' },
  { id: 'financial', title: 'Financial Analytics', desc: 'Invoices, margins, cash flow, and outstanding payments.' },
  { id: 'forecast', title: 'Revenue Forecasting', desc: 'Expected closings and future projections.' },
  { id: 'executive', title: 'Executive Summary', desc: 'Top level highlights for C-Suite overview.' },
  { id: 'goal_tracking', title: 'Goal Tracking', desc: 'Progress bars for revenue, team, and employee targets.' },
  { id: 'benchmark_analytics', title: 'Benchmark Analytics', desc: 'Compare performance across time, branches, or employees.' },
  { id: 'project_outcomes', title: 'Lead-to-Project Outcomes', desc: 'Track won lead profitability, CSAT, and snags.' }
];

export default function WidgetLibraryModal({ isOpen, onClose, layout, onAddWidget }) {
  // Find widgets that are NOT currently in the layout
  const activeIds = new Set(layout.map(l => l.i));
  const unusedWidgets = AVAILABLE_WIDGETS.filter(w => !activeIds.has(w.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Widget Library" size="md">
      <div style={{ marginBottom: '16px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
        Add missing widgets to your dashboard. Pinned widgets will appear at the top.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', paddingRight: '8px' }}>
        {unusedWidgets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
            All available widgets are already on your dashboard!
          </div>
        ) : (
          unusedWidgets.map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-surface-2)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{w.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{w.desc}</div>
              </div>
              <Button size="sm" onClick={() => onAddWidget(w.id)}>+ Add</Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
