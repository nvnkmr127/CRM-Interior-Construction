/* eslint-disable no-unused-vars */
import React from 'react';

export function LeadAgingWidget({ leads = [] }) {
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
        Lead Aging Warning
      </div>
      <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
        {leads.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: '24px 0' }}>
            No leads showing aging warnings.
          </div>
        ) : (
          leads.map(lead => (
            <div key={lead.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{lead.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{lead.stage} • {lead.value}</div>
              </div>
              <div style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}>
                {lead.age}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
