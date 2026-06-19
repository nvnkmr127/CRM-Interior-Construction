import React from 'react';

export function LeadAgingWidget({ leads = [] }) {
  // Mock data if none provided
  const displayLeads = leads.length > 0 ? leads : [
    { id: 1, name: 'Anil Kumar', age: '14 days', stage: 'Presentation', value: '₹12L' },
    { id: 2, name: 'Neha Sharma', age: '21 days', stage: 'Quotation', value: '₹18L' },
    { id: 3, name: 'Vikram Singh', age: '18 days', stage: 'Site Visit', value: '₹22L' }
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
        Lead Aging Warning
      </div>
      <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
        {displayLeads.map(lead => (
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
        ))}
      </div>
    </div>
  );
}
