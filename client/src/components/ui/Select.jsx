import { useState, useRef, useEffect } from 'react'
import styles from './Select.module.css'

export default function Select({ 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Select...', 
  searchable = false, 
  multi = false,
  disabled = false, 
  error, 
  size = 'md', 
  label, 
  required 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = searchable 
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  const handleSelect = (option) => {
    if (multi) {
      const valArray = Array.isArray(value) ? value : (value ? [value] : [])
      if (valArray.includes(option.value)) {
        onChange(valArray.filter(v => v !== option.value))
      } else {
        onChange([...valArray, option.value])
      }
    } else {
      onChange(option.value)
      setIsOpen(false)
    }
    setSearchTerm('')
  }

  const removeChip = (e, valToRemove) => {
    e.stopPropagation()
    const valArray = Array.isArray(value) ? value : (value ? [value] : [])
    onChange(valArray.filter(v => v !== valToRemove))
  }

  const renderValue = () => {
    if (multi) {
      const valArray = Array.isArray(value) ? value : (value ? [value] : [])
      if (valArray.length === 0) return <span className={styles.placeholder}>{placeholder}</span>
      return (
        <div className={styles.chips}>
          {valArray.map(val => {
            const opt = options.find(o => o.value === val)
            if (!opt) return null
            return (
              <span key={val} className={styles.chip}>
                {opt.label}
                <span className={styles.chipRemove} onClick={(e) => removeChip(e, val)}>✕</span>
              </span>
            )
          })}
        </div>
      )
    } else {
      if (value === undefined || value === null || value === '') return <span className={styles.placeholder}>{placeholder}</span>
      const opt = options.find(o => o.value === value)
      return <span className={styles.triggerText}>{opt?.icon && <span>{opt.icon}</span>}{opt ? opt.label : value}</span>
    }
  }

  return (
    <div className={`${styles.field} ${isOpen ? styles.open : ''}`} ref={wrapperRef}>
      {label && <label className={styles.label}>{label} {required && '*'}</label>}
      <div 
        className={styles.trigger} 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <div className={styles.triggerText}>{renderValue()}</div>
        <span className={styles.arrow}>▼</span>
      </div>
      
      {isOpen && (
        <div className={styles.dropdown}>
          {searchable && (
            <div className={styles.search}>
              <input 
                type="text" 
                autoFocus 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <div className={styles.options}>
            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
              const isSelected = multi 
                ? (value || []).includes(opt.value) 
                : value === opt.value
                
              return (
                <div 
                  key={opt.value} 
                  className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.icon && <span>{opt.icon}</span>}
                  {opt.label}
                  {isSelected && <span className={styles.check}>✓</span>}
                </div>
              )
            }) : (
              <div className={styles.option} style={{color: 'var(--color-text-muted)'}}>No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
