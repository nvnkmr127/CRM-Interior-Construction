/* eslint-disable no-unused-vars */
import React from 'react';

export function AIPriorityLeadsWidget({ leads = [] }) {
  const displayLeads = leads.length > 0 ? leads : [
    { id: 1, name: 'Rahul Sharma', probability: '94%', action: 'Call Before 11 AM' },
    { id: 2, name: 'Priya Patel', probability: '88%', action: 'Send Proposal' }
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
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--color-text)'
      }}>
        <span style={{ color: 'var(--color-accent)' }}>⭐</span> AI Priority Leads
      </div>
      <div style={{ padding: '1rem', flex: 1 }}>
        {displayLeads.map(lead => (
          <div key={lead.id} style={{
            background: 'var(--color-surface-2)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            borderLeft: '4px solid var(--color-accent)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 'bold' }}>{lead.name}</span>
              <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>{lead.probability} Win</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Action: {lead.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
