import React from 'react';

export function RevenuePipelineWidget({ stages = [] }) {
  const displayStages = stages.length > 0 ? stages : [
    { name: 'Lead', count: 120, value: '₹1.2Cr' },
    { name: 'Qualified', count: 85, value: '₹85L' },
    { name: 'Presentation', count: 40, value: '₹50L' },
    { name: 'Quotation', count: 15, value: '₹18L' },
    { name: 'Booking', count: 8, value: '₹12L' }
  ];

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: '600',
        color: 'var(--color-text)'
      }}>
        Revenue Pipeline
      </div>
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {displayStages.map((stage, idx) => (
          <div key={idx} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              <span>{stage.name} ({stage.count})</span>
              <span style={{ fontWeight: 'bold' }}>{stage.value}</span>
            </div>
            <div style={{ height: '8px', background: 'var(--color-bg-alt)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.max(5, (stage.count / displayStages[0].count) * 100)}%`, 
                background: 'var(--color-primary)' 
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
