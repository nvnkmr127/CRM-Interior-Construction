import React, { useState, useEffect, useCallback } from 'react';
import styles from './SearchBar.module.css';

export default function SearchBar({ value, onChange, placeholder = "Search..." }) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = React.useRef(null);

  // Sync prop changes (e.g. cleared from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localValue, onChange]);

  // Ctrl + K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchIcon}>🔍</div>
      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
      />
      {localValue && (
        <button className={styles.clearBtn} onClick={handleClear} aria-label="Clear search">
          ✕
        </button>
      )}
      <div className={styles.shortcutBadge}>
        <kbd>Ctrl</kbd> + <kbd>K</kbd>
      </div>
    </div>
  );
}
