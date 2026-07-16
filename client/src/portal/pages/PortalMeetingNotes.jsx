/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react'
import styles from './PortalMeetingNotes.module.css'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

export default function PortalMeetingNotes() {
  const [meetingNotes, setMeetingNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  
  const toast = useToast()

  const fetchMeetingNotes = async () => {
    try {
      const res = await api.get('/portal/project/meeting-notes')
      if (res.data?.success) {
        setMeetingNotes(res.data.data || [])
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load meeting notes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetingNotes()
  }, [])

  const handleSignOff = async (noteId) => {
    setProcessingId(noteId)
    try {
      const res = await api.post(`/portal/project/meeting-notes/${noteId}/sign-off`)
      if (res.data?.success) {
        toast.success('Meeting notes signed off successfully!')
        fetchMeetingNotes() // Refresh list
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to sign off meeting notes.')
    } finally {
      setProcessingId(null)
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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Meeting Notes & Decisions</h1>
        <div className={styles.pageSub}>Review verbal discussions, critical project decisions, and assigned action items.</div>
      </div>

      {meetingNotes.length === 0 ? (
        <div className={styles.emptyState}>No meeting notes have been published for this project yet.</div>
      ) : (
        <div className={styles.meetingList}>
          {meetingNotes.map((note) => {
            const parsedAtt = parseAttendees(note.attendees)
            return (
              <div key={note.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleInfo}>
                    <h2 className={styles.cardTitle}>{note.title}</h2>
                    <span className={styles.cardDate}>
                      📅 {formatDate(note.meeting_date, true)}
                    </span>
                  </div>
                  <div>
                    {note.client_sign_off_status === 'signed_off' ? (
                      <span className={`${styles.badge} ${styles.signed_off}`}>
                        ✓ Signed off
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.pending}`}>
                        ⏳ Pending Your sign-off
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
                            <div className={styles.statusIndicator}>
                              {ai.status === 'completed' ? '✓' : ''}
                            </div>
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

                <div className={styles.signoffContainer}>
                  {note.client_sign_off_status === 'signed_off' ? (
                    <div className={styles.signedOffText}>
                      <span>✓ You signed off on these notes on {formatDate(note.client_signed_off_at, true)}</span>
                    </div>
                  ) : (
                    <button 
                      className={styles.signoffBtn}
                      disabled={processingId === note.id}
                      onClick={() => handleSignOff(note.id)}
                    >
                      {processingId === note.id ? 'Signing off...' : '✍ Sign Off & Approve Meeting Notes'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
