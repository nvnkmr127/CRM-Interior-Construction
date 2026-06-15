import { createContext, useContext, useReducer, useCallback } from 'react'
import { ToastContainer } from '../components/ui/Toast'

const ToastCtx = createContext(null)

function reducer(state, action) {
  switch(action.type) {
    case 'ADD':    return [...state, action.toast]
    case 'REMOVE': return state.filter(t => t.id !== action.id)
    default: return state
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  const show = useCallback((type, message, duration) => {
    const id = Date.now() + Math.random()
    const d = duration ?? (type==='error' ? 6000 : type==='warning' ? 5000 : type==='info' ? 4000 : 3000)
    dispatch({ type:'ADD', toast:{ id, type, message } })
    setTimeout(() => dispatch({ type:'REMOVE', id }), d)
  }, [])

  const toast = {
    success: (msg, d) => show('success', msg, d),
    error:   (msg, d) => show('error',   msg, d),
    warning: (msg, d) => show('warning', msg, d),
    info:    (msg, d) => show('info',    msg, d),
  }

  return (
    <ToastCtx.Provider value={toast}>
      <ToastContainer toasts={toasts} dispatch={dispatch} />
      {children}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
