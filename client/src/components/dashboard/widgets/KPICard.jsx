import React from 'react';

export function KPICard({ label, value, trend, isWarning, isDanger }) {
  let valueColor = 'var(--color-text)';
  if (isWarning) valueColor = 'var(--color-warning)';
  if (isDanger) valueColor = 'var(--color-danger)';

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '120px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 'var(--space-2)',
        fontWeight: '600'
      }}>{label}</div>
      <div style={{
        fontSize: 'var(--text-3xl)',
        fontWeight: '800',
        color: valueColor,
        lineHeight: 1
      }}>{value}</div>
      {trend && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: trend.includes('+') || trend.includes('↑') ? 'var(--color-success)' : 'var(--color-danger)',
          fontWeight: '600',
          marginTop: 'var(--space-2)'
        }}>{trend}</div>
      )}
    </div>
  );
}
