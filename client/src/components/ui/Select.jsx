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
  label, 
  required,
  allowCustom = false,
  editable = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const isInputFocused = useRef(false)

  const currentOpt = options.find(o => 
    (o.value !== '' && o.value !== undefined && o.value === value) ||
    (o.value && String(o.value).toLowerCase() === String(value || '').toLowerCase()) ||
    (o.label && String(o.label).toLowerCase() === String(value || '').toLowerCase())
  )
  const displayLabel = currentOpt ? currentOpt.label : (value || '')
  const [inputValue, setInputValue] = useState(displayLabel)

  useEffect(() => {
    if (!isInputFocused.current) {
      setInputValue(displayLabel)
    }
  }, [displayLabel])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightedIndex(0)
    } else {
      setHighlightedIndex(-1)
      setSearchTerm('')
    }
  }, [isOpen])

  const filteredOptions = (editable || searchable) 
    ? options.filter(opt => {
        if (!opt.value && !opt.label) return false
        if (!searchTerm) return true
        return (
          (opt.label && opt.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (opt.value && String(opt.value).toLowerCase().includes(searchTerm.toLowerCase()))
        )
      })
    : options

  const hasExactMatch = options.some(opt => 
    (opt.label && opt.label.toLowerCase() === searchTerm.toLowerCase()) ||
    (opt.value && String(opt.value).toLowerCase() === searchTerm.toLowerCase())
  )
  const displayOptions = ((allowCustom || editable) && searchTerm && !hasExactMatch)
    ? [...filteredOptions, { value: searchTerm, label: `Use "${searchTerm}"` }]
    : filteredOptions

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputValue(val)
    setSearchTerm(val)
    const match = options.find(o => 
      (o.label && o.label.toLowerCase() === val.trim().toLowerCase()) || 
      (o.value && String(o.value).toLowerCase() === val.trim().toLowerCase())
    )
    onChange(match ? match.value : val)
    if (!isOpen) setIsOpen(true)
  }

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
      if (editable) {
        const textToDisplay = (option.label && !option.label.startsWith('Use "')) ? option.label : option.value
        setInputValue(textToDisplay || '')
        setSearchTerm('')
      }
      setIsOpen(false)
    }
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

  const handleKeyDown = (e) => {
    if (disabled) return
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev + 1) % displayOptions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev - 1 + displayOptions.length) % displayOptions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (displayOptions[highlightedIndex]) {
        handleSelect(displayOptions[highlightedIndex])
      }
    }
  }

  return (
    <div 
      className={`${styles.field} ${isOpen ? styles.open : ''}`} 
      ref={wrapperRef}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      {label && <label className={styles.label}>{label} {required && '*'}</label>}
      <div 
        className={styles.trigger} 
        onClick={() => {
          if (!disabled && !editable) setIsOpen(!isOpen)
        }}
        style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : (editable ? 'text' : 'pointer') }}
      >
        {editable ? (
          <input
            type="text"
            className={styles.editableInput}
            value={inputValue}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleInputChange}
            onFocus={() => {
              isInputFocused.current = true
              if (!disabled) setIsOpen(true)
            }}
            onBlur={() => {
              isInputFocused.current = false
              const match = options.find(o => 
                (o.value !== '' && o.value === value) ||
                (o.value && String(o.value).toLowerCase() === String(value || '').toLowerCase())
              )
              if (match) {
                setInputValue(match.label)
              }
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled && !isOpen) setIsOpen(true)
            }}
          />
        ) : (
          <div className={styles.triggerText}>{renderValue()}</div>
        )}
        <span 
          className={styles.arrow}
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) {
              if (!isOpen) setSearchTerm('')
              setIsOpen(!isOpen)
            }
          }}
        >
          ▼
        </span>
      </div>
      
      {isOpen && (
        <div className={styles.dropdown}>
          {searchable && !editable && (
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
            {displayOptions.length > 0 ? displayOptions.map((opt, index) => {
              const isSelected = multi 
                ? (value || []).includes(opt.value) 
                : value === opt.value
                
              return (
                <div 
                  key={opt.value} 
                  className={`${styles.option} ${isSelected ? styles.selected : ''} ${highlightedIndex === index ? styles.highlighted : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
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
