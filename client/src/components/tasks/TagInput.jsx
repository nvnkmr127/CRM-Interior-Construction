import { useState, useEffect, useRef } from 'react'
import { getTags, createTag } from '../../api/tasks'
import styles from './TagInput.module.css'

export default function TagInput({ selectedTagIds = [], onChange }) {
  const [globalTags, setGlobalTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    loadTags()
    
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTags = async () => {
    try {
      const res = await getTags()
      setGlobalTags(res.data?.data || res.data || [])
    } catch {}
  }

  const selectedTags = selectedTagIds.map(id => globalTags.find(t => t.id === id)).filter(Boolean)

  const availableTags = globalTags.filter(t => !selectedTagIds.includes(t.id))
  
  const filteredSuggestions = availableTags.filter(t => 
    t.name.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleSelect = (tagId) => {
    onChange([...selectedTagIds, tagId])
    setInputValue('')
    setShowDropdown(false)
  }

  const handleCreate = async () => {
    if (!inputValue.trim()) return
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16) // Fallback random color
    try {
      const res = await createTag({ name: inputValue.trim(), color: randomColor })
      const newTag = res.data?.data || res.data
      setGlobalTags(prev => [...prev, newTag])
      onChange([...selectedTagIds, newTag.id])
      setInputValue('')
      setShowDropdown(false)
    } catch {}
  }

  const removeTag = (idToRemove) => {
    onChange(selectedTagIds.filter(id => id !== idToRemove))
  }

  return (
    <div className={styles.container} ref={dropdownRef}>
      <div className={styles.inputWrapper}>
        {selectedTags.map(tag => (
          <div key={tag.id} className={styles.tagPill} style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}` }}>
            {tag.name}
            <button className={styles.removeBtn} onClick={() => removeTag(tag.id)}>×</button>
          </div>
        ))}
        <input 
          className={styles.input}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !inputValue && selectedTagIds.length > 0) {
              removeTag(selectedTagIds[selectedTagIds.length - 1])
            }
          }}
        />
      </div>

      {showDropdown && (
        <div className={styles.dropdown}>
          {filteredSuggestions.map(tag => (
            <div key={tag.id} className={styles.dropdownItem} onClick={() => handleSelect(tag.id)}>
              <div className={styles.colorDot} style={{ backgroundColor: tag.color }}></div>
              {tag.name}
            </div>
          ))}
          
          {inputValue.trim() && !globalTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase()) && (
            <div className={styles.dropdownItem} onClick={handleCreate} style={{ color: 'var(--color-primary)' }}>
              + Create "{inputValue}"
            </div>
          )}
          
          {filteredSuggestions.length === 0 && !inputValue.trim() && (
            <div className={styles.dropdownItem} style={{ color: 'var(--color-text-muted)', cursor: 'default' }}>
              No tags found. Type to create.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
