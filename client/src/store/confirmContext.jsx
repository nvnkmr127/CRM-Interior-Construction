import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmContext = createContext();

export function ConfirmProvider({ children }) {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: '',
    title: '',
    confirmText: '',
    cancelText: '',
    resolve: null
  });

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const isString = typeof options === 'string';
      const message = isString ? options : options.message || 'Are you sure you want to delete this item?';
      const isDangerAction = /delete|remove|void|revoke|cancel|reject/i.test(message);

      setConfirmState({
        isOpen: true,
        message,
        title: isString ? (isDangerAction ? 'Confirm Delete' : 'Confirm') : (options.title || (isDangerAction ? 'Confirm Delete' : 'Confirm')),
        confirmText: isString ? (isDangerAction ? 'Delete' : 'Confirm') : (options.confirmText || (isDangerAction ? 'Delete' : 'Confirm')),
        cancelText: isString ? 'Cancel' : (options.cancelText || 'Cancel'),
        resolve
      });
    });
  }, []);

  const handleConfirm = () => {
    if (confirmState.resolve) {
      confirmState.resolve(true);
    }
    setConfirmState({ isOpen: false, message: '', title: '', confirmText: '', cancelText: '', resolve: null });
  };

  const handleCancel = () => {
    if (confirmState.resolve) {
      confirmState.resolve(false);
    }
    setConfirmState({ isOpen: false, message: '', title: '', confirmText: '', cancelText: '', resolve: null });
  };

  const isDanger = /delete|remove|void|revoke|cancel|reject/i.test(confirmState.confirmText || '') 
    || /delete|remove|void|revoke|cancel|reject/i.test(confirmState.message || '');

  const buttonColor = isDanger ? 'var(--color-danger, #ef4444)' : 'var(--color-primary, #3b82f6)';
  const buttonBgHover = isDanger ? 'var(--color-danger-light, #fef2f2)' : 'var(--color-primary-light, #eff6ff)';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {confirmState.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            background: 'var(--color-surface, #fff)',
            padding: '32px 24px',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e5e7eb)',
            boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{
               margin: '0 0 12px 0',
               fontSize: '18px',
               color: 'var(--color-text, #111827)',
               fontWeight: 600
            }}>
               {confirmState.title}
            </h3>
            <p style={{
              margin: '0 0 32px 0',
              fontSize: '15px',
              color: 'var(--color-text-secondary, #4b5563)',
              lineHeight: '1.5'
            }}>
              {confirmState.message}
            </p>
            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleCancel}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-surface, #fff)',
                  border: '1px solid var(--color-border, #d1d5db)',
                  borderRadius: '6px',
                  color: 'var(--color-text, #374151)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: '100px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, #f9fafb)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface, #fff)'}
              >
                {confirmState.cancelText}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-surface, #fff)',
                  border: `1px solid ${buttonColor}`,
                  borderRadius: '6px',
                  color: buttonColor,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: '100px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = buttonBgHover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-surface, #fff)'}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
