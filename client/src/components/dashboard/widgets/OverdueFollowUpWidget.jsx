/* eslint-disable no-unused-vars */
import React from 'react';

export function OverdueFollowUpWidget({ items = [] }) {
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
        justifyContent: 'space-between',
        color: 'var(--color-text)'
      }}>
        <span>Overdue Follow-ups</span>
        <span style={{ 
          background: items.length > 0 ? 'var(--color-danger)' : 'var(--color-border)', 
          color: items.length > 0 ? 'white' : 'var(--color-text-secondary)', 
          borderRadius: '50%', 
          padding: '2px 8px',
          fontSize: '0.8rem'
        }}>{items.length}</span>
      </div>
      <div style={{ padding: '1rem', flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', padding: '24px 0' }}>
            All caught up! No overdue tasks.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map(item => (
              <li key={item.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--color-border)'
              }}>
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{item.type}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: '600' }}>
                  {item.daysOverdue} days late
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
