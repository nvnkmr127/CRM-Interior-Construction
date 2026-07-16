/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-useless-assignment, no-unused-vars */
import { useState, useEffect } from 'react'
import styles from './MeetingNotesTab.module.css'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

export default function MeetingNotesTab({ projectId }) {
  const [meetingNotes, setMeetingNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  // Form State
  const [title, setTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [attendeeInput, setAttendeeInput] = useState('')
  const [attendees, setAttendees] = useState([])
  const [agenda, setAgenda] = useState('')
  const [discussionPoints, setDiscussionPoints] = useState('')
  const [decisions, setDecisions] = useState('')
  const [actionItems, setActionItems] = useState([])

  const toast = useToast()

  const fetchMeetingNotes = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/meeting-notes`)
      if (res.data?.success) {
        setMeetingNotes(res.data.data || [])
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load meeting notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetingNotes()
  }, [projectId])

  const openCreateModal = () => {
    setEditingNote(null)
    setTitle('')
    setMeetingDate(new Date().toISOString().substring(0, 16)) // Default to current time
    setAttendeeInput('')
    setAttendees([])
    setAgenda('')
    setDiscussionPoints('')
    setDecisions('')
    setActionItems([])
    setModalOpen(true)
  }

  const openEditModal = (note) => {
    setEditingNote(note)
    setTitle(note.title)
    
    // Format meeting_date for input datetime-local type (YYYY-MM-DDTHH:MM)
    const d = new Date(note.meeting_date)
    const tzoffset = d.getTimezoneOffset() * 60000 // offset in milliseconds
    const localISOTime = (new Date(d - tzoffset)).toISOString().slice(0, 16)
    
    setMeetingDate(localISOTime)
    setAttendeeInput('')
    
    // Attendees is parsed from JSON or array
    let parsedAttendees = []
    try {
      parsedAttendees = typeof note.attendees === 'string' ? JSON.parse(note.attendees) : (note.attendees || [])
    } catch (e) {
      parsedAttendees = note.attendees || []
    }
    
    setAttendees(parsedAttendees)
    setAgenda(note.agenda || '')
    setDiscussionPoints(note.discussion_points || '')
    setDecisions(note.decisions || '')
    
    // Map action items
    const ais = (note.action_items || []).map(ai => ({
      description: ai.description,
      owner_name: ai.owner_name,
      due_date: ai.due_date ? ai.due_date.substring(0, 10) : '',
      status: ai.status || 'pending'
    }))
    setActionItems(ais)
    setModalOpen(true)
  }

  const handleAddAttendee = (e) => {
    e.preventDefault()
    const name = attendeeInput.trim()
    if (name && !attendees.includes(name)) {
      setAttendees([...attendees, name])
      setAttendeeInput('')
    }
  }

  const handleRemoveAttendee = (name) => {
    setAttendees(attendees.filter(a => a !== name))
  }

  const handleAddActionItem = () => {
    setActionItems([...actionItems, { description: '', owner_name: '', due_date: '', status: 'pending' }])
  }

  const handleUpdateActionItemField = (index, field, value) => {
    const updated = [...actionItems]
    updated[index][field] = value
    setActionItems(updated)
  }

  const handleRemoveActionItemRow = (index) => {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  const handleToggleActionItemStatus = async (noteId, itemId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    try {
      const res = await api.post(`/projects/${projectId}/meeting-notes/${noteId}/action-items/${itemId}/toggle`, {
        status: newStatus
      })
      if (res.data?.success) {
        // Update state locally
        setMeetingNotes(prevNotes => prevNotes.map(n => {
          if (n.id === noteId) {
            return {
              ...n,
              action_items: n.action_items.map(ai => {
                if (ai.id === itemId) return { ...ai, status: newStatus }
                return ai
              })
            }
          }
          return n
        }))
        toast.success(`Action item marked as ${newStatus}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to update action item status.')
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!title.trim() || !meetingDate) {
      toast.error('Please enter a title and date.')
      return
    }

    const payload = {
      title,
      meeting_date: meetingDate,
      attendees,
      agenda,
      discussion_points: discussionPoints,
      decisions,
      action_items: actionItems.filter(ai => ai.description.trim() && ai.owner_name.trim())
    }

    try {
      let res
      if (editingNote) {
        res = await api.patch(`/projects/${projectId}/meeting-notes/${editingNote.id}`, payload)
      } else {
        res = await api.post(`/projects/${projectId}/meeting-notes`, payload)
      }

      if (res.data?.success) {
        toast.success(editingNote ? 'Meeting notes updated successfully.' : 'Meeting notes created successfully.')
        setModalOpen(false)
        fetchMeetingNotes()
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to save meeting notes.')
    }
  }

  const handleDelete = async (noteId) => {
    if (window.confirm('Are you sure you want to delete these meeting notes? This will also delete all linked action items.')) {
      try {
        const res = await api.delete(`/projects/${projectId}/meeting-notes/${noteId}`)
        if (res.data?.success) {
          toast.success('Meeting notes deleted successfully.')
          fetchMeetingNotes()
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to delete meeting notes.')
      }
    }
  }

  const formatDate = (dateStr, includeTime = false) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const options = {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
    if (includeTime) {
      options.hour = 'numeric'
      options.minute = '2-digit'
    }
    return d.toLocaleString('en-IN', options)
  }

  const parseAttendees = (att) => {
    if (!att) return []
    if (typeof att === 'string') {
      try { return JSON.parse(att) } catch (e) { return [] }
    }
    return att
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading meeting notes...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Project Meeting Notes</h2>
        <button className={styles.addBtn} onClick={openCreateModal}>
          ➕ Add Meeting Notes
        </button>
      </div>

      {meetingNotes.length === 0 ? (
        <div className={styles.emptyState}>
          No meeting notes captured for this project yet. Click "Add Meeting Notes" to record your first meeting.
        </div>
      ) : (
        <div className={styles.list}>
          {meetingNotes.map((note) => {
            const parsedAtt = parseAttendees(note.attendees)
            return (
              <div key={note.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleInfo}>
                    <h3 className={styles.cardTitle}>{note.title}</h3>
                    <span className={styles.cardDate}>
                      📅 {formatDate(note.meeting_date, true)}
                    </span>
                  </div>
                  <div className={styles.statusContainer}>
                    {note.client_sign_off_status === 'signed_off' ? (
                      <span className={`${styles.badge} ${styles.signed_off}`}>
                        ✓ Signed off
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.pending}`}>
                        ⏳ Pending Client sign-off
                      </span>
                    )}
                  </div>
                </div>

                {parsedAtt.length > 0 && (
                  <div className={styles.attendeesRow}>
                    <span className={styles.attendeeLabel}>Attendees:</span>
                    {parsedAtt.map((a, i) => (
                      <span key={i} className={styles.attendeeChip}>{a}</span>
                    ))}
                  </div>
                )}

                <div className={styles.gridContent}>
                  {note.agenda && (
                    <div className={styles.detailSection}>
                      <span className={styles.sectionLabel}>Agenda</span>
                      <p className={styles.sectionBody}>{note.agenda}</p>
                    </div>
                  )}
                  {note.discussion_points && (
                    <div className={styles.detailSection}>
                      <span className={styles.sectionLabel}>Discussion Points</span>
                      <p className={styles.sectionBody}>{note.discussion_points}</p>
                    </div>
                  )}
                  {note.decisions && (
                    <div className={styles.detailSection}>
                      <span className={styles.sectionLabel}>Decisions Made</span>
                      <p className={styles.sectionBody}>{note.decisions}</p>
                    </div>
                  )}
                </div>

                {note.action_items && note.action_items.length > 0 && (
                  <div className={styles.actionItemsContainer}>
                    <h4 className={styles.actionItemsTitle}>Action Items</h4>
                    <div className={styles.actionItemsList}>
                      {note.action_items.map((ai) => {
                        const isOverdue = ai.due_date && new Date(ai.due_date) < new Date() && ai.status !== 'completed'
                        return (
                          <div key={ai.id} className={`${styles.actionItem} ${ai.status === 'completed' ? styles.completed : ''}`}>
                            <input 
                              type="checkbox"
                              className={styles.checkbox}
                              checked={ai.status === 'completed'}
                              onChange={() => handleToggleActionItemStatus(note.id, ai.id, ai.status)}
                            />
                            <div className={styles.actionItemContent}>
                              <span className={styles.actionItemDesc}>{ai.description}</span>
                              <div className={styles.actionItemMeta}>
                                <span className={styles.ownerBadge}>👤 {ai.owner_name}</span>
                                {ai.due_date && (
                                  <span className={`${styles.dueDate} ${isOverdue ? styles.overdue : ''}`}>
                                    📅 {isOverdue ? 'Overdue: ' : 'Due '}{formatDate(ai.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  <button className={styles.editBtn} onClick={() => openEditModal(note)}>Edit</button>
                  <button className={styles.deleteBtn} onClick={() => handleDelete(note.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Dialog Form */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingNote ? 'Edit Meeting Notes' : 'New Meeting Notes'}</h3>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className={styles.modalBody}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Meeting Title</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Design Sync & Layout Discussion"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className={styles.input} 
                      value={meetingDate} 
                      onChange={(e) => setMeetingDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Attendees</label>
                  <div className={styles.attendeeInputRow}>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={attendeeInput} 
                      onChange={(e) => setAttendeeInput(e.target.value)}
                      placeholder="Type name and click Add"
                    />
                    <button className={styles.addBtn} type="button" onClick={handleAddAttendee}>
                      Add
                    </button>
                  </div>
                  {attendees.length > 0 && (
                    <div className={styles.attendeeTags}>
                      {attendees.map((att, idx) => (
                        <span key={idx} className={styles.attendeeTag}>
                          {att}
                          <button className={styles.removeTagBtn} type="button" onClick={() => handleRemoveAttendee(att)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Agenda</label>
                  <textarea 
                    className={styles.textarea} 
                    value={agenda} 
                    onChange={(e) => setAgenda(e.target.value)}
                    placeholder="What is the objective of the meeting?"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Discussion Points</label>
                  <textarea 
                    className={styles.textarea} 
                    value={discussionPoints} 
                    onChange={(e) => setDiscussionPoints(e.target.value)}
                    placeholder="What did the attendees discuss?"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Decisions Made</label>
                  <textarea 
                    className={styles.textarea} 
                    value={decisions} 
                    onChange={(e) => setDecisions(e.target.value)}
                    placeholder="What agreements or key decisions were finalized?"
                  />
                </div>

                <div className={styles.actionItemsForm}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className={styles.label}>Action Items</label>
                    <button className={styles.addBtn} style={{ padding: '4px 8px', fontSize: 11 }} type="button" onClick={handleAddActionItem}>
                      ➕ Add Action Item
                    </button>
                  </div>
                  
                  {actionItems.map((item, idx) => (
                    <div key={idx} className={styles.actionItemFormRow}>
                      <input 
                        type="text" 
                        className={styles.input} 
                        value={item.description} 
                        onChange={(e) => handleUpdateActionItemField(idx, 'description', e.target.value)}
                        placeholder="Description of task"
                        required
                      />
                      <input 
                        type="text" 
                        className={styles.input} 
                        value={item.owner_name} 
                        onChange={(e) => handleUpdateActionItemField(idx, 'owner_name', e.target.value)}
                        placeholder="Assignee / Owner"
                        required
                      />
                      <input 
                        type="date" 
                        className={styles.input} 
                        value={item.due_date} 
                        onChange={(e) => handleUpdateActionItemField(idx, 'due_date', e.target.value)}
                      />
                      <button className={styles.removeRowBtn} type="button" onClick={() => handleRemoveActionItemRow(idx)}>
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className={styles.saveBtn} type="submit">Save Notes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
