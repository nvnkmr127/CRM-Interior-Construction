/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { Modal, Button, Badge, ContentLoader } from '../ui'
import { getTaskTemplates, deleteTaskTemplate } from '../../api/tasks'
import { useToast } from '../../store/toastContext'
import styles from './TemplateGalleryModal.module.css'

export default function TemplateGalleryModal({ isOpen, onClose, onUseTemplate }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'favorites', 'category'
  const toast = useToast()

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await getTaskTemplates()
      setTemplates(res.data?.data || res.data || [])
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) loadTemplates()
  }, [isOpen])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (window.confirm('Delete this template?')) {
      try {
        await deleteTaskTemplate(id)
        toast.success('Template deleted')
        loadTemplates()
      } catch {
        toast.error('Failed to delete')
      }
    }
  }

  const categories = ['all', 'favorites', ...new Set(templates.map(t => t.category))]

  const filtered = templates.filter(t => {
    if (filter === 'all') return true
    if (filter === 'favorites') return t.is_favorite
    return t.category === filter
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Template Gallery">
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.navTitle}>Categories</div>
          <ul className={styles.navList}>
            {categories.map(cat => (
              <li 
                key={cat} 
                className={filter === cat ? styles.active : ''}
                onClick={() => setFilter(cat)}
              >
                {cat === 'favorites' ? '⭐ Favorites' : cat === 'all' ? 'All Templates' : cat}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.main}>
          {loading ? (
            <ContentLoader />
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No templates found in this category.</div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(t => (
                <div key={t.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Badge variant="neutral">{t.category}</Badge>
                    {t.is_favorite && <span>⭐</span>}
                  </div>
                  <h3 className={styles.cardTitle}>{t.name}</h3>
                  <div className={styles.cardDesc}>
                    Creates: "{t.title}"<br/>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {t.checklist?.length || 0} checklist items • Priority: {t.priority}
                    </span>
                  </div>
                  <div className={styles.cardActions}>
                    <Button variant="primary" onClick={() => onUseTemplate(t)}>Use Template</Button>
                    <button className={styles.iconBtn} onClick={(e) => handleDelete(e, t.id)} title="Delete">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
