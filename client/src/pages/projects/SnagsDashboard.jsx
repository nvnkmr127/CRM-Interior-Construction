import { useState, useEffect, useMemo } from 'react'
import styles from './SnagsDashboard.module.css'
import { Badge, Button, Avatar, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'

const FILTERS = ['All', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Verified']

export default function SnagsDashboard({ projectId }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [snags, setSnags] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const toast = useToast()

  useEffect(() => {
    // Mock Fetch
    setTimeout(() => {
      setSnags([
        { id: '1', title: 'Paint peeling near window', desc: 'The paint is starting to peel off near the master bedroom window sill.', category: 'Paint', status: 'open', raisedBy: { type: 'client', name: 'Rajesh Sharma', date: new Date(Date.now()-86400000*3).toISOString() }, assignee: null, createdAt: new Date(Date.now()-86400000*3).toISOString(), slaHours: 48, photos: ['/placeholder.jpg'] },
        { id: '2', title: 'Loose electrical socket', desc: 'Living room TV unit socket is loose.', category: 'Electrical', status: 'assigned', raisedBy: { type: 'staff', name: 'Priya Mehta', date: new Date(Date.now()-86400000).toISOString() }, assignee: { name: 'Ravi Electrician' }, createdAt: new Date(Date.now()-86400000).toISOString(), slaHours: 24, photos: [] },
        { id: '3', title: 'Wardrobe door alignment', desc: 'Left door of master wardrobe scraping the bottom drawer.', category: 'Carpentry', status: 'in_progress', raisedBy: { type: 'client', name: 'Rajesh Sharma', date: new Date(Date.now()-3600000*5).toISOString() }, assignee: { name: 'Amit Carpenter' }, createdAt: new Date(Date.now()-3600000*5).toISOString(), slaHours: 72, photos: [] },
        { id: '4', title: 'Missing handle on kitchen cabinet', desc: 'Top right cabinet missing D-handle.', category: 'Kitchen', status: 'resolved', raisedBy: { type: 'client', name: 'Rajesh Sharma', date: new Date(Date.now()-86400000*5).toISOString() }, assignee: { name: 'Amit Carpenter' }, createdAt: new Date(Date.now()-86400000*5).toISOString(), slaHours: 48, photos: [] },
      ])
      setLoading(false)
    }, 600)
  }, [])

  const filteredSnags = useMemo(() => {
    if (activeFilter === 'All') return snags
    return snags.filter(s => {
      if (activeFilter === 'Verified') return s.status === 'client_verified'
      return s.status.toLowerCase().replace('_', ' ') === activeFilter.toLowerCase()
    })
  }, [snags, activeFilter])

  const counts = useMemo(() => {
    const c = { All: snags.length, Open: 0, Assigned: 0, 'In Progress': 0, Resolved: 0, Verified: 0 }
    snags.forEach(s => {
      if (s.status === 'open') c.Open++
      else if (s.status === 'assigned') c.Assigned++
      else if (s.status === 'in_progress') c['In Progress']++
      else if (s.status === 'resolved') c.Resolved++
      else if (s.status === 'client_verified') c.Verified++
    })
    return c
  }, [snags])

  const getSLAIndicator = (snag) => {
    if (snag.status === 'resolved' || snag.status === 'client_verified') return null
    const elapsedMs = Date.now() - new Date(snag.createdAt).getTime()
    const elapsedHrs = elapsedMs / 3600000
    const remainingHrs = snag.slaHours - elapsedHrs
    const percentRemaining = (remainingHrs / snag.slaHours) * 100

    if (remainingHrs <= 0) return <div className={`${styles.slaTimer} ${styles.slaRed}`}>SLA BREACHED ⚠</div>
    if (percentRemaining < 10) return <div className={`${styles.slaTimer} ${styles.slaRed}`}>{(remainingHrs).toFixed(1)}h left</div>
    if (percentRemaining < 50) return <div className={`${styles.slaTimer} ${styles.slaAmber}`}>{(remainingHrs).toFixed(1)}h left</div>
    return <div className={`${styles.slaTimer} ${styles.slaGreen}`}>{(remainingHrs).toFixed(1)}h left</div>
  }

  const handleStatusChange = (id, newStatus) => {
    setSnags(snags.map(s => s.id === id ? { ...s, status: newStatus } : s))
    toast.success(`Status updated to ${newStatus}`)
  }

  const confirmResolve = () => {
    if (!resolutionNote.trim()) return toast.error('Resolution notes required')
    setSnags(snags.map(s => s.id === resolveTarget.id ? { ...s, status: 'resolved', resolutionNote } : s))
    toast.success('Snag marked as resolved. Client will be notified to verify.')
    setResolveTarget(null)
    setResolutionNote('')
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Snags & Punch List</h1>
          <div className={styles.slaStrip}>
            {snags.filter(s => (Date.now() - new Date(s.createdAt).getTime()) / 3600000 > s.slaHours && !['resolved','client_verified'].includes(s.status)).length > 0 && (
              <Badge variant="danger">{snags.filter(s => (Date.now() - new Date(s.createdAt).getTime()) / 3600000 > s.slaHours && !['resolved','client_verified'].includes(s.status)).length} snags breaching SLA</Badge>
            )}
            <span className={styles.slaText}>48h average resolution time</span>
          </div>
        </div>
        <Button variant="primary" size="sm">+ Report Snag</Button>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <div 
            key={f} 
            className={`${styles.pill} ${activeFilter === f ? styles.active : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f} {f !== 'All' && `(${counts[f]})`}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{color:'var(--color-text-muted)'}}>Loading snags...</div>
      ) : filteredSnags.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✓</div>
          <div>No snags reported for this project. Great quality control!</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredSnags.map(snag => (
            <div key={snag.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <Badge variant="neutral">{snag.category}</Badge>
                <Badge variant={snag.status === 'resolved' ? 'success' : snag.status === 'open' ? 'danger' : 'warning'} style={{textTransform:'capitalize'}}>
                  {snag.status.replace('_', ' ')}
                </Badge>
              </div>

              <div>
                <div className={styles.cardTitle}>{snag.title}</div>
                <div className={styles.cardDesc}>{snag.desc}</div>
              </div>

              {snag.photos && snag.photos.length > 0 && (
                <div className={styles.photos}>
                  {snag.photos.map((p, i) => (
                    <div key={i} className={styles.photoThumb} style={{background:'#eee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#aaa'}}>IMG</div>
                  ))}
                </div>
              )}

              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <div className={styles.metaRow}>
                  <div className={styles.metaLabel}>Raised By</div>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    {snag.raisedBy.type === 'client' ? <span style={{color:'var(--color-accent)'}}>◉ Client</span> : <Avatar name={snag.raisedBy.name} size="xs" />}
                    <span>· {snag.raisedBy.name} · {Math.ceil((Date.now() - new Date(snag.raisedBy.date)) / 86400000)} days ago</span>
                  </div>
                </div>
                <div className={styles.metaRow}>
                  <div className={styles.metaLabel}>Assignee</div>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    {snag.assignee ? (
                      <><Avatar name={snag.assignee.name} size="xs" /> {snag.assignee.name}</>
                    ) : (
                      <span className={styles.unassigned}>⚠ Unassigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <div>{getSLAIndicator(snag)}</div>
                
                <div>
                  {snag.status === 'open' && <Button variant="secondary" size="sm" onClick={() => handleStatusChange(snag.id, 'assigned')}>Assign</Button>}
                  {snag.status === 'assigned' && <Button variant="primary" size="sm" onClick={() => handleStatusChange(snag.id, 'in_progress')}>Start Work</Button>}
                  {snag.status === 'in_progress' && <Button variant="primary" size="sm" onClick={() => setResolveTarget(snag)}>Resolve</Button>}
                  {snag.status === 'resolved' && <Badge variant="neutral">Awaiting Client Verification</Badge>}
                  {snag.status === 'client_verified' && <Badge variant="success">✓ Completed</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      <Modal
        isOpen={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        title="Mark Snag as Resolved"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={confirmResolve}>Mark Resolved</Button>
          </>
        }
      >
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <label style={{fontSize:'var(--text-sm)', fontWeight:500, color:'var(--color-text)'}}>Resolution notes *</label>
          <textarea 
            style={{width:'100%', minHeight:100, padding:12, borderRadius:8, border:'1px solid var(--color-border)', outline:'none', fontFamily:'inherit'}}
            placeholder="Describe what was done to fix this issue..."
            value={resolutionNote}
            onChange={e => setResolutionNote(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
