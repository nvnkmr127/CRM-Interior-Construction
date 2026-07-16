/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react'
import styles from './PortalApprovals.module.css'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

export default function PortalApprovals() {
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadedIds, setDownloadedIds] = useState(new Set())
  const [rejectingId, setRejectingId] = useState(null)
  const [revisionNote, setRevisionNote] = useState('')
  const [fadingId, setFadingId] = useState(null)
  const [showApproved, setShowApproved] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.get('/portal/approvals')
      .then(res => {
        const raw = res.data?.data || []
        setDesigns(raw.map(d => ({
          id: d.id,
          name: d.name,
          version: d.version || 'v1',
          uploader: 'Project Team',
          date: d.created_at,
          type: d.doc_type || 'image',
          status: 'pending',
          url: d.downloadUrl
        })))
      })
      .catch(() => toast.error('Failed to load approvals'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = (id, url) => {
    // window.open(url, '_blank')
    setDownloadedIds(new Set(downloadedIds).add(id))
  }

  const handleApprove = async (id) => {
    setFadingId(id)
    try {
      await api.post(`/portal/approvals/${id}/approve`);
      setDesigns(designs.map(d => d.id === id ? { ...d, status: 'approved', approvedAt: new Date().toISOString() } : d))
      setFadingId(null)
      toast.success('✓ Design approved!')
    } catch (e) {
      toast.error('Failed to approve design');
      setFadingId(null);
    }
  }

  const handleRequestChanges = async (id) => {
    if (!revisionNote.trim()) return toast.error('Please describe what needs to change')
    try {
      await api.post(`/portal/approvals/${id}/revision`, { note: revisionNote });
      setDesigns(designs.map(d => d.id === id ? { ...d, status: 'revision_requested', note: revisionNote } : d))
      setRejectingId(null)
      setRevisionNote('')
      toast.success('Revision requested successfully.')
    } catch (e) {
      toast.error('Failed to request revision');
    }
  }

  if (loading) return <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading approvals...</div>

  const pendingList = designs.filter(d => ['pending', 'revision_requested'].includes(d.status))
  const approvedList = designs.filter(d => d.status === 'approved')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Design Approvals</h1>
        <div className={styles.pageSub}>Review designs shared by your project team</div>
      </div>

      <div className={styles.list}>
        {pendingList.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <div className={styles.emptyTitle}>No designs awaiting your approval.</div>
            <div className={styles.emptyDesc}>We'll notify you when new designs are ready for review.</div>
          </div>
        ) : (
          pendingList.map(doc => (
            <div key={doc.id} className={`${styles.card} ${fadingId === doc.id ? styles.fadingOut : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.fileIcon} style={{background: doc.type === 'pdf' ? '#EF4444' : '#3B82F6'}}>
                  {doc.type === 'pdf' ? '📄' : '🖼'}
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.docName}>
                    {doc.name}
                    <span className={styles.versionBadge}>{doc.version}</span>
                  </div>
                  <div className={styles.metaText}>Uploaded by {doc.uploader} on {new Date(doc.date).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div>
                </div>
              </div>

              {doc.status === 'revision_requested' ? (
                <>
                  <div className={`${styles.statusBadge} ${styles.revision}`}>Revision Requested</div>
                  <div className={styles.revisionNote}>"{doc.note}"</div>
                </>
              ) : (
                <>
                  <button className={styles.dlBtn} onClick={() => handleDownload(doc.id, doc.url)}>
                    ⬇ Download & Review
                  </button>

                  {downloadedIds.has(doc.id) && (
                    <div className={styles.actionArea}>
                      <div className={styles.question}>Have you reviewed it?</div>
                      <button className={styles.approveBtn} onClick={() => handleApprove(doc.id)}>✓ Approve Design</button>
                      
                      {rejectingId === doc.id ? (
                        <div className={styles.revisionBox}>
                          <textarea 
                            className={styles.revisionTextarea}
                            placeholder="Describe what needs to change..."
                            value={revisionNote}
                            onChange={e => setRevisionNote(e.target.value)}
                            autoFocus
                          />
                          <div style={{display:'flex', gap:8}}>
                            <button className={styles.revisionSubmitBtn} style={{background:'transparent', color:'var(--color-danger)', border:'1px solid currentColor'}} onClick={() => {setRejectingId(null); setRevisionNote('')}}>Cancel</button>
                            <button className={styles.revisionSubmitBtn} onClick={() => handleRequestChanges(doc.id)}>Submit Revision</button>
                          </div>
                        </div>
                      ) : (
                        <button className={styles.rejectBtn} onClick={() => setRejectingId(doc.id)}>✗ Request Changes</button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {approvedList.length > 0 && (
        <div style={{marginTop: 16}}>
          <button className={styles.toggleBtn} onClick={() => setShowApproved(!showApproved)}>
            <span>{showApproved ? '▾' : '▸'}</span> View Approved ({approvedList.length})
          </button>
          
          {showApproved && (
            <div className={styles.list} style={{marginTop: 16}}>
              {approvedList.map(doc => (
                <div key={doc.id} className={`${styles.card} ${styles.approved}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.fileIcon} style={{background: '#9CA3AF'}}>
                      {doc.type === 'pdf' ? '📄' : '🖼'}
                    </div>
                    <div className={styles.fileInfo}>
                      <div className={styles.docName}>{doc.name} <span className={styles.versionBadge} style={{background:'#F3F4F6', color:'#6B7280'}}>{doc.version}</span></div>
                      <div className={styles.metaText}>Uploaded by {doc.uploader}</div>
                    </div>
                  </div>
                  <div className={`${styles.statusBadge} ${styles.approved}`}>
                    ✓ Approved on {new Date(doc.approvedAt).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
