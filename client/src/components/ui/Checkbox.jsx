import React from 'react';

const Checkbox = ({ label, checked, onChange, disabled }) => {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange} 
        disabled={disabled}
        style={{ width: '16px', height: '16px' }}
      />
      {label && <span style={{ fontSize: '14px' }}>{label}</span>}
    </label>
  );
};

export default Checkbox;
