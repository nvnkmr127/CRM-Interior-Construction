import React, { useState, useRef, useEffect } from 'react';
import FormField from './FormField';
import Tag from './Tag';
import styles from './Select.module.css';

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

export default function Select({
  id, label, placeholder = 'Select...', value, onChange, options = [],
  searchable = false, multi = false, disabled = false, error, helperText, required, size = 'md', className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isOpen) setSearchTerm('');
  }, [isOpen, searchable]);

  // If simple mode requested, fall back natively exactly as requested
  if (!searchable && !multi) {
    const inputClass = `${styles.nativeSelect} ${styles[size]} ${error ? styles.error : ''} ${className}`;
    
    return (
      <FormField label={label} required={required} error={error} helperText={helperText}>
        <div className={styles.nativeWrapper}>
          <select
            id={id}
            className={inputClass}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
          >
            {placeholder && <option value="" disabled hidden>{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className={styles.chevron}><ChevronIcon /></span>
        </div>
      </FormField>
    );
  }

  // --- CUSTOM DROPDOWN (Multi / Searchable) ---
  const handleToggle = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelectOption = (optValue) => {
    if (multi) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optValue)) {
        onChange(currentValues.filter(v => v !== optValue));
      } else {
        onChange([...currentValues, optValue]);
      }
    } else {
      onChange(optValue);
      setIsOpen(false);
    }
  };

  const handleRemoveTag = (e, optValue) => {
    e.stopPropagation();
    if (disabled) return;
    const currentValues = Array.isArray(value) ? value : [];
    onChange(currentValues.filter(v => v !== optValue));
  };

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSelectedDisplay = () => {
    if (multi) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.length === 0) return <span className={styles.placeholder}>{placeholder}</span>;
      
      return (
        <div className={styles.multiValueWrapper}>
          {currentValues.map(val => {
            const opt = options.find(o => o.value === val);
            return (
              <Tag 
                key={val} 
                label={opt ? opt.label : val} 
                onRemove={(e) => handleRemoveTag(e, val)} 
              />
            );
          })}
        </div>
      );
    } else {
      const selectedOpt = options.find(o => o.value === value);
      if (!selectedOpt) return <span className={styles.placeholder}>{placeholder}</span>;
      return <span className={styles.triggerValue}>{selectedOpt.label}</span>;
    }
  };

  return (
    <FormField label={label} required={required} error={error} helperText={helperText}>
      <div className={`${styles.container} ${className}`} ref={containerRef}>
        <div 
          className={`${styles.trigger} ${styles[size]} ${disabled ? styles.disabled : ''} ${error ? styles.error : ''}`}
          onClick={handleToggle}
          tabIndex={disabled ? -1 : 0}
        >
          {getSelectedDisplay()}
          <span className={styles.chevron}><ChevronIcon /></span>
        </div>

        {isOpen && (
          <div className={styles.menu}>
            {searchable && (
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            
            <ul className={styles.optionsList}>
              {filteredOptions.length === 0 ? (
                <li className={styles.noOptions}>No results found</li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = multi 
                    ? (Array.isArray(value) && value.includes(opt.value))
                    : value === opt.value;

                  return (
                    <li
                      key={opt.value}
                      className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                      onClick={() => handleSelectOption(opt.value)}
                    >
                      {opt.label}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </FormField>
  );
}
