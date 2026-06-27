import { useState, useEffect, useMemo } from 'react'
import styles from './SnagsDashboard.module.css'
import { Badge, Button, Avatar, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { getSnags, updateSnag } from '../../api/snags'

const FILTERS = ['All', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Verified']

export default function SnagsDashboard({ projectId }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [snags, setSnags] = useState([])
  const [loading, setLoading] = useState(true)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [reworkRequired, setReworkRequired] = useState(false)
  const [reworkRootCauseCategory, setReworkRootCauseCategory] = useState('workmanship_error')
  const [reworkEstimatedHours, setReworkEstimatedHours] = useState('0')
  const [reworkActualHours, setReworkActualHours] = useState('0')
  const [reworkCost, setReworkCost] = useState('0')
  const toast = useToast()

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    getSnags({ projectId })
      .then(res => {
        const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
        setSnags(raw.map(s => ({
          id: s.id,
          title: s.title,
          desc: s.description || s.desc || '',
          category: s.category || 'General',
          status: s.status || 'open',
          raisedBy: {
            type: s.raised_by_type || 'staff',
            name: s.raised_by_name || '—',
            date: s.created_at || s.raisedAt,
          },
          assignee: s.assignee_name ? { name: s.assignee_name } : null,
          createdAt: s.created_at || s.createdAt,
          slaHours: s.sla_hours || 48,
          photos: s.photos || [],
        })))
      })
      .catch(() => setSnags([]))
      .finally(() => setLoading(false))
  }, [projectId])

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

  const handleStatusChange = async (id, newStatus) => {
    setSnags(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    try {
      await updateSnag(id, { status: newStatus })
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
    } catch {
      setSnags(prev => prev.map(s => s.id === id ? { ...s, status: snags.find(x => x.id === id)?.status || s.status } : s))
      toast.error('Failed to update status')
    }
  }

  const confirmResolve = async () => {
    if (!resolutionNote.trim()) return toast.error('Resolution notes required')
    if (reworkRequired) {
      if (parseFloat(reworkEstimatedHours) < 0 || parseFloat(reworkActualHours) < 0 || parseFloat(reworkCost) < 0) {
        return toast.error('Rework numbers cannot be negative')
      }
    }
    try {
      await updateSnag(resolveTarget.id, { 
        status: 'resolved', 
        resolutionNote,
        reworkRequired,
        reworkRootCauseCategory: reworkRequired ? reworkRootCauseCategory : null,
        reworkEstimatedHours: reworkRequired ? parseFloat(reworkEstimatedHours) : 0,
        reworkActualHours: reworkRequired ? parseFloat(reworkActualHours) : 0,
        reworkCost: reworkRequired ? parseFloat(reworkCost) : 0
      })
      setSnags(prev => prev.map(s => s.id === resolveTarget.id ? { 
        ...s, 
        status: 'resolved', 
        resolutionNote,
        reworkRequired,
        reworkRootCauseCategory,
        reworkEstimatedHours,
        reworkActualHours,
        reworkCost
      } : s))
      toast.success('Snag resolved and rework logged.')
    } catch {
      toast.error('Failed to resolve snag')
    }
    setResolveTarget(null)
    setResolutionNote('')
    setReworkRequired(false)
    setReworkRootCauseCategory('workmanship_error')
    setReworkEstimatedHours('0')
    setReworkActualHours('0')
    setReworkCost('0')
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
            <Button variant="ghost" onClick={() => {
              setResolveTarget(null)
              setReworkRequired(false)
            }}>Cancel</Button>
            <Button variant="primary" onClick={confirmResolve}>Mark Resolved</Button>
          </>
        }
      >
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            <label style={{fontSize:'var(--text-sm)', fontWeight:600, color:'var(--color-text)'}}>Resolution notes *</label>
            <textarea 
              style={{width:'100%', minHeight:80, padding:12, borderRadius:8, border:'1px solid var(--color-border)', outline:'none', fontFamily:'inherit', fontSize:'var(--text-xs)'}}
              placeholder="Describe what was done to fix this issue..."
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value)}
              required
            />
          </div>

          <div style={{display:'flex', alignItems:'center', gap:8, borderTop:'1px solid var(--color-border)', paddingTop:12}}>
            <input 
              type="checkbox" 
              id="reworkCheckbox"
              checked={reworkRequired} 
              onChange={e => setReworkRequired(e.target.checked)} 
              style={{cursor:'pointer'}}
            />
            <label htmlFor="reworkCheckbox" style={{fontSize:'var(--text-sm)', fontWeight:600, color:'var(--color-text)', cursor:'pointer'}}>
              Defect required rework (materials replaced or correction hours spent)
            </label>
          </div>

          {reworkRequired && (
            <div style={{display:'flex', flexDirection:'column', gap:12, padding:12, borderRadius:8, background:'var(--color-bg-subtle, #f9fafb)', border:'1px solid var(--color-border)'}}>
              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                <label style={{fontSize:'11px', fontWeight:600, color:'var(--color-text-muted)'}}>Root Cause Category</label>
                <select 
                  style={{width:'100%', padding:8, borderRadius:6, border:'1px solid var(--color-border)', outline:'none', fontSize:'var(--text-xs)'}}
                  value={reworkRootCauseCategory}
                  onChange={e => setReworkRootCauseCategory(e.target.value)}
                >
                  <option value="workmanship_error">Workmanship Error</option>
                  <option value="material_defect">Material Defect</option>
                  <option value="design_flaw">Design Flaw</option>
                  <option value="site_damage">Site / Transit Damage</option>
                  <option value="vendor_fault">Vendor Fault</option>
                  <option value="other">Other / General</option>
                </select>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <label style={{fontSize:'11px', fontWeight:600, color:'var(--color-text-muted)'}}>Est. Rework Hours</label>
                  <input 
                    type="number" 
                    step="0.1"
                    style={{width:'100%', padding:8, borderRadius:6, border:'1px solid var(--color-border)', outline:'none', fontSize:'var(--text-xs)'}}
                    value={reworkEstimatedHours}
                    onChange={e => setReworkEstimatedHours(e.target.value)}
                  />
                </div>

                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                  <label style={{fontSize:'11px', fontWeight:600, color:'var(--color-text-muted)'}}>Actual Rework Hours</label>
                  <input 
                    type="number" 
                    step="0.1"
                    style={{width:'100%', padding:8, borderRadius:6, border:'1px solid var(--color-border)', outline:'none', fontSize:'var(--text-xs)'}}
                    value={reworkActualHours}
                    onChange={e => setReworkActualHours(e.target.value)}
                  />
                </div>
              </div>

              <div style={{display:'flex', flexDirection:'column', gap:4}}>
                <label style={{fontSize:'11px', fontWeight:600, color:'var(--color-text-muted)'}}>Total Rework Cost (₹)</label>
                <input 
                  type="number" 
                  step="1"
                  style={{width:'100%', padding:8, borderRadius:6, border:'1px solid var(--color-border)', outline:'none', fontSize:'var(--text-xs)'}}
                  value={reworkCost}
                  onChange={e => setReworkCost(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
