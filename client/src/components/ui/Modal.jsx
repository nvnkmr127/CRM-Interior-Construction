import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

export default function Modal({ isOpen, onClose, title, size='md', children, footer, closeOnBackdrop=true, hideHeader=false, style={} }) {
  const panelRef = useRef(null)

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Close on ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Focus trap: focus first focusable element inside panel on open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const el = panelRef.current.querySelector('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')
      el?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className={styles.overlay} onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[size]} ${hideHeader ? styles.noHeader : ''}`}
        onClick={e => e.stopPropagation()}
        role='dialog' aria-modal='true' aria-labelledby='modal-title'
        style={style}
      >
        {!hideHeader && (
          <div className={styles.header}>
            <h2 id='modal-title' className={styles.title}>{title}</h2>
            <button className={styles.close} onClick={onClose} aria-label='Close'>✕</button>
          </div>
        )}
        <div className={styles.body} style={hideHeader ? { padding: 0 } : {}}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
