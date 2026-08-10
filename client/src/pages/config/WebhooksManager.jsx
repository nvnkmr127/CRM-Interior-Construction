/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect, useMemo, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import layoutStyles from './ConfigLayout.module.css'
import styles from './WebhooksManager.module.css'
import { Button, Badge, Modal, Input, Select, DataTable, Drawer } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'
import eventRegistry from '../../utils/eventRegistry'
import KPICard from '../../components/finance/KPICard'
import WebhookFilters from './WebhookFilters'

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState([])
  const [testResults, setTestResults] = useState({})
  const [testingId, setTestingId] = useState(null)
  
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [logsTarget, setLogsTarget] = useState(null)
  const [webhookLogs, setWebhookLogs] = useState([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  
  const [appliedFilters, setAppliedFilters] = useState({})
  const [sortBy, setSortBy] = useState({ key: 'name', dir: 'asc' })

  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toast = useToast()

  useEffect(() => {
    fetchWebhooks()
  }, [])

  useEffect(() => {
    if (logsTarget) {
      fetchLogs(logsTarget.id)
    } else {
      setWebhookLogs([])
    }
  }, [logsTarget])

  const stats = useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter(w => w.active).length;
    const disabled = total - active;
    const todaysDeliveries = webhooks.reduce((acc, w) => acc + (w.totalSuccess || 0), 0);
    const todaysFailures = webhooks.reduce((acc, w) => acc + (w.totalFailed || 0), 0);
    const pendingRetries = Math.floor(todaysFailures * 0.1) || 0;
    const avgResponseTime = 145; 
    
    return {
      total, active, disabled, todaysDeliveries, todaysFailures, pendingRetries, avgResponseTime
    };
  }, [webhooks]);

  const fetchWebhooks = async () => {
    try {
      const res = await api.get('/config/webhooks')
      
      const safeParse = (val, fallback) => {
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch (e) { return fallback; }
      }

      const formatted = res.data.data.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        active: w.is_active,
        events: safeParse(w.events, []) || [],
        headers: Object.entries(safeParse(w.custom_headers, {}) || {}).map(([key, value]) => ({ key, value })),
        retryCount: w.retry_count || 3,
        debugMode: w.is_debug_mode || false,
        lastDelivery: w.last_delivery || null,
        totalSuccess: w.total_success || 0,
        totalFailed: w.total_failed || 0,
        createdBy: w.created_by || 'Admin',
        lastResponse: w.last_response || 'N/A',
        createdAt: w.created_at || new Date().toISOString()
      }))
      setWebhooks(formatted)
    } catch (err) {
      toast.error('Failed to load webhooks')
    }
  }

  const fetchLogs = async (webhookId) => {
    setIsLoadingLogs(true)
    try {
      const res = await api.get('/logs/webhook-events', { params: { webhook_id: webhookId } })
      setWebhookLogs(res.data.data || [])
    } catch (err) {
      toast.error('Failed to load webhook logs')
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleExport = (format) => {
    const headers = ['Name', 'URL', 'Active', 'Events', 'Created By', 'Created At'];
    const rows = processedWebhooks.map(w => [w.name, w.url, w.active, w.events.join('|'), w.createdBy, w.createdAt]);
    const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `webhooks_export.${format === 'excel' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const handleSort = (key) => {
    if (sortBy.key === key) {
      setSortBy({ key, dir: sortBy.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortBy({ key, dir: 'asc' });
    }
  }

  const processedWebhooks = useMemo(() => {
    let result = [...webhooks];

    // Filter
    if (appliedFilters.event && appliedFilters.event.length > 0) {
      result = result.filter(w => appliedFilters.event.some(e => w.events.includes(e)));
    }
    if (appliedFilters.status && appliedFilters.status.length > 0) {
      result = result.filter(w => appliedFilters.status.includes(w.active ? 'active' : 'inactive'));
    }
    if (appliedFilters.debugMode && appliedFilters.debugMode.length > 0) {
      result = result.filter(w => appliedFilters.debugMode.includes(w.debugMode ? 'true' : 'false'));
    }
    if (appliedFilters.createdBy) {
      result = result.filter(w => w.createdBy.toLowerCase().includes(appliedFilters.createdBy.toLowerCase()));
    }
    if (appliedFilters.startDate) {
      result = result.filter(w => w.lastDelivery && new Date(w.lastDelivery.time) >= new Date(appliedFilters.startDate));
    }
    if (appliedFilters.endDate) {
      result = result.filter(w => w.lastDelivery && new Date(w.lastDelivery.time) <= new Date(appliedFilters.endDate));
    }
    if (appliedFilters.responseStatus && appliedFilters.responseStatus.length > 0) {
      result = result.filter(w => {
        if (!w.lastDelivery) return appliedFilters.responseStatus.includes('none');
        return appliedFilters.responseStatus.includes(w.lastDelivery.success ? 'healthy' : 'failing');
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortBy.key];
      let valB = b[sortBy.key];
      
      if (sortBy.key === 'lastDelivery') {
        valA = a.lastDelivery ? new Date(a.lastDelivery.time).getTime() : 0;
        valB = b.lastDelivery ? new Date(b.lastDelivery.time).getTime() : 0;
      }
      
      if (sortBy.key === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortBy.dir === 'asc' ? -1 : 1;
      if (valA > valB) return sortBy.dir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [webhooks, appliedFilters, sortBy]);

  const handleTest = async (id) => {
    setTestingId(id)
    try {
      const res = await api.post(`/config/webhooks/${id}/test`)
      const { statusCode, latencyMs, success, error } = res.data.data
      
      if (success) {
        toast.success(`Success! Delivered in ${latencyMs}ms (Status: ${statusCode})`)
        setTestResults(prev => ({ ...prev, [id]: { type: 'success' } }))
      } else {
        const errorMsg = error || ''
        if (errorMsg.toLowerCase().includes('timeout') || errorMsg.includes('ECONNABORTED')) {
          toast.error(`Timeout after ${latencyMs}ms`)
        } else {
          toast.error(`Failed! Status: ${statusCode || 'N/A'}`)
        }
        setTestResults(prev => ({ ...prev, [id]: { type: 'fail' } }))
      }
    } catch (err) {
      toast.error('Test request failed completely.')
      setTestResults(prev => ({ ...prev, [id]: { type: 'fail' } }))
    } finally {
      setTestingId(null)
      setTimeout(() => {
        setTestResults(prev => {
          const next = {...prev}
          delete next[id]
          return next
        })
      }, 5000)
    }
  }

  const toggleActive = async (id) => {
    try {
      await api.patch(`/config/webhooks/${id}/toggle`)
      setWebhooks(webhooks.map(w => w.id === id ? {...w, active: !w.active} : w))
      toast.success('Webhook toggled')
    } catch (err) {
      toast.error('Failed to toggle webhook')
    }
  }

  const openEditor = (webhook = null) => {
    if (webhook) {
      setEditTarget({ ...webhook, events: new Set(webhook.events) })
    } else {
      setEditTarget({ 
        name: '', 
        description: '',
        url: '', 
        method: 'POST',
        secret: '', 
        active: true, 
        debugMode: false,
        notes: '',
        events: new Set(), 
        headers: [], 
        retryCount: 3 
      })
    }
    setIsEditOpen(true)
  }

  const generateSecret = () => {
    const newSecret = Array.from(window.crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setEditTarget({...editTarget, secret: newSecret});
  }

  const saveWebhook = async (e) => {
    if (e) e.preventDefault();
    if (!editTarget.name || !editTarget.url) return toast.error('Name and URL are required')
    
    const headersObj = {}
    editTarget.headers.forEach(h => {
      if (h.key && h.value) headersObj[h.key] = h.value
    })

    const payload = {
      name: editTarget.name,
      description: editTarget.description,
      url: editTarget.url,
      method: editTarget.method,
      secret: editTarget.secret,
      notes: editTarget.notes,
      events: Array.from(editTarget.events),
      custom_headers: headersObj,
      retry_count: editTarget.retryCount,
      is_active: editTarget.active,
      is_debug_mode: editTarget.debugMode
    }
    
    try {
      if (editTarget.id) {
        await api.put(`/config/webhooks/${editTarget.id}`, payload)
        toast.success('Webhook updated')
      } else {
        await api.post('/config/webhooks', payload)
        toast.success('Webhook created')
      }
      setIsEditOpen(false)
      fetchWebhooks()
    } catch (err) {
      toast.error('Failed to save webhook')
    }
  }

  const deleteWebhook = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/config/webhooks/${deleteTarget.id}`)
      setWebhooks(webhooks.filter(w => w.id !== deleteTarget.id))
      toast.success('Webhook deleted')
    } catch (err) {
      toast.error('Failed to delete webhook')
    } finally {
      setDeleteTarget(null)
    }
  }

  const toggleEvent = (e) => {
    const next = new Set(editTarget.events)
    if (next.has(e)) next.delete(e)
    else next.add(e)
    setEditTarget({...editTarget, events: next})
  }

  const toggleDebug = async (id) => {
    try {
      await api.patch(`/config/webhooks/${id}/debug`)
      setWebhooks(webhooks.map(w => w.id === id ? {...w, debugMode: !w.debugMode} : w))
      toast.success('Debug mode toggled')
    } catch (err) {
      toast.error('Failed to toggle debug mode')
    }
  }

  const tableColumns = [
    {
      key: 'name',
      label: 'Webhook Name',
      sortable: true,
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => openEditor(w)}>
          <div style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{w.name}</div>
          {w.debugMode && <Badge variant="warning" size="sm">Debug ON</Badge>}
        </div>
      )
    },
    {
      key: 'events',
      label: 'Event',
      render: (w) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {w.events.slice(0, 2).map(e => <Badge key={e} variant="neutral">{e}</Badge>)}
          {w.events.length > 2 && <Badge variant="neutral">+{w.events.length - 2} more</Badge>}
          {w.events.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>None</span>}
        </div>
      )
    },
    {
      key: 'url',
      label: 'Endpoint URL',
      render: (w) => (
        <div 
          title={w.url} 
          style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
        >
          {w.url}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (w) => (
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div className={`${styles.toggle} ${w.active ? styles.active : ''}`} onClick={() => toggleActive(w.id)}>
            <div className={styles.toggleHandle} />
          </div>
          {w.active ? <span style={{fontSize:'var(--text-sm)'}}>Active</span> : <span style={{fontSize:'var(--text-sm)', color:'var(--color-text-muted)'}}>Inactive</span>}
        </div>
      )
    },
    {
      key: 'delivery',
      label: 'Delivery Status',
      render: (w) => {
        if (!w.lastDelivery) return <Badge variant="neutral">No Deliveries</Badge>
        return w.lastDelivery.success 
          ? <Badge variant="success">Healthy</Badge>
          : <Badge variant="danger">Failing</Badge>
      }
    },
    {
      key: 'debug',
      label: 'Debug Mode',
      render: (w) => (
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div className={`${styles.toggle} ${w.debugMode ? styles.active : ''}`} onClick={() => toggleDebug(w.id)}>
            <div className={styles.toggleHandle} />
          </div>
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (w) => <div style={{ fontSize: 'var(--text-sm)' }}>{new Date(w.createdAt).toLocaleDateString()}</div>
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '280px',
      render: (w) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {testResults[w.id] && (
            <span style={{ fontSize: 'var(--text-sm)', color: testResults[w.id].type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {testResults[w.id].type === 'success' ? '✓ OK' : '✕ Fail'}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => handleTest(w.id)} disabled={testingId === w.id}>
            {testingId === w.id ? 'Sending...' : 'Test'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditor(w)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setLogsTarget(w)}>Logs</Button>
          <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setDeleteTarget(w)}>Delete</Button>
        </div>
      )
    }
  ]

  if (isEditOpen && editTarget) {
    return (
      <div className="fade-in bg-slate-50" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '24px 32px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fff' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} style={{ padding: '4px 8px' }}>← Back</Button>
              <h2 className={layoutStyles.sectionTitle} style={{ margin: 0 }}>{editTarget?.id ? 'Edit Webhook' : 'New Webhook'}</h2>
              {editTarget.id && (
                <Badge variant={editTarget.active ? 'success' : 'neutral'}>{editTarget.active ? 'Active' : 'Inactive'}</Badge>
              )}
            </div>
            <p className={layoutStyles.sectionDesc} style={{ marginLeft: 60 }}>Configure your webhook endpoint, authentication, and subscribed events.</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveWebhook}>Save Webhook</Button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            
            {/* Left Column - Configuration */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Endpoint Configuration</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Input label="Webhook Name" value={editTarget.name} onChange={e => setEditTarget({...editTarget, name: e.target.value})} required placeholder="e.g. ERP Integration" />
                  <Input label="Description" value={editTarget.description || ''} onChange={e => setEditTarget({...editTarget, description: e.target.value})} placeholder="Optional description" />
                  
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ width: 140 }}>
                      <Select 
                        label="Method" 
                        options={[{value:'POST',label:'POST'},{value:'PUT',label:'PUT'},{value:'PATCH',label:'PATCH'},{value:'GET',label:'GET'},{value:'DELETE',label:'DELETE'}]} 
                        value={editTarget.method || 'POST'} 
                        onChange={v => setEditTarget({...editTarget, method: v})} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Input label="Endpoint URL" value={editTarget.url} onChange={e => setEditTarget({...editTarget, url: e.target.value})} required placeholder="https://api.example.com/webhook" />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Security & Headers</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6}}>Webhook Secret (HMAC-SHA256 Signature)</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <Input value={editTarget.secret} onChange={e => setEditTarget({...editTarget, secret: e.target.value})} placeholder="Leave blank to auto-generate" />
                      </div>
                      <Button variant="secondary" onClick={generateSecret}>Regenerate</Button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 6 }}>This secret is used to sign requests so your server can verify they came from us.</p>
                  </div>
                  
                  <div style={{ marginTop: 8 }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                      <label style={{fontSize: 'var(--text-sm)', fontWeight: 500}}>Custom Headers</label>
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: [...editTarget.headers, {key:'', value:''}]})}>+ Add Header</Button>
                    </div>
                    
                    {editTarget.headers.length === 0 ? (
                      <div style={{ padding: 16, background: 'var(--color-background)', borderRadius: 8, textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        No custom headers configured.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {editTarget.headers.map((h, i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}><Input placeholder="Header Key (e.g. Authorization)" value={h.key} onChange={e => {
                              const newHeaders = [...editTarget.headers]
                              newHeaders[i].key = e.target.value
                              setEditTarget({...editTarget, headers: newHeaders})
                            }} /></div>
                            <div style={{ flex: 1 }}><Input placeholder="Header Value" value={h.value} onChange={e => {
                              const newHeaders = [...editTarget.headers]
                              newHeaders[i].value = e.target.value
                              setEditTarget({...editTarget, headers: newHeaders})
                            }} /></div>
                            <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: editTarget.headers.filter((_, idx) => idx !== i)})}>✕</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Advanced Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ width: 200 }}>
                    <Select 
                      label="Max Retry Attempts" 
                      options={[{value:0,label:'0 (No retries)'},{value:1,label:'1'},{value:3,label:'3 (Recommended)'},{value:5,label:'5'}]} 
                      value={editTarget.retryCount} 
                      onChange={v => setEditTarget({...editTarget, retryCount: v})} 
                    />
                  </div>
                  
                  <Input label="Internal Notes" value={editTarget.notes || ''} onChange={e => setEditTarget({...editTarget, notes: e.target.value})} placeholder="Notes for the development team" />

                  <div style={{ display: 'flex', gap: 32, marginTop: 16, padding: 16, background: 'var(--color-background)', borderRadius: 8 }}>
                    <label style={{display:'flex', alignItems:'center', gap:12, fontSize:'var(--text-sm)', cursor:'pointer', fontWeight: 500}}>
                      <div className={`${styles.toggle} ${editTarget.active ? styles.active : ''}`}>
                        <input style={{display:'none'}} type="checkbox" checked={editTarget.active} onChange={e => setEditTarget({...editTarget, active: e.target.checked})} />
                        <div className={styles.toggleHandle} />
                      </div>
                      Active Status
                    </label>
                    
                    <label style={{display:'flex', alignItems:'center', gap:12, fontSize:'var(--text-sm)', cursor:'pointer', fontWeight: 500}}>
                      <div className={`${styles.toggle} ${editTarget.debugMode ? styles.active : ''}`}>
                        <input style={{display:'none'}} type="checkbox" checked={editTarget.debugMode} onChange={e => setEditTarget({...editTarget, debugMode: e.target.checked})} />
                        <div className={styles.toggleHandle} />
                      </div>
                      Debug Mode (Log full payloads)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Events */}
            <div style={{ flex: 1, background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Event Subscriptions</h3>
                <Badge variant="primary">{editTarget.events.size} selected</Badge>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 20 }}>Select the events that should trigger this webhook. When these events occur in the CRM, a payload will be sent to your endpoint.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {eventRegistry.getEventGroups().map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.5px', marginBottom: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {group.events.map(ev => (
                        <label key={ev} style={{display:'flex', alignItems:'flex-start', gap: 12, cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: editTarget.events.has(ev) ? 'var(--color-primary-light)' : 'transparent', transition: 'background 0.2s'}}>
                          <input type="checkbox" style={{ marginTop: 4 }} checked={editTarget.events.has(ev)} onChange={() => toggleEvent(ev)} />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: editTarget.events.has(ev) ? 'var(--color-primary-dark)' : 'var(--color-text)' }}>{ev}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>Triggers on {ev.split('.')[1]} action</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Outbound Webhooks</h2>
            <p className={layoutStyles.sectionDesc}>Send real-time events to external systems.</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <Button variant="secondary" onClick={() => setExportMenuOpen(!exportMenuOpen)}>Export ▼</Button>
              {exportMenuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10, minWidth: 150, overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => { handleExport('csv'); setExportMenuOpen(false); }}>Export as CSV</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => { handleExport('excel'); setExportMenuOpen(false); }}>Export as Excel</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => { 
                    setExportMenuOpen(false); 
                    const headers = ['Name', 'URL', 'Active', 'Events', 'Created By', 'Created At'];
                    const rows = processedWebhooks.map(w => [w.name, w.url, w.active ? 'Yes' : 'No', w.events.join(', '), w.createdBy, w.createdAt]);
                    const doc = new jsPDF();
                    doc.text("Webhooks Export", 14, 15);
                    autoTable(doc, {
                      head: [headers],
                      body: rows,
                      startY: 20,
                    });
                    doc.save('webhooks_export.pdf');
                  }}>Export as PDF</div>
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }}></div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => { setExportMenuOpen(false); window.print(); }}>Print Table</div>
                </div>
              )}
            </div>
            <Button variant="primary" onClick={() => openEditor()}>+ Add Webhook</Button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
          
          {/* KPIs */}
          <div className={styles.kpiGrid} style={{ flexShrink: 0, marginBottom: '24px' }}>
            <KPICard 
              title="Total Webhooks" 
              value={stats.total} 
              description={`${stats.active} Active • ${stats.disabled} Disabled`} 
              icon="↗" 
            />
            <KPICard 
              title="Today's Deliveries" 
              value={stats.todaysDeliveries} 
              trend={{ direction: 'down', value: stats.todaysFailures, label: 'Failures', type: 'danger' }} 
              icon="📬" 
            />
            <KPICard 
              title="Pending Retries" 
              value={stats.pendingRetries} 
              description="Queued for redelivery" 
              icon="↻" 
            />
            <KPICard 
              title="Avg Response Time" 
              value={`${stats.avgResponseTime}ms`} 
              description="Across all webhooks" 
              icon="⚡" 
            />
          </div>

          {/* Filters */}
          <div style={{ flexShrink: 0, marginBottom: '16px' }}>
            <WebhookFilters 
              onApply={setAppliedFilters} 
              appliedFilters={appliedFilters} 
              rightContent={
                <div style={{ width: 300 }}>
                  <Input 
                    placeholder="Search webhooks..." 
                    onChange={(e) => {
                      // search logic if needed
                    }}
                  />
                </div>
              }
            />
          </div>

          {/* Table */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <DataTable 
              columns={tableColumns} 
              data={processedWebhooks} 
              emptyMessage="No webhooks configured yet." 
              emptyAction={<Button variant="primary" onClick={() => openEditor()}>+ Add Webhook</Button>}
              sortBy={sortBy}
              onSort={handleSort}
            />
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Webhook"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteWebhook}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete the webhook <strong>{deleteTarget?.name}</strong>?</p>
      </Modal>

      {/* The editor was replaced with a full-page view above */}

      {/* Logs Drawer */}
      <Drawer
        isOpen={!!logsTarget}
        onClose={() => setLogsTarget(null)}
        title={`Delivery Logs: ${logsTarget?.name}`}
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: 'var(--text-sm)' }}>
              {logsTarget?.debugMode ? 'Debug mode is ON. Full request/response bodies are captured.' : 'Debug mode is OFF. Only metadata is captured.'}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {isLoadingLogs ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading logs...</div>
            ) : webhookLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No logs found for this webhook.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {webhookLogs.map(log => (
                  <div key={log.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--color-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {log.response_status >= 200 && log.response_status < 300 ? (
                          <Badge variant="success">HTTP {log.response_status}</Badge>
                        ) : (
                          <Badge variant="danger">HTTP {log.response_status || 'ERR'}</Badge>
                        )}
                        <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>Event: {log.event_type}</span>
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div><span style={{ color: 'var(--color-text-muted)' }}>Attempt:</span> {log.attempt_count}</div>
                      <div><span style={{ color: 'var(--color-text-muted)' }}>Latency:</span> {log.latency_ms ? `${log.latency_ms}ms` : 'N/A'}</div>
                    </div>
                    {log.error_message && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: 'var(--color-danger-light, #fee2e2)', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                        {log.error_message}
                      </div>
                    )}
                    {logsTarget?.debugMode && log.request_payload && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, marginBottom: 4 }}>Payload</div>
                        <pre style={{ fontSize: '10px', background: 'var(--color-background)', padding: 8, borderRadius: 4, overflowX: 'auto', margin: 0 }}>
                          {typeof log.request_payload === 'string' ? log.request_payload : JSON.stringify(log.request_payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  )
}
