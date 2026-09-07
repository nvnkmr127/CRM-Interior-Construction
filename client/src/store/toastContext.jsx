/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react';
import { create } from 'zustand';
import { ToastContainer } from '../components/ui/Toast';

export const useToastStore = create((set, get) => ({
  toasts: [],
  addToast: (toast) => set(state => ({ toasts: [...state.toasts, toast] })),
  removeToast: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  show: (type, message, duration) => {
    const id = Date.now() + Math.random();
    const d = duration ?? (type === 'error' ? 6000 : type === 'warning' ? 5000 : type === 'info' ? 4000 : 3000);
    const safeMessage = typeof message === 'object' && message !== null
      ? (message.message || message.error || JSON.stringify(message))
      : String(message || '');
    get().addToast({ id, type, message: safeMessage });
    setTimeout(() => get().removeToast(id), d);
  }
}));

export const useToast = () => {
  const show = useToastStore(state => state.show);
  return useMemo(() => {
    const toastObj = {
      success: (msg, d) => show('success', msg, d),
      error:   (msg, d) => show('error',   msg, d),
      warning: (msg, d) => show('warning', msg, d),
      info:    (msg, d) => show('info',    msg, d),
    };
    toastObj.toast = toastObj;
    return toastObj;
  }, [show]);
};

export function GlobalToast() {
  const toasts = useToastStore(state => state.toasts);
  const removeToast = useToastStore(state => state.removeToast);
  
  const dispatch = (action) => {
    if (action.type === 'REMOVE') removeToast(action.id);
  };
  
  return <ToastContainer toasts={toasts} dispatch={dispatch} />;
}
