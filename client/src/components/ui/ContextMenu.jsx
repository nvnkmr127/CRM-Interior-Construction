import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './ContextMenu.module.css';

export default function ContextMenu({ x, y, options, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    
    // Adjust position if it goes off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const rightOverflow = x + rect.width > window.innerWidth;
      const bottomOverflow = y + rect.height > window.innerHeight;
      
      if (rightOverflow) menuRef.current.style.left = `${window.innerWidth - rect.width - 10}px`;
      if (bottomOverflow) menuRef.current.style.top = `${window.innerHeight - rect.height - 10}px`;
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [x, y, onClose]);

  return createPortal(
    <div 
      className={styles.contextMenu} 
      style={{ top: y, left: x }} 
      ref={menuRef}
    >
      {options.map((opt, i) => {
        if (opt.divider) return <div key={i} className={styles.divider} />;
        return (
          <div 
            key={i} 
            className={`${styles.menuItem} ${opt.danger ? styles.danger : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              opt.onClick();
              onClose();
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
