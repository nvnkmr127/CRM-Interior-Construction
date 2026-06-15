import React, { createContext, useContext, useReducer, useCallback } from 'react';
import ToastContainer from '../components/ui/Toast';

const ToastContext = createContext(null);

const toastReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TOAST':
      const newToasts = [...state, action.payload];
      // Keep max 5 toasts visible
      if (newToasts.length > 5) newToasts.shift();
      return newToasts;
    case 'REMOVE_TOAST':
      return state.filter(t => t.id !== action.payload);
    default:
      return state;
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message, duration } });
  }, []);

  const toast = {
    success: (msg, duration) => addToast('success', msg, duration),
    error: (msg, duration) => addToast('error', msg, duration),
    info: (msg, duration) => addToast('info', msg, duration),
    warning: (msg, duration) => addToast('warning', msg, duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
