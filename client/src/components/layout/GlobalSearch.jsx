/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import api from '../../api/axios'
import styles from './GlobalSearch.module.css'

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ leads:[], projects:[], tasks:[] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults({ leads:[], projects:[], tasks:[] })
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults({ leads:[], projects:[], tasks:[] })
      return
    }
    const timer = setTimeout(() => {
      setLoading(true)
      api.get(`/search?q=${encodeURIComponent(query)}&types=leads,projects,tasks`)
        .then(r => {
          const data = r.data || {}
          setResults({
            leads: data.leads || [],
            projects: data.projects || [],
            tasks: data.tasks || []
          })
          setSelectedIndex(0)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const flatResults = [
    ...results.leads.map(r => ({ ...r, _type: 'lead', _icon: '◎', _sub: r.stageName, _url: `/leads/${r.id}` })),
    ...(results.contacts || []).map(r => ({ ...r, _type: 'contact', _icon: '👤', _sub: r.role, _url: `/leads/${r.lead_id}` })),
    ...(results.activities || []).map(r => ({ ...r, _type: 'activity', _icon: '📝', _sub: r.lead_name, _url: `/leads/${r.lead_id}` })),
    ...results.projects.map(r => ({ ...r, _type: 'project', _icon: '◈', _sub: r.clientName, _url: `/projects/${r.id}` })),
    ...results.tasks.map(r => ({ ...r, _type: 'task', _icon: '◻', _sub: r.projectName, _url: `/tasks/${r.id}` }))
  ]

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatResults[selectedIndex]) {
          navigate(flatResults[selectedIndex]._url)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, flatResults, selectedIndex, navigate, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="⌕  Search leads, projects, tasks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className={styles.divider} />
        <div className={styles.results}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ padding: '8px', opacity: 0.5 }}>Loading...</div>
              <div style={{ padding: '8px', opacity: 0.3 }}>Loading...</div>
              <div style={{ padding: '8px', opacity: 0.1 }}>Loading...</div>
            </div>
          ) : flatResults.length > 0 ? (
            <>
              {results.leads.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>LEADS</div>
                  {results.leads.map(r => renderResult(flatResults.find(f => f.id === r.id && f._type === 'lead')))}
                </div>
              )}
              {results.projects.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>PROJECTS</div>
                  {results.projects.map(r => renderResult(flatResults.find(f => f.id === r.id && f._type === 'project')))}
                </div>
              )}
              {results.tasks.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>TASKS</div>
                  {results.tasks.map(r => renderResult(flatResults.find(f => f.id === r.id && f._type === 'task')))}
                </div>
              )}
            </>
          ) : query.length >= 2 ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, opacity: 0.5, marginBottom: 8 }}>⌕</div>
              <div style={{ fontWeight: 500 }}>No results for "{query}"</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>Try different keywords</div>
            </div>
          ) : null}
        </div>
        <div className={styles.footer}>
          <span className={styles.hint}><span className={styles.kbd}>↑</span><span className={styles.kbd}>↓</span> to navigate</span>
          <span className={styles.hint}><span className={styles.kbd}>↵</span> to select</span>
          <span className={styles.hint}><span className={styles.kbd}>ESC</span> to close</span>
        </div>
      </div>
    </div>,
    document.body
  )

  function renderResult(item) {
    if (!item) return null
    const idx = flatResults.indexOf(item)
    return (
      <div 
        key={`${item._type}-${item.id}`}
        className={`${styles.result} ${idx === selectedIndex ? styles.highlighted : ''}`}
        onClick={() => { navigate(item._url); onClose() }}
        onMouseEnter={() => setSelectedIndex(idx)}
      >
        <div className={styles.resultIcon}>{item._icon}</div>
        <div style={{ flex: 1 }}>
          <div className={styles.resultName}>{item.name || item.title}</div>
          {item._sub && <div className={styles.resultSub}>{item._sub}</div>}
        </div>
        <div className={styles.badge}>{item._type.toUpperCase()}</div>
      </div>
    )
  }
}
