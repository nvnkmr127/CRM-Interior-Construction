/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import api from '../../api/axios'
import styles from './PortalDocuments.module.css'

const FILTERS = ['All', 'Drawings', 'BOQ', 'Renders', 'Contracts', 'Photos', 'Daily Site Reports']

const mapCategory = (type) => {
  if (type === 'drawing') return 'Drawings';
  if (type === 'boq') return 'BOQ';
  if (type === 'render') return 'Renders';
  if (type === 'contract') return 'Contracts';
  if (type === 'photo') return 'Photos';
  if (type === 'daily_site_report') return 'Daily Site Reports';
  
  if (type === 'Drawing') return 'Drawings';
  if (type === 'BOQ') return 'BOQ';
  if (type === 'Render') return 'Renders';
  if (type === 'Contract') return 'Contracts';
  if (type === 'Photo') return 'Photos';
  if (type === 'Daily Site Report') return 'Daily Site Reports';

  return type || 'Other';
};

export default function PortalDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  // Comments state
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Revision Modal state
  const [revisionDoc, setRevisionDoc] = useState(null)
  const [revisionNote, setRevisionNote] = useState('')

  const fetchDocs = () => {
    setLoading(true)
    api.get('/portal/project/documents')
      .then(res => {
        const raw = res.data?.data || []
        setDocuments(raw.map(d => ({
          id: d.id,
          name: d.name,
          category: mapCategory(d.docType),
          type: d.mimeType?.includes('pdf') ? 'pdf' : d.mimeType?.includes('image') ? 'image' : d.mimeType?.includes('sheet') ? 'sheet' : 'doc',
          version: `v${d.version || 1}`,
          addedAt: d.createdAt,
          clientApprovalStatus: d.clientApprovalStatus || 'pending',
          clientApprovedAt: d.clientApprovedAt,
          clientRevisionRequestedAt: d.clientRevisionRequestedAt,
          clientRevisionNote: d.clientRevisionNote,
          downloadUrl: d.downloadUrl
        })))
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const filteredDocs = activeFilter === 'All' 
    ? documents 
    : documents.filter(d => d.category === activeFilter)

  const handleDownload = (url) => {
    if (url) window.open(url, '_blank')
    else alert('Download link unavailable')
  }

  const handleApprove = async (docId) => {
    if (!window.confirm('Are you sure you want to approve this document? This is a formal approval.')) return;
    try {
      await api.post(`/portal/project/documents/${docId}/approve`)
      fetchDocs()
    } catch (err) {
      console.error(err)
      alert('Failed to approve document.')
    }
  }

  const submitRevision = async (e) => {
    e.preventDefault();
    if (!revisionNote.trim() || !revisionDoc) return;
    try {
      await api.post(`/portal/project/documents/${revisionDoc.id}/request-revision`, { revisionNote });
      setRevisionDoc(null);
      setRevisionNote('');
      fetchDocs();
    } catch (err) {
      console.error(err)
      alert('Failed to request revision.')
    }
  }

  const handleOpenComments = async (doc) => {
    setSelectedDoc(doc)
    setIsDrawerOpen(true)
    try {
      const res = await api.get(`/portal/project/documents/${doc.id}/comments`)
      setComments(res.data?.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      const res = await api.post(`/portal/project/documents/${selectedDoc.id}/comments`, { comment: newComment })
      setComments(prev => [...prev, res.data.data])
      setNewComment('')
    } catch (err) {
      console.error(err)
      alert('Failed to submit comment.')
    }
  }

  const getIconClass = (type) => {
    if (type === 'pdf') return styles.pdf
    if (type === 'image') return styles.image
    if (type === 'sheet') return styles.sheet
    if (type === 'doc') return styles.doc
    return ''
  }

  const getIconChar = (type) => {
    if (type === 'pdf') return '📄'
    if (type === 'image') return '🖼'
    if (type === 'sheet') return '📊'
    if (type === 'doc') return '📝'
    return '📁'
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Project Documents</h1>
        <div className={styles.pageSub}>Review, approve, and download project files.</div>
      </div>

      <div className={styles.filterStrip}>
        {FILTERS.map(f => (
          <button 
            key={f} 
            className={`${styles.filterBtn} ${activeFilter === f ? styles.active : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading documents...</div>
      ) : filteredDocs.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <div className={styles.emptyTitle}>No documents found</div>
          <div style={{color:'var(--color-text-secondary)', fontSize:'var(--text-sm)'}}>Check back later or adjust your filters.</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredDocs.map(doc => (
            <div key={doc.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={`${styles.fileIcon} ${getIconClass(doc.type)}`}>
                  {getIconChar(doc.type)}
                </div>
                <div className={styles.docInfo}>
                  <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4}}>
                    <span className={styles.versionBadge}>{doc.version}</span>
                    {doc.clientApprovalStatus === 'approved' && (
                      <span className={styles.ackBadge}>✓ Approved</span>
                    )}
                    {doc.clientApprovalStatus === 'revision_requested' && (
                      <span className={styles.pendingBadge} style={{backgroundColor: '#fff3cd', color: '#856404'}}>⚠️ Revision Requested</span>
                    )}
                    {(!doc.clientApprovalStatus || doc.clientApprovalStatus === 'pending') && (
                      <span className={styles.pendingBadge}>Pending Approval</span>
                    )}
                  </div>
                  <div className={styles.docName} title={doc.name}>{doc.name}</div>
                  <div className={styles.metaText}>
                    Shared on {new Date(doc.addedAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
                  </div>
                  {doc.clientApprovalStatus === 'approved' && doc.clientApprovedAt && (
                    <div className={styles.ackDetails}>
                      Approved on {new Date(doc.clientApprovedAt).toLocaleDateString('en-IN')}
                    </div>
                  )}
                  {doc.clientApprovalStatus === 'revision_requested' && doc.clientRevisionRequestedAt && (
                    <div className={styles.ackDetails} style={{color: '#856404'}}>
                      Revision requested on {new Date(doc.clientRevisionRequestedAt).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.cardActions}>
                <button className={styles.dlBtn} onClick={() => handleDownload(doc.downloadUrl)}>
                  ⬇ Download
                </button>
                <button className={styles.commentsBtn} onClick={() => handleOpenComments(doc)}>
                  💬 Discuss
                </button>
                
                {(!doc.clientApprovalStatus || doc.clientApprovalStatus === 'pending') && (
                  <>
                    <button className={styles.ackBtn} onClick={() => handleApprove(doc.id)} style={{backgroundColor: 'var(--color-success)', color: 'white'}}>
                      ✓ Approve
                    </button>
                    <button className={styles.ackBtn} onClick={() => setRevisionDoc(doc)} style={{backgroundColor: '#fff3cd', color: '#856404'}}>
                      ✏️ Request Revision
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revision Modal */}
      {revisionDoc && (
        <div className={styles.drawerOverlay} onClick={() => setRevisionDoc(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{background: 'var(--color-surface)', padding: 24, borderRadius: 12, maxWidth: 400, margin: '10vh auto'}}>
            <h3 style={{marginTop: 0, marginBottom: 8}}>Request Revision</h3>
            <p style={{fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16}}>
              Please describe the changes needed for <strong>{revisionDoc.name}</strong>.
            </p>
            <form onSubmit={submitRevision}>
              <textarea
                value={revisionNote}
                onChange={e => setRevisionNote(e.target.value)}
                placeholder="Details of requested changes..."
                required
                style={{width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 16, fontFamily: 'inherit'}}
              />
              <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
                <button type="button" onClick={() => setRevisionDoc(null)} style={{padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)'}}>Cancel</button>
                <button type="submit" style={{padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer'}}>Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comments Sidebar/Drawer */}
      {selectedDoc && (
        <div className={`${styles.drawerOverlay} ${isDrawerOpen ? styles.show : ''}`} onClick={() => setIsDrawerOpen(false)}>
          <div className={`${styles.drawer} ${isDrawerOpen ? styles.open : ''}`} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>Document Discussion</div>
              <button className={styles.closeBtn} onClick={() => setIsDrawerOpen(false)}>×</button>
            </div>
            <div className={styles.drawerDocInfo}>
              <div className={styles.drawerDocName}>{selectedDoc.name}</div>
              <span className={styles.metaText}>Category: {selectedDoc.category}</span>
            </div>
            <div className={styles.commentList}>
              {comments.length === 0 ? (
                <div className={styles.emptyComments}>No comments yet. Start the conversation below!</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className={`${styles.commentWrapper} ${c.created_by_client ? styles.client : styles.staff}`}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{c.created_by_name}</span>
                      <span className={styles.commentTime}>
                        {new Date(c.created_at).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})} on {new Date(c.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <div className={styles.commentBody}>{c.comment}</div>
                  </div>
                ))
              )}
            </div>
            <form className={styles.commentForm} onSubmit={handlePostComment}>
              <textarea 
                className={styles.commentInput}
                placeholder="Type a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                required
              />
              <button type="submit" className={styles.submitBtn}>Send Comment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
