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

  const saveWebhook = async () => {
    if (!editTarget.name || !editTarget.url) return toast.error('Name and URL are required')
    
    // Map headers array to object
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{w.name}</div>
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
      render: (w) => {
        if (!w.active) return <Badge variant="neutral">Inactive</Badge>
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
        <div className={`${styles.toggle} ${w.debugMode ? styles.active : ''}`} onClick={() => toggleDebug(w.id)}>
          <div className={styles.toggleHandle} />
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
      key: 'lastDelivery',
      label: 'Last Delivery',
      sortable: true,
      render: (w) => w.lastDelivery ? <div style={{ fontSize: 'var(--text-sm)' }}>{new Date(w.lastDelivery.time).toLocaleString()}</div> : <span style={{color: 'var(--color-text-muted)'}}>N/A</span>
    },
    {
      key: 'lastResponse',
      label: 'Last Response',
      render: (w) => <div style={{ fontSize: 'var(--text-sm)' }}>{w.lastResponse}</div>
    },
    {
      key: 'totalSuccess',
      label: 'Total Success',
      sortable: false,
      align: 'right',
      render: (w) => <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>{w.totalSuccess}</div>
    },
    {
      key: 'totalFailed',
      label: 'Total Failed',
      sortable: true,
      align: 'right',
      render: (w) => <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>{w.totalFailed}</div>
    },
    {
      key: 'createdBy',
      label: 'Created By',
      sortable: true,
      render: (w) => <div style={{ fontSize: 'var(--text-sm)' }}>{w.createdBy}</div>
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
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

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
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
                <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => {
                  setExportMenuOpen(false);
                  const headers = ['Name', 'URL', 'Active', 'Events', 'Created By', 'Created At'];
                  const rows = processedWebhooks.map(w => [w.name, w.url, w.active, w.events.join('|'), w.createdBy, w.createdAt]);
                  const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", "webhooks_export.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}>Export as CSV</div>
                <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-sm)' }} onClick={() => {
                  setExportMenuOpen(false);
                  const headers = ['Name', 'URL', 'Active', 'Events', 'Created By', 'Created At'];
                  const rows = processedWebhooks.map(w => [w.name, w.url, w.active, w.events.join('|'), w.createdBy, w.createdAt]);
                  const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.setAttribute("href", url);
                  link.setAttribute("download", "webhooks_export.xlsx");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}>Export as Excel</div>
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

      <div className={styles.kpiGrid}>
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

      <WebhookFilters 
        onApply={setAppliedFilters} 
        appliedFilters={appliedFilters} 
        rightContent={
          <div style={{ width: 300 }}>
            <Input 
              placeholder="Search webhooks..." 
              onChange={(e) => {
                // Add search logic if needed
              }}
            />
          </div>
        }
      />

      <DataTable 
        columns={tableColumns} 
        data={processedWebhooks} 
        emptyMessage="No webhooks configured yet." 
        emptyAction={<Button variant="primary" onClick={() => openEditor()}>+ Add Webhook</Button>}
        sortBy={sortBy}
        onSort={handleSort}
      />

      {/* Editor Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={editTarget?.id ? 'Edit Webhook' : 'Add Webhook'}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveWebhook}>Save Webhook</Button>
          </>
        }
      >
        {editTarget && (
          <div className={styles.modalBody}>
            {/* Left Col */}
            <div className={styles.col}>
              <Input label="Webhook Name" value={editTarget.name} onChange={e => setEditTarget({...editTarget, name: e.target.value})} required />
              <Input label="Description" value={editTarget.description || ''} onChange={e => setEditTarget({...editTarget, description: e.target.value})} />
              
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 120 }}>
                  <Select 
                    label="Request Method" 
                    options={[{value:'POST',label:'POST'},{value:'PUT',label:'PUT'},{value:'PATCH',label:'PATCH'},{value:'GET',label:'GET'},{value:'DELETE',label:'DELETE'}]} 
                    value={editTarget.method || 'POST'} 
                    onChange={v => setEditTarget({...editTarget, method: v})} 
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input label="Endpoint URL" value={editTarget.url} onChange={e => setEditTarget({...editTarget, url: e.target.value})} required />
                </div>
              </div>

              <div>
                <label style={{display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4}}>Secret Key (used for HMAC signing)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Input value={editTarget.secret} onChange={e => setEditTarget({...editTarget, secret: e.target.value})} placeholder="Auto-generate if empty" />
                  </div>
                  <Button variant="secondary" onClick={generateSecret}>Generate</Button>
                </div>
              </div>
              
              <div>
                <div style={{fontSize:'var(--text-sm)', fontWeight:500, marginBottom:8}}>Custom Headers (Optional)</div>
                <div className={styles.headersList}>
                  {editTarget.headers.map((h, i) => (
                    <div key={i} className={styles.headerRow}>
                      <Input placeholder="Key" value={h.key} onChange={e => {
                        const newHeaders = [...editTarget.headers]
                        newHeaders[i].key = e.target.value
                        setEditTarget({...editTarget, headers: newHeaders})
                      }} />
                      <Input placeholder="Value" value={h.value} onChange={e => {
                        const newHeaders = [...editTarget.headers]
                        newHeaders[i].value = e.target.value
                        setEditTarget({...editTarget, headers: newHeaders})
                      }} />
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: editTarget.headers.filter((_, idx) => idx !== i)})}>✕</Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: [...editTarget.headers, {key:'', value:''}]})}>+ Add Header</Button>
                </div>
              </div>

              <Select 
                label="Retry Count" 
                options={[{value:1,label:'1'},{value:2,label:'2'},{value:3,label:'3'},{value:5,label:'5'}]} 
                value={editTarget.retryCount} 
                onChange={v => setEditTarget({...editTarget, retryCount: v})} 
              />
              
              <Input label="Notes" value={editTarget.notes || ''} onChange={e => setEditTarget({...editTarget, notes: e.target.value})} />

              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:'var(--text-sm)', cursor:'pointer'}}>
                  <div className={`${styles.toggle} ${editTarget.active ? styles.active : ''}`}>
                    <input style={{display:'none'}} type="checkbox" checked={editTarget.active} onChange={e => setEditTarget({...editTarget, active: e.target.checked})} />
                    <div className={styles.toggleHandle} />
                  </div>
                  Status (Active)
                </label>
                
                <label style={{display:'flex', alignItems:'center', gap:8, fontSize:'var(--text-sm)', cursor:'pointer'}}>
                  <div className={`${styles.toggle} ${editTarget.debugMode ? styles.active : ''}`}>
                    <input style={{display:'none'}} type="checkbox" checked={editTarget.debugMode} onChange={e => setEditTarget({...editTarget, debugMode: e.target.checked})} />
                    <div className={styles.toggleHandle} />
                  </div>
                  Debug Mode
                </label>
              </div>
            </div>

            {/* Right Col */}
            <div className={styles.col}>
              <div style={{fontSize:'var(--text-sm)', fontWeight:500}}>Events</div>
              <div className={styles.eventsGrid}>
                {eventRegistry.getEventGroups().map(group => (
                  <div key={group.label} className={styles.eventGroup}>
                    <div className={styles.eventTitle}>{group.label}</div>
                    {group.events.map(ev => (
                      <label key={ev} className={styles.eventRow} style={{display:'flex', alignItems:'center', gap: 8, padding: '4px 0'}}>
                        <input type="checkbox" checked={editTarget.events.has(ev)} onChange={() => toggleEvent(ev)} />
                        <span>
                          {ev} <span style={{color: 'var(--color-text-muted)', fontSize: '0.9em', marginLeft: 4}}>- Triggered on all {ev} activities</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

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

      {/* Logs Drawer */}
      <Drawer
        isOpen={!!logsTarget}
        onClose={() => setLogsTarget(null)}
        title={`Delivery Logs: ${logsTarget?.name}`}
        width={700}
      >
        <div style={{ padding: 16 }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Delivery logs will be listed here, showing payload history and HTTP responses. {logsTarget?.debugMode ? 'Debug mode is ON, full request/response bodies will be captured.' : 'Debug mode is OFF.'}</p>
        </div>
      </Drawer>
    </div>
  )
}
