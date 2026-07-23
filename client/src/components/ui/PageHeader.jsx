import React from 'react';

const PageHeader = ({ title, description, children }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
      <div>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>{title}</h1>
        {description && <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '14px' }}>{description}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: '12px' }}>{children}</div>}
    </div>
  );
};

export default PageHeader;
