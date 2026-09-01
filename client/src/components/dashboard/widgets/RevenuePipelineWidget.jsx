/* eslint-disable no-unused-vars */
import React from 'react';

export function RevenuePipelineWidget({ stages = [] }) {
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
        {stages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: '24px 0' }}>
            No revenue pipeline stages recorded.
          </div>
        ) : (
          stages.map((stage, idx) => (
            <div key={idx} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                <span>{stage.name} ({stage.count})</span>
                <span style={{ fontWeight: 'bold' }}>{stage.value}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--color-bg-alt)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${Math.max(5, (stage.count / (stages[0]?.count || 1)) * 100)}%`, 
                  background: 'var(--color-primary)' 
                }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
