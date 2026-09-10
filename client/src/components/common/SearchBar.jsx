import React, { useState, useEffect } from 'react';
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
    </div>
  );
}
