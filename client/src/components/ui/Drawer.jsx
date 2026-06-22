import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './Drawer.module.css'

export default function Drawer({ isOpen, onClose, title, width=520, children, footer, closeOnBackdrop=true, hideHeader=false, noPadding=false }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const el = panelRef.current.querySelector('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')
      el?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.backdrop} onClick={closeOnBackdrop ? onClose : undefined} />
      <div
        ref={panelRef}
        className={styles.panel}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        role='dialog' aria-modal='true' aria-labelledby={title ? 'drawer-title' : undefined}
      >
        {!hideHeader && (
          <div className={styles.header}>
            <h2 id='drawer-title' className={styles.title}>{title}</h2>
            <button className={styles.close} onClick={onClose} aria-label='Close'>✕</button>
          </div>
        )}
        <div className={styles.body} style={noPadding ? { padding: 0 } : undefined}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
