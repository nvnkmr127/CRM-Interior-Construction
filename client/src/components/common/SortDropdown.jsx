import React, { useState, useRef, useEffect } from 'react';
import styles from './SortDropdown.module.css';

export default function SortDropdown({ options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={styles.container} ref={wrapperRef}>
      <div 
        className={styles.trigger} 
        onClick={() => setIsOpen(!isOpen)}
        title="Sort By"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
        <span className={styles.label}>Sort:</span>
        <span className={styles.value}>{selectedOption?.label}</span>
      </div>
      
      {isOpen && (
        <div className={styles.dropdown}>
          {options.map(opt => (
            <div 
              key={opt.value}
              className={"" + styles.option + " " + (opt.value === value ? styles.active : '')}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
              {opt.value === value && <span className={styles.check}>?</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
