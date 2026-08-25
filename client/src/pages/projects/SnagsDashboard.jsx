/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
import { useState, useEffect, useMemo } from 'react'
import styles from './SnagsDashboard.module.css'
import { Badge, Button, Avatar, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { getSnags, updateSnag, createSnag } from '../../api/snags'
import { getVendorCoordination, getExternalInspections, createExternalInspection, updateExternalInspection } from '../../api/projects'
import { getSnagsAnalytics } from '../../api/analytics'

const FILTERS = ['All', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Verified']

export default function SnagsDashboard({ projectId, projectStatus }) {
  const [activeTab, setActiveTab] = useState('internal') // 'internal' | 'external'
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
  
  const [vendors, setVendors] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [newSnag, setNewSnag] = useState({ title: '', desc: '', category: 'General', rootCauseCategory: '', vendorId: '' })
  
  const [externalInspections, setExternalInspections] = useState([])
  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false)
  const [newExternal, setNewExternal] = useState({ inspectorName: '', organization: '', inspectionDate: '', findings: '', severity: 'medium' })
  
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
          vendor_id: s.vendor_id,
          rootCauseCategory: s.root_cause_category,
        })))
      })
      .catch(() => setSnags([]))
      .finally(() => setLoading(false))

    getVendorCoordination(projectId)
      .then(res => setVendors(res || []))
      .catch(() => setVendors([]))

    getSnagsAnalytics(projectId)
      .then(res => setAnalytics(res))
      .catch(() => setAnalytics(null))

    getExternalInspections(projectId)
      .then(res => setExternalInspections(res || []))
      .catch(() => setExternalInspections([]))
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
    if (projectStatus === 'completed') {
      toast.warning('Cannot change snag status on a completed project.');
      return;
    }
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
    if (projectStatus === 'completed') {
      toast.warning('Cannot resolve snags on a completed project.');
      return;
    }
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
        reworkCost: reworkRequired ? parseFloat(reworkCost) : 0,
        rootCauseCategory: reworkRootCauseCategory,
        vendorId: resolveTarget.vendor_id || null
      })
      setSnags(prev => prev.map(s => s.id === resolveTarget.id ? { 
        ...s, 
        status: 'resolved', 
        resolutionNote,
        reworkRequired,
        reworkRootCauseCategory: reworkRequired ? reworkRootCauseCategory : null,
        reworkEstimatedHours,
        reworkActualHours,
        reworkCost,
        rootCauseCategory: reworkRootCauseCategory,
        vendor_id: resolveTarget.vendor_id
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

  const submitNewSnag = async () => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot report snags on a completed project.');
      return;
    }
    if (!newSnag.title.trim()) return toast.error('Title is required')
    try {
      const res = await createSnag(projectId, {
        projectId,
        title: newSnag.title,
        description: newSnag.desc,
        category: newSnag.category,
        rootCauseCategory: newSnag.rootCauseCategory || null,
        vendorId: newSnag.vendorId || null
      })
      
      setSnags(prev => [{
        id: res.id,
        title: res.title,
        desc: res.description || '',
        category: res.category || 'General',
        status: res.status || 'open',
        raisedBy: { type: 'staff', name: 'Me', date: new Date().toISOString() },
        assignee: null,
        createdAt: new Date().toISOString(),
        slaHours: 48,
        photos: []
      }, ...prev])

      toast.success('Snag reported successfully')
      setIsReportModalOpen(false)
      setNewSnag({ title: '', desc: '', category: 'General', rootCauseCategory: '', vendorId: '' })
    } catch {
      toast.error('Failed to report snag')
    }
  }

  const submitNewExternal = async () => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot log external inspections on a completed project.');
      return;
    }
    if (!newExternal.inspectorName.trim() || !newExternal.inspectionDate) return toast.error('Inspector name and date are required')
    try {
      const res = await createExternalInspection(projectId, newExternal)
      setExternalInspections([res, ...externalInspections])
      toast.success('External inspection logged successfully')
      setIsExternalModalOpen(false)
      setNewExternal({ inspectorName: '', organization: '', inspectionDate: '', findings: '', severity: 'medium' })
    } catch {
      toast.error('Failed to log external inspection')
    }
  }

  const updateExtStatus = async (id, status) => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot update external inspections status on a completed project.');
      return;
    }
    try {
      await updateExternalInspection(projectId, id, { status })
      setExternalInspections(prev => prev.map(e => e.id === id ? { ...e, status } : e))
      toast.success(`Marked as ${status.replace('_', ' ')}`)
    } catch {
      toast.error('Failed to update status')
    }
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
        <div className={styles.headerActions}>
          <div style={{display:'flex', gap:8}}>
            <Button variant={activeTab === 'internal' ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab('internal')}>Internal QC Snags</Button>
            <Button variant={activeTab === 'external' ? 'primary' : 'outline'} size="sm" onClick={() => setActiveTab('external')}>Third-Party Inspections</Button>
          </div>
          {projectStatus !== 'completed' && (
            activeTab === 'internal' ? (
              <Button variant="primary" size="sm" onClick={() => setIsReportModalOpen(true)}>+ Report Snag</Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setIsExternalModalOpen(true)}>+ Log External Inspection</Button>
            )
          )}
        </div>
      </div>

      {activeTab === 'internal' && (
        <>

          {analytics && (
            <div className={styles.analyticsGrid}>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsCardTitle}>Defects by Root Cause</div>
                <div className={styles.analyticsList}>
                  {(analytics.byRootCause || []).length === 0 && <div className={styles.noData}>No data</div>}
                  {(analytics.byRootCause || []).map(item => (
                    <div key={item.label} className={styles.analyticsRow}>
                      <span className={styles.analyticsLabel}>{item.label.replace('_', ' ')}</span>
                      <span className={styles.analyticsValue}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsCardTitle}>Defects by Vendor</div>
                <div className={styles.analyticsList}>
                  {(analytics.byVendor || []).length === 0 && <div className={styles.noData}>No data</div>}
                  {(analytics.byVendor || []).map(item => (
                    <div key={item.label} className={styles.analyticsRow}>
                      <span className={styles.analyticsLabel}>{item.label}</span>
                      <span className={styles.analyticsValue}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                        <div key={i} className={styles.photoThumb}>IMG</div>
                      ))}
                    </div>
                  )}

                  <div className={styles.metaSection}>
                    <div className={styles.metaRow}>
                      <div className={styles.metaLabel}>Raised By</div>
                      <div className={styles.metaValueContainer}>
                        {snag.raisedBy.type === 'client' ? <span className={styles.clientBadge}>◉ Client</span> : <Avatar name={snag.raisedBy.name} size="xs" />}
                        <span>· {snag.raisedBy.name} · {Math.ceil((Date.now() - new Date(snag.raisedBy.date)) / 86400000)} days ago</span>
                      </div>
                    </div>
                    <div className={styles.metaRow}>
                      <div className={styles.metaLabel}>Assignee</div>
                      <div className={styles.metaValueContainer}>
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
                      {snag.status === 'open' && <Button variant="secondary" size="sm" onClick={() => handleStatusChange(snag.id, 'assigned')} disabled={projectStatus === 'completed'}>Assign</Button>}
                      {snag.status === 'assigned' && <Button variant="primary" size="sm" onClick={() => handleStatusChange(snag.id, 'in_progress')} disabled={projectStatus === 'completed'}>Start Work</Button>}
                      {snag.status === 'in_progress' && <Button variant="primary" size="sm" onClick={() => { setResolveTarget(snag); if (snag.rootCauseCategory) setReworkRootCauseCategory(snag.rootCauseCategory); }} disabled={projectStatus === 'completed'}>Resolve</Button>}
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
                <Button variant="primary" onClick={confirmResolve} disabled={projectStatus === 'completed'}>Mark Resolved</Button>
              </>
            }
          >
            <div className={styles.formGroup} style={{gap:16}}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Resolution notes *</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="Describe what was done to fix this issue..."
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  required
                  disabled={projectStatus === 'completed'}
                />
              </div>

              <div className={styles.grid2Col}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Root Cause Category</label>
                  <select 
                    className={styles.select}
                    value={reworkRootCauseCategory}
                    onChange={e => setReworkRootCauseCategory(e.target.value)}
                    disabled={projectStatus === 'completed'}
                  >
                    <option value="workmanship_error">Workmanship Error</option>
                    <option value="material_defect">Material Defect</option>
                    <option value="design_flaw">Design Flaw</option>
                    <option value="site_damage">Site / Transit Damage</option>
                    <option value="vendor_fault">Vendor Fault</option>
                    <option value="other">Other / General</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Responsible Vendor</label>
                  <select 
                    className={styles.select}
                    value={resolveTarget?.vendor_id || ''}
                    onChange={e => setResolveTarget(prev => ({ ...prev, vendor_id: e.target.value }))}
                    disabled={projectStatus === 'completed'}
                  >
                    <option value="">No specific vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.checkboxGroup}>
                <input 
                  type="checkbox" 
                  id="reworkCheckbox"
                  checked={reworkRequired} 
                  onChange={e => setReworkRequired(e.target.checked)} 
                  style={{cursor:'pointer'}}
                  disabled={projectStatus === 'completed'}
                />
                <label htmlFor="reworkCheckbox" className={styles.checkboxLabel}>
                  Defect required rework (materials replaced or correction hours spent)
                </label>
              </div>

              {reworkRequired && (
                <div className={styles.reworkContainer}>
                  <div className={styles.grid2Col}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Est. Rework Hours</label>
                      <input 
                        type="number" 
                        step="0.1"
                        className={styles.input}
                        value={reworkEstimatedHours}
                        onChange={e => setReworkEstimatedHours(e.target.value)}
                        disabled={projectStatus === 'completed'}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Actual Rework Hours</label>
                      <input 
                        type="number" 
                        step="0.1"
                        className={styles.input}
                        value={reworkActualHours}
                        onChange={e => setReworkActualHours(e.target.value)}
                        disabled={projectStatus === 'completed'}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Total Rework Cost (₹)</label>
                    <input 
                      type="number" 
                      step="1"
                      className={styles.input}
                      value={reworkCost}
                      onChange={e => setReworkCost(e.target.value)}
                      disabled={projectStatus === 'completed'}
                    />
                  </div>
                </div>
              )}
            </div>
          </Modal>

          {/* Report Snag Modal */}
          <Modal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            title="Report New Snag"
            footer={
              <>
                <Button variant="ghost" onClick={() => setIsReportModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={submitNewSnag} disabled={projectStatus === 'completed'}>Report Snag</Button>
              </>
            }
          >
            <div className={styles.formGroup} style={{gap:16}}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title *</label>
                <input 
                  className={styles.input}
                  placeholder="e.g. Broken tile in master bathroom"
                  value={newSnag.title}
                  onChange={e => setNewSnag({...newSnag, title: e.target.value})}
                  disabled={projectStatus === 'completed'}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <textarea 
                  className={styles.textarea}
                  placeholder="Provide more details..."
                  value={newSnag.desc}
                  onChange={e => setNewSnag({...newSnag, desc: e.target.value})}
                  disabled={projectStatus === 'completed'}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.label}>Category</label>
                <select 
                  className={styles.select}
                  value={newSnag.category}
                  onChange={e => setNewSnag({...newSnag, category: e.target.value})}
                  disabled={projectStatus === 'completed'}
                >
                  <option value="Civil">Civil</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Carpentry">Carpentry</option>
                  <option value="Painting">Painting</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>
          </Modal>
        </>
      )}

       {activeTab === 'external' && (
        <>
          <div className={styles.grid}>
            {externalInspections.length === 0 && <div style={{color:'var(--color-text-muted)'}}>No external inspections logged.</div>}
            {externalInspections.map(ext => (
              <div key={ext.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <Badge variant={ext.severity === 'critical' || ext.severity === 'high' ? 'danger' : 'warning'} style={{textTransform:'capitalize'}}>
                    {ext.severity} Severity
                  </Badge>
                  <Badge variant={ext.status === 'resolved' || ext.status === 'closed' ? 'success' : 'neutral'} style={{textTransform:'capitalize'}}>
                    {ext.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div>
                  <div className={styles.cardTitle}>{ext.inspector_name} {ext.organization && `(${ext.organization})`}</div>
                  <div style={{fontSize:'var(--text-xs)', color:'var(--color-text-muted)', marginBottom:12}}>Date: {new Date(ext.inspection_date).toLocaleDateString()}</div>
                  <div className={styles.cardDesc} style={{whiteSpace:'pre-wrap'}}>{ext.findings || 'No findings provided.'}</div>
                </div>

                <div className={styles.cardFooter}>
                  <div></div>
                  <div style={{display:'flex', gap:8}}>
                    {ext.status === 'open' && <Button variant="secondary" size="sm" onClick={() => updateExtStatus(ext.id, 'in_progress')} disabled={projectStatus === 'completed'}>Start Fixes</Button>}
                    {ext.status === 'in_progress' && <Button variant="primary" size="sm" onClick={() => updateExtStatus(ext.id, 'resolved')} disabled={projectStatus === 'completed'}>Resolve</Button>}
                    {ext.status === 'resolved' && <Button variant="outline" size="sm" onClick={() => updateExtStatus(ext.id, 'closed')} disabled={projectStatus === 'completed'}>Close</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Modal
            isOpen={isExternalModalOpen}
            onClose={() => setIsExternalModalOpen(false)}
            title="Log Third-Party Inspection"
            footer={
              <>
                <Button variant="ghost" onClick={() => setIsExternalModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={submitNewExternal} disabled={projectStatus === 'completed'}>Save Inspection</Button>
              </>
            }
          >
            <div className={styles.formGroup} style={{gap:16}}>
              <div className={styles.grid2Col}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Inspector Name *</label>
                  <input 
                    className={styles.input}
                    value={newExternal.inspectorName}
                    onChange={e => setNewExternal({...newExternal, inspectorName: e.target.value})}
                    disabled={projectStatus === 'completed'}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Organization</label>
                  <input 
                    className={styles.input}
                    placeholder="e.g. Client Rep, City Inspector"
                    value={newExternal.organization}
                    onChange={e => setNewExternal({...newExternal, organization: e.target.value})}
                    disabled={projectStatus === 'completed'}
                  />
                </div>
              </div>

              <div className={styles.grid2Col}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Inspection Date *</label>
                  <input 
                    type="date"
                    className={styles.input}
                    value={newExternal.inspectionDate}
                    onChange={e => setNewExternal({...newExternal, inspectionDate: e.target.value})}
                    disabled={projectStatus === 'completed'}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Severity</label>
                  <select 
                    className={styles.select}
                    value={newExternal.severity}
                    onChange={e => setNewExternal({...newExternal, severity: e.target.value})}
                    disabled={projectStatus === 'completed'}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Findings / Notes</label>
                <textarea 
                  className={styles.textarea}
                  style={{minHeight: 100}}
                  placeholder="Summarize the inspector's findings..."
                  value={newExternal.findings}
                  onChange={e => setNewExternal({...newExternal, findings: e.target.value})}
                  disabled={projectStatus === 'completed'}
                />
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}
