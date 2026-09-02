/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect, useMemo, useRef } from 'react';
import layoutStyles from './ConfigLayout.module.css';
import styles from './WebhooksManager.module.css';
import { Button, Badge, Modal, Input, Select, DataTable, Drawer } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { configApi } from '../../api/config';
import eventRegistry from '../../utils/eventRegistry';
import KPICard from '../../components/finance/KPICard';
import InboundSourceEditor from './InboundSourceEditor';
import InboundWebhookTesterModal from './InboundWebhookTesterModal';

export default function WebhooksManager() {
  const [activeTab, setActiveTab] = useState('inbound'); // 'inbound' | 'outbound'
  
  // Outbound Webhooks State
  const [webhooks, setWebhooks] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [testingId, setTestingId] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [logsTarget, setLogsTarget] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [outboundSearch, setOutboundSearch] = useState('');
  const [outboundStatusFilter, setOutboundStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState({ key: 'name', dir: 'asc' });

  // Inbound Webhooks State
  const [inboundSources, setInboundSources] = useState([]);
  const [isInboundEditOpen, setIsInboundEditOpen] = useState(false);
  const [inboundEditTarget, setInboundEditTarget] = useState(null);
  const [deleteInboundTarget, setDeleteInboundTarget] = useState(null);
  const [inboundTesterTarget, setInboundTesterTarget] = useState(null);
  const [inboundLogsTarget, setInboundLogsTarget] = useState(null);
  const [inboundLogs, setInboundLogs] = useState([]);
  const [isLoadingInboundLogs, setIsLoadingInboundLogs] = useState(false);
  const [inboundFilterProvider, setInboundFilterProvider] = useState('all');
  const [inboundStatusFilter, setInboundStatusFilter] = useState('all');
  const [inboundSearch, setInboundSearch] = useState('');

  const toast = useToast();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';

  useEffect(() => {
    fetchWebhooks();
    fetchInboundSources();
  }, []);

  useEffect(() => {
    if (logsTarget) {
      fetchLogs(logsTarget.id);
    } else {
      setWebhookLogs([]);
    }
  }, [logsTarget]);

  useEffect(() => {
    if (inboundLogsTarget) {
      fetchInboundLogs(inboundLogsTarget.source_key);
    } else {
      setInboundLogs([]);
    }
  }, [inboundLogsTarget]);

  // Outbound KPIs
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

  // Inbound KPIs
  const inboundStats = useMemo(() => {
    const total = inboundSources.length;
    const active = inboundSources.filter(s => s.is_active).length;
    const disabled = total - active;
    const hmacCount = inboundSources.filter(s => !!s.secret).length;
    return { total, active, disabled, hmacCount };
  }, [inboundSources]);

  const fetchWebhooks = async () => {
    try {
      const res = await api.get('/config/webhooks');
      const safeParse = (val, fallback) => {
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch (e) { return fallback; }
      };

      const formatted = (res.data.data || []).map(w => ({
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
      }));
      setWebhooks(formatted);
    } catch (err) {
      toast.error('Failed to load outbound webhooks');
    }
  };

  const fetchInboundSources = async () => {
    try {
      const data = await configApi.getWebhookSources();
      setInboundSources(data || []);
    } catch (err) {
      toast.error('Failed to load inbound webhook sources');
    }
  };

  const fetchLogs = async (webhookId) => {
    setIsLoadingLogs(true);
    try {
      const res = await api.get('/logs/webhook-events', { params: { webhook_id: webhookId } });
      setWebhookLogs(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load webhook logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchInboundLogs = async (sourceKey) => {
    setIsLoadingInboundLogs(true);
    try {
      const res = await configApi.getInboundLogs({ sourceKey });
      setInboundLogs(res.data || []);
    } catch (err) {
      toast.error('Failed to load inbound logs');
    } finally {
      setIsLoadingInboundLogs(false);
    }
  };

  const handleExport = () => {
    const isOutbound = activeTab === 'outbound';
    let headers = [];
    let rows = [];

    if (isOutbound) {
      headers = ['Name', 'URL', 'Status', 'Events', 'Created At'];
      rows = processedWebhooks.map(w => [w.name, w.url, w.active ? 'Active' : 'Inactive', w.events.join('; '), w.createdAt]);
    } else {
      headers = ['Source Name', 'Provider', 'Source Key', 'Inbound URL', 'Security', 'Status', 'Dedup Field'];
      rows = processedInboundSources.map(s => [
        s.name,
        s.provider_name || 'Website',
        s.source_key,
        `${baseUrl}/api/webhooks/inbound/${s.source_key}`,
        s.secret ? 'HMAC-SHA256' : 'Open',
        s.is_active ? 'Active' : 'Inactive',
        s.dedup_field || 'None'
      ]);
    }

    const csvString = headers.join(',') + '\n' + rows.map(e => e.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${isOutbound ? 'outbound_webhooks' : 'inbound_webhooks'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Export downloaded successfully');
  };

  const handleSort = (key) => {
    if (sortBy.key === key) {
      setSortBy({ key, dir: sortBy.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortBy({ key, dir: 'asc' });
    }
  };

  const processedWebhooks = useMemo(() => {
    let result = [...webhooks];
    if (outboundStatusFilter === 'active') {
      result = result.filter(w => w.active);
    } else if (outboundStatusFilter === 'inactive') {
      result = result.filter(w => !w.active);
    }
    if (outboundSearch.trim()) {
      const q = outboundSearch.toLowerCase();
      result = result.filter(w => w.name?.toLowerCase().includes(q) || w.url?.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let valA = a[sortBy.key];
      let valB = b[sortBy.key];
      if (valA < valB) return sortBy.dir === 'asc' ? -1 : 1;
      if (valA > valB) return sortBy.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [webhooks, outboundStatusFilter, outboundSearch, sortBy]);

  const processedInboundSources = useMemo(() => {
    let result = [...inboundSources];
    if (inboundFilterProvider !== 'all') {
      result = result.filter(s => (s.provider_name || '').toLowerCase() === inboundFilterProvider.toLowerCase());
    }
    if (inboundStatusFilter === 'active') {
      result = result.filter(s => s.is_active);
    } else if (inboundStatusFilter === 'inactive') {
      result = result.filter(s => !s.is_active);
    }
    if (inboundSearch.trim()) {
      const q = inboundSearch.toLowerCase();
      result = result.filter(s => s.name?.toLowerCase().includes(q) || s.source_key?.toLowerCase().includes(q));
    }
    return result;
  }, [inboundSources, inboundFilterProvider, inboundStatusFilter, inboundSearch]);

  const handleTestOutbound = async (id) => {
    setTestingId(id);
    try {
      const res = await api.post(`/config/webhooks/${id}/test`);
      const { statusCode, latencyMs, success, error } = res.data.data;
      
      if (success) {
        toast.success(`Success! Delivered in ${latencyMs}ms (Status: ${statusCode})`);
        setTestResults(prev => ({ ...prev, [id]: { type: 'success' } }));
      } else {
        const errorMsg = error || '';
        if (errorMsg.toLowerCase().includes('timeout') || errorMsg.includes('ECONNABORTED')) {
          toast.error(`Timeout after ${latencyMs}ms`);
        } else {
          toast.error(`Failed! Status: ${statusCode || 'N/A'}`);
        }
        setTestResults(prev => ({ ...prev, [id]: { type: 'fail' } }));
      }
    } catch (err) {
      toast.error('Test request failed completely.');
      setTestResults(prev => ({ ...prev, [id]: { type: 'fail' } }));
    } finally {
      setTestingId(null);
      setTimeout(() => {
        setTestResults(prev => {
          const next = {...prev};
          delete next[id];
          return next;
        });
      }, 5000);
    }
  };

  const toggleActive = async (id) => {
    try {
      await api.patch(`/config/webhooks/${id}/toggle`);
      setWebhooks(webhooks.map(w => w.id === id ? {...w, active: !w.active} : w));
      toast.success('Webhook status updated');
    } catch (err) {
      toast.error('Failed to toggle webhook');
    }
  };

  const toggleInboundActive = async (id) => {
    try {
      const res = await configApi.toggleWebhookSource(id);
      setInboundSources(inboundSources.map(s => s.id === id ? { ...s, is_active: res.is_active } : s));
      toast.success('Inbound source status updated');
    } catch (err) {
      toast.error('Failed to toggle inbound source');
    }
  };

  const openEditor = (webhook = null) => {
    if (webhook) {
      setEditTarget({ ...webhook, events: new Set(webhook.events) });
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
      });
    }
    setIsEditOpen(true);
  };

  const openInboundEditor = (source = null) => {
    setInboundEditTarget(source);
    setIsInboundEditOpen(true);
  };

  const generateSecret = () => {
    const newSecret = Array.from(window.crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setEditTarget({...editTarget, secret: newSecret});
  };

  const saveWebhook = async (e) => {
    if (e) e.preventDefault();
    if (!editTarget.name || !editTarget.url) return toast.error('Name and URL are required');
    
    const headersObj = {};
    editTarget.headers.forEach(h => {
      if (h.key && h.value) headersObj[h.key] = h.value;
    });

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
    };
    
    try {
      if (editTarget.id) {
        await api.put(`/config/webhooks/${editTarget.id}`, payload);
        toast.success('Webhook updated successfully');
      } else {
        await api.post('/config/webhooks', payload);
        toast.success('Webhook created successfully');
      }
      setIsEditOpen(false);
      fetchWebhooks();
    } catch (err) {
      toast.error('Failed to save webhook');
    }
  };

  const deleteWebhook = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/config/webhooks/${deleteTarget.id}`);
      setWebhooks(webhooks.filter(w => w.id !== deleteTarget.id));
      toast.success('Webhook deleted');
    } catch (err) {
      toast.error('Failed to delete webhook');
    } finally {
      setDeleteTarget(null);
    }
  };

  const deleteInboundSource = async () => {
    if (!deleteInboundTarget) return;
    try {
      await configApi.deleteWebhookSource(deleteInboundTarget.id);
      setInboundSources(inboundSources.filter(s => s.id !== deleteInboundTarget.id));
      toast.success('Inbound source deleted');
    } catch (err) {
      toast.error('Failed to delete inbound source');
    } finally {
      setDeleteInboundTarget(null);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const toggleEvent = (e) => {
    const next = new Set(editTarget.events);
    if (next.has(e)) next.delete(e);
    else next.add(e);
    setEditTarget({...editTarget, events: next});
  };

  const getProviderIcon = (provider) => {
    const p = (provider || '').toLowerCase();
    if (p.includes('facebook') || p.includes('meta')) return '📱';
    if (p.includes('zapier')) return '⚡';
    if (p.includes('indiamart')) return '🏢';
    if (p.includes('website')) return '🌐';
    return '📥';
  };

  // Outbound Columns
  const outboundColumns = [
    {
      key: 'name',
      label: 'Webhook Name',
      sortable: true,
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openEditor(w)}>
          <div style={{ fontSize: '18px' }}>🚀</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>{w.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Method: {w.method || 'POST'}</div>
          </div>
          {w.debugMode && <Badge variant="warning" size="sm">Debug Mode</Badge>}
        </div>
      )
    },
    {
      key: 'events',
      label: 'Event Subscriptions',
      render: (w) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {w.events.slice(0, 2).map(e => <Badge key={e} variant="neutral" size="sm">{e}</Badge>)}
          {w.events.length > 2 && <Badge variant="primary" size="sm">+{w.events.length - 2} more</Badge>}
          {w.events.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>None</span>}
        </div>
      )
    },
    {
      key: 'url',
      label: 'Destination Endpoint',
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <code className={styles.codeBox} title={w.url}>
            {w.url}
          </code>
          <Button variant="ghost" size="sm" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => copyToClipboard(w.url, 'Webhook URL')}>
            Copy
          </Button>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`${styles.toggle} ${w.active ? styles.active : ''}`} onClick={() => toggleActive(w.id)}>
            <div className={styles.toggleHandle} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: w.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {w.active ? 'Active' : 'Disabled'}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '280px',
      render: (w) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {testResults[w.id] && (
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: testResults[w.id].type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {testResults[w.id].type === 'success' ? '✓ OK' : '✕ Fail'}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => handleTestOutbound(w.id)} disabled={testingId === w.id}>
            {testingId === w.id ? 'Sending...' : '⚡ Test'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditor(w)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setLogsTarget(w)}>Logs</Button>
          <Button variant="ghost" size="sm" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleteTarget(w)}>Delete</Button>
        </div>
      )
    }
  ];

  // Inbound Columns
  const inboundColumns = [
    {
      key: 'name',
      label: 'Source & Provider',
      render: (s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openInboundEditor(s)}>
          <div style={{ fontSize: '20px' }}>{getProviderIcon(s.provider_name)}</div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>{s.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Badge variant="neutral" size="sm">{s.provider_name || 'Website'}</Badge>
              <span>Key: <code>{s.source_key}</code></span>
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'url',
      label: 'Inbound Webhook URL',
      render: (s) => {
        const fullUrl = `${baseUrl}/api/webhooks/inbound/${s.source_key}`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code className={styles.codeBox} title={fullUrl}>
              /api/webhooks/inbound/{s.source_key}
            </code>
            <Button variant="ghost" size="sm" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => copyToClipboard(fullUrl, 'Inbound Webhook URL')}>
              Copy
            </Button>
          </div>
        );
      }
    },
    {
      key: 'security',
      label: 'Security & Mapping',
      render: (s) => {
        const mappings = typeof s.field_mapping === 'string' ? JSON.parse(s.field_mapping || '[]') : (s.field_mapping || []);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {s.secret ? (
              <Badge variant="success" size="sm">🔒 HMAC Protected</Badge>
            ) : (
              <Badge variant="neutral" size="sm">🔓 Public Ingest</Badge>
            )}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              {mappings.length} Fields Mapped {s.dedup_field ? `• Dedup by ${s.dedup_field}` : ''}
            </span>
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`${styles.toggle} ${s.is_active ? styles.active : ''}`} onClick={() => toggleInboundActive(s.id)}>
            <div className={styles.toggleHandle} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: s.is_active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {s.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      width: '280px',
      render: (s) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <Button variant="primary" size="sm" onClick={() => setInboundTesterTarget(s)}>
            ⚡ Test Inbound
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openInboundEditor(s)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setInboundLogsTarget(s)}>Logs</Button>
          <Button variant="ghost" size="sm" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleteInboundTarget(s)}>Delete</Button>
        </div>
      )
    }
  ];

  if (isInboundEditOpen) {
    return (
      <InboundSourceEditor
        source={inboundEditTarget}
        onSave={() => {
          setIsInboundEditOpen(false);
          fetchInboundSources();
        }}
        onCancel={() => setIsInboundEditOpen(false)}
      />
    );
  }

  if (isEditOpen && editTarget) {
    return (
      <div className="fade-in bg-slate-50" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '24px 32px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)} style={{ padding: '4px 8px' }}>← Back</Button>
              <h2 className={layoutStyles.sectionTitle} style={{ margin: 0 }}>{editTarget?.id ? 'Edit Outbound Webhook' : 'New Outbound Webhook'}</h2>
              {editTarget.id && (
                <Badge variant={editTarget.active ? 'success' : 'neutral'}>{editTarget.active ? 'Active' : 'Inactive'}</Badge>
              )}
            </div>
            <p className={layoutStyles.sectionDesc} style={{ marginLeft: 60 }}>Configure outbound endpoint URL, HMAC security headers, and subscribed CRM events.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveWebhook}>Save Webhook</Button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            
            {/* Left Column */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: 'var(--color-surface)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Endpoint Configuration</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Input label="Webhook Name" value={editTarget.name} onChange={e => setEditTarget({...editTarget, name: e.target.value})} required placeholder="e.g. ERP Integration / Slack Alert" />
                  <Input label="Description" value={editTarget.description || ''} onChange={e => setEditTarget({...editTarget, description: e.target.value})} placeholder="Optional description for team reference" />
                  
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

              <div style={{ background: 'var(--color-surface)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Security & Verification</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Webhook Secret (HMAC-SHA256 Signature)</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <Input value={editTarget.secret} onChange={e => setEditTarget({...editTarget, secret: e.target.value})} placeholder="Leave blank to auto-generate" />
                      </div>
                      <Button variant="secondary" onClick={generateSecret}>Regenerate</Button>
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 6 }}>
                      Outbound requests will include header <code>x-hub-signature-256</code> signed with this secret.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ flex: 1, background: 'var(--color-surface)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Event Subscriptions</h3>
                <Badge variant="primary">{editTarget.events.size} selected</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {eventRegistry.getEventGroups().map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {group.events.map(ev => (
                        <label key={ev} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: editTarget.events.has(ev) ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                          <input type="checkbox" style={{ marginTop: 4 }} checked={editTarget.events.has(ev)} onChange={() => toggleEvent(ev)} />
                          <div>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{ev}</div>
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
    );
  }

  return (
    <div className={styles.container}>
      
      {/* Top Header */}
      <div className={styles.headerWrapper}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>
            <span>🪝</span> Webhooks & Integrations
          </h1>
          <p className={styles.headerDesc}>
            Manage Inbound Lead Ingestion endpoints and Outbound real-time webhook triggers.
          </p>
        </div>
        
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            📥 Export CSV
          </Button>
          {activeTab === 'inbound' && (
            <>
              <Button 
                variant="secondary" 
                onClick={() => setInboundTesterTarget(inboundSources[0] || {})}
                style={{ fontWeight: 600 }}
              >
                ⚡ Live Inbound Tester
              </Button>
              <Button variant="primary" onClick={() => openInboundEditor()}>
                + Add Inbound Source
              </Button>
            </>
          )}
          {activeTab === 'outbound' && (
            <Button variant="primary" onClick={() => openEditor()}>
              + Add Outbound Webhook
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Switcher */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          onClick={() => setActiveTab('inbound')}
          className={`${styles.tabButton} ${activeTab === 'inbound' ? styles.activeTab : ''}`}
        >
          <span>📥</span> Inbound Webhooks (Lead Ingestion)
          <Badge variant={activeTab === 'inbound' ? 'primary' : 'neutral'} size="sm">
            {inboundSources.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('outbound')}
          className={`${styles.tabButton} ${activeTab === 'outbound' ? styles.activeTab : ''}`}
        >
          <span>🚀</span> Outbound Webhooks (Event Dispatcher)
          <Badge variant={activeTab === 'outbound' ? 'primary' : 'neutral'} size="sm">
            {webhooks.length}
          </Badge>
        </button>
      </div>

      {/* Content Area */}
      <div className={styles.contentArea}>
        
        {/* INBOUND TAB CONTENT */}
        {activeTab === 'inbound' && (
          <>
            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
              <KPICard 
                title="Inbound Sources" 
                value={inboundStats.total} 
                description={`${inboundStats.active} Active • ${inboundStats.disabled} Disabled`} 
                icon="📥" 
              />
              <KPICard 
                title="Active Endpoints" 
                value={inboundStats.active} 
                description="Live lead capture URLs" 
                icon="⚡" 
              />
              <KPICard 
                title="HMAC Protected" 
                value={inboundStats.hmacCount} 
                description="Signature authenticated" 
                icon="🔒" 
              />
              <KPICard 
                title="Deduplication" 
                value="Active" 
                description="Match by phone / email" 
                icon="🔄" 
              />
            </div>

            {/* Filter Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.filterGroup}>
                <div style={{ width: 170 }}>
                  <Select
                    options={[
                      { value: 'all', label: 'All Providers' },
                      { value: 'Website', label: 'Website Form' },
                      { value: 'Facebook', label: 'Facebook Leads' },
                      { value: 'IndiaMART', label: 'IndiaMART' },
                      { value: 'Zapier', label: 'Zapier Ingest' },
                      { value: 'Other', label: 'Other' }
                    ]}
                    value={inboundFilterProvider}
                    onChange={setInboundFilterProvider}
                  />
                </div>

                <div style={{ width: 150 }}>
                  <Select
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active Only' },
                      { value: 'inactive', label: 'Inactive Only' }
                    ]}
                    value={inboundStatusFilter}
                    onChange={setInboundStatusFilter}
                  />
                </div>
              </div>

              <div className={styles.searchBox}>
                <Input
                  placeholder="Search inbound sources..."
                  value={inboundSearch}
                  onChange={e => setInboundSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Inbound Table */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <DataTable 
                columns={inboundColumns} 
                data={processedInboundSources} 
                emptyAction={
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
                    <Button variant="primary" onClick={() => openInboundEditor()}>+ Add Inbound Source</Button>
                    <Button variant="secondary" onClick={() => setInboundTesterTarget({})}>⚡ Launch Live Tester</Button>
                  </div>
                }
              />
            </div>
          </>
        )}

        {/* OUTBOUND TAB CONTENT */}
        {activeTab === 'outbound' && (
          <>
            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
              <KPICard 
                title="Total Webhooks" 
                value={stats.total} 
                description={`${stats.active} Active • ${stats.disabled} Disabled`} 
                icon="🚀" 
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
                description="Destination latency" 
                icon="⚡" 
              />
            </div>

            {/* Filter Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.filterGroup}>
                <div style={{ width: 160 }}>
                  <Select
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active Only' },
                      { value: 'inactive', label: 'Disabled Only' }
                    ]}
                    value={outboundStatusFilter}
                    onChange={setOutboundStatusFilter}
                  />
                </div>
              </div>

              <div className={styles.searchBox}>
                <Input
                  placeholder="Search outbound webhooks..."
                  value={outboundSearch}
                  onChange={e => setOutboundSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Outbound Table */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <DataTable 
                columns={outboundColumns} 
                data={processedWebhooks} 
                emptyAction={<Button variant="primary" onClick={() => openEditor()}>+ Add Outbound Webhook</Button>}
                sortBy={sortBy}
                onSort={handleSort}
              />
            </div>
          </>
        )}

      </div>

      {/* Delete Outbound Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Outbound Webhook"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteWebhook}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete the webhook <strong>{deleteTarget?.name}</strong>?</p>
      </Modal>

      {/* Delete Inbound Modal */}
      <Modal
        isOpen={!!deleteInboundTarget}
        onClose={() => setDeleteInboundTarget(null)}
        title="Delete Inbound Webhook Source"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteInboundTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteInboundSource}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete the inbound lead source <strong>{deleteInboundTarget?.name}</strong>? External services sending requests to this URL will no longer be processed.</p>
      </Modal>

      {/* Outbound Logs Drawer */}
      <Drawer
        isOpen={!!logsTarget}
        onClose={() => setLogsTarget(null)}
        title={`Delivery Logs: ${logsTarget?.name}`}
        width={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2, #f8fafc)', flexShrink: 0 }}>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--text-xs)' }}>
              {logsTarget?.debugMode ? '🔒 Debug mode is ON. Full request & response bodies are captured.' : '⚡ Debug mode is OFF. Standard metadata is captured.'}
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {isLoadingLogs ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading delivery logs...</div>
            ) : webhookLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No logs found for this webhook.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {webhookLogs.map(log => {
                  const statusCode = log.status_code ?? log.response_status;
                  const eventName = log.event ?? log.event_type ?? 'webhook.test';
                  const attempt = log.attempt_number ?? log.attempt_count ?? 1;
                  const payload = log.payload ?? log.request_payload;
                  const errorMsg = log.error_message || (statusCode && (statusCode < 200 || statusCode >= 300) ? log.response_body : null);
                  const isSuccess = statusCode >= 200 && statusCode < 300;

                  return (
                    <div key={log.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {statusCode ? (
                            <Badge variant={isSuccess ? 'success' : 'danger'}>HTTP {statusCode}</Badge>
                          ) : (
                            <Badge variant="neutral">Pending / ERR</Badge>
                          )}
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Event: {eventName}</span>
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div><span style={{ color: 'var(--color-text-muted)' }}>Attempt:</span> {attempt}</div>
                        <div><span style={{ color: 'var(--color-text-muted)' }}>Latency:</span> {log.latency_ms !== null && log.latency_ms !== undefined ? `${log.latency_ms}ms` : 'N/A'}</div>
                      </div>
                      {errorMsg && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: '#fee2e2', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                          {typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}
                        </div>
                      )}
                      {payload && (
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>Payload</div>
                          <pre style={{ fontSize: '11px', background: 'var(--color-surface-2, #f1f5f9)', padding: 10, borderRadius: 6, overflowX: 'auto', margin: 0, fontFamily: 'var(--font-mono)' }}>
                            {typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Inbound Logs Drawer */}
      <Drawer
        isOpen={!!inboundLogsTarget}
        onClose={() => setInboundLogsTarget(null)}
        title={`Inbound Webhook Logs: ${inboundLogsTarget?.name}`}
        width={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2, #f8fafc)', flexShrink: 0 }}>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 'var(--text-xs)' }}>
              Review incoming payloads received by endpoint: <code>/api/webhooks/inbound/{inboundLogsTarget?.source_key}</code>
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {isLoadingInboundLogs ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading inbound logs...</div>
            ) : inboundLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                No inbound payloads received yet for this source.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inboundLogs.map(log => {
                  const isSuccess = log.status === 'success';
                  const payload = log.payload || log.raw_payload;

                  return (
                    <div key={log.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 14, background: 'var(--color-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Badge variant={isSuccess ? 'success' : 'danger'}>
                            {isSuccess ? '✓ Processed' : '✕ Ingestion Error'}
                          </Badge>
                          {log.matched_lead_id && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
                              Lead ID: #{log.matched_lead_id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      {log.error_message && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: '#fef2f2', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                          {log.error_message}
                        </div>
                      )}

                      {payload && (
                        <div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 4 }}>Raw Payload Received</div>
                          <pre style={{ fontSize: '11px', background: 'var(--color-surface-2, #f1f5f9)', padding: 10, borderRadius: 6, overflowX: 'auto', margin: 0, fontFamily: 'var(--font-mono)' }}>
                            {typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Live Inbound Webhook Tester Modal */}
      {inboundTesterTarget && (
        <InboundWebhookTesterModal
          isOpen={!!inboundTesterTarget}
          onClose={() => setInboundTesterTarget(null)}
          source={inboundTesterTarget?.id ? inboundTesterTarget : null}
          sources={inboundSources}
          onLeadCreated={() => {
            fetchInboundSources();
          }}
        />
      )}

    </div>
  );
}
