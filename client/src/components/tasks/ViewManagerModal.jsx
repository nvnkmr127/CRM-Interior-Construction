/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '../ui'
import styles from './TagManagerModal.module.css'
import { getTaskViews, createTaskView, updateTaskView, deleteTaskView } from '../../api/tasks'
import { useToast } from '../../store/toastContext'

export default function ViewManagerModal({ isOpen, onClose }) {
  const [views, setViews] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingViewId, setEditingViewId] = useState(null)
  const [editName, setEditName] = useState('')
  const toast = useToast()

  useEffect(() => {
    if (isOpen) loadViews()
  }, [isOpen])

  const loadViews = async () => {
    try {
      const res = await getTaskViews()
      setViews(res.data?.data || res.data || [])
    } catch (e) {
      toast.error('Failed to load views')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this view?')) return
    try {
      await deleteTaskView(id)
      setViews(v => v.filter(x => x.id !== id))
      toast.success('View deleted')
    } catch {
      toast.error('Failed to delete view')
    }
  }

  const handleUpdate = async (id, data) => {
    try {
      const res = await updateTaskView(id, data)
      const updated = res.data?.data || res.data
      if (data.is_default) {
        setViews(v => v.map(x => x.id === id ? updated : { ...x, is_default: false }))
      } else {
        setViews(v => v.map(x => x.id === id ? updated : x))
      }
      if (data.name) {
        setEditingViewId(null)
      }
      toast.success('View updated')
    } catch {
      toast.error('Failed to update view')
    }
  }

  const handleDuplicate = async (view) => {
    try {
      const res = await createTaskView({
        name: `${view.name} (Copy)`,
        is_shared: false,
        is_default: false,
        payload: view.payload
      })
      const newV = res.data?.data || res.data
      setViews([...views, newV])
      toast.success('View duplicated')
    } catch {
      toast.error('Failed to duplicate view')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Saved Views">
      <div className={styles.container}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
        ) : views.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No saved views found.</div>
        ) : (
          <div className={styles.tagList}>
            {views.map(view => (
              <div key={view.id} className={styles.tagRow}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingViewId === view.id ? (
                    <input 
                      autoFocus
                      className={styles.input}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleUpdate(view.id, { name: editName })
                        if (e.key === 'Escape') setEditingViewId(null)
                      }}
                      onBlur={() => handleUpdate(view.id, { name: editName })}
                    />
                  ) : (
                    <>
                      <div style={{ fontWeight: 500 }}>{view.name}</div>
                      {view.is_default && <Badge variant="primary">Default</Badge>}
                      {view.is_shared && <Badge variant="info">Shared</Badge>}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {!editingViewId && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingViewId(view.id)
                      setEditName(view.name)
                    }}>✏️</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(view)} title="Duplicate">📋</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleUpdate(view.id, { is_shared: !view.is_shared })} title="Toggle Share">
                    {view.is_shared ? '🔒' : '🌍'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleUpdate(view.id, { is_default: true })} title="Set Default">
                    ⭐
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(view.id)} style={{ color: 'var(--color-danger)' }}>🗑️</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
