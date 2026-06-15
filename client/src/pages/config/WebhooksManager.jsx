import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const AVAILABLE_EVENTS = [
  { category: 'Lead Events', events: ['lead.created', 'lead.updated', 'lead.stage_changed', 'lead.converted'] },
  { category: 'Project Events', events: ['project.created', 'project.phase_completed', 'project.task_completed'] },
  { category: 'Payment Events', events: ['payment.milestone_due', 'payment.received'] },
  { category: 'Client Events', events: ['client.design_approved', 'client.snag_raised'] }
];

function generateRandomSecret() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: [],
    custom_headers: [{ key: '', value: '' }],
    retry_count: 3
  });

  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/config/webhooks');
      if (res.data?.success) {
        setWebhooks(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const openDrawer = (webhook = null) => {
    if (webhook) {
      setEditingId(webhook.id);
      
      let parsedHeaders = [];
      try { parsedHeaders = typeof webhook.custom_headers === 'string' ? JSON.parse(webhook.custom_headers) : webhook.custom_headers; } catch(e) {}
      
      let parsedEvents = [];
      try { parsedEvents = typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events; } catch(e) {}
      
      const headerArray = parsedHeaders && Object.keys(parsedHeaders).length > 0 
        ? Object.entries(parsedHeaders).map(([k, v]) => ({ key: k, value: v }))
        : [{ key: '', value: '' }];

      setFormData({
        name: webhook.name || '',
        url: webhook.url || '',
        secret: webhook.secret || '',
        events: parsedEvents || [],
        custom_headers: headerArray,
        retry_count: webhook.retry_count || 3
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        url: '',
        secret: '',
        events: [],
        custom_headers: [{ key: '', value: '' }],
        retry_count: 3
      });
    }
    setTestResult(null);
    setIsDrawerOpen(true);
  };

  const handleToggleEvent = (eventName) => {
    setFormData(prev => {
      const isSelected = prev.events.includes(eventName);
      return {
        ...prev,
        events: isSelected 
          ? prev.events.filter(e => e !== eventName)
          : [...prev.events, eventName]
      };
    });
  };

  const handleHeaderChange = (index, field, value) => {
    const newHeaders = [...formData.custom_headers];
    newHeaders[index][field] = value;
    setFormData({ ...formData, custom_headers: newHeaders });
  };

  const addHeaderRow = () => {
    setFormData({ ...formData, custom_headers: [...formData.custom_headers, { key: '', value: '' }] });
  };

  const removeHeaderRow = (index) => {
    const newHeaders = formData.custom_headers.filter((_, i) => i !== index);
    if (newHeaders.length === 0) newHeaders.push({ key: '', value: '' });
    setFormData({ ...formData, custom_headers: newHeaders });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      // Reconstruct headers to object
      const headerObj = {};
      formData.custom_headers.forEach(h => {
        if (h.key.trim() && h.value.trim()) {
          headerObj[h.key.trim()] = h.value.trim();
        }
      });

      const payload = {
        name: formData.name,
        url: formData.url,
        secret: formData.secret || null,
        events: formData.events,
        custom_headers: headerObj,
        retry_count: Number(formData.retry_count)
      };

      if (editingId) {
        await api.put(`/config/webhooks/${editingId}`, payload);
      } else {
        await api.post('/config/webhooks', payload);
      }
      
      setIsDrawerOpen(false);
      fetchWebhooks();
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save webhook.');
    }
  };

  const handleToggleActive = async (id) => {
    try {
      await api.patch(`/config/webhooks/${id}/toggle`);
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: !w.is_active } : w));
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await api.delete(`/config/webhooks/${id}`);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleTest = async () => {
    if (!editingId) {
      alert('Please save the webhook first before testing.');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post(`/config/webhooks/${editingId}/test`);
      if (res.data?.success) {
        setTestResult(res.data.data); // { statusCode, latencyMs, success }
      }
    } catch (err) {
      console.error('Test failed', err);
      setTestResult({ success: false, statusCode: err.response?.status || 0, latencyMs: 0 });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outbound Webhooks</h1>
          <p className="text-gray-500 text-sm mt-1">Configure endpoints to receive real-time event payloads.</p>
        </div>
        <button 
          onClick={() => openDrawer()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors"
        >
          + New Webhook
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Events</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No webhooks configured.</td>
                </tr>
              ) : webhooks.map(wh => {
                let parsedEvents = [];
                try { parsedEvents = typeof wh.events === 'string' ? JSON.parse(wh.events) : (wh.events || []); } catch(e) {}

                return (
                  <tr key={wh.id} className={!wh.is_active ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{wh.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono truncate max-w-[200px]" title={wh.url}>
                      {wh.url}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {parsedEvents.length} events
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => handleToggleActive(wh.id)}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none ${wh.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${wh.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openDrawer(wh)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                      <button onClick={() => handleDelete(wh.id)} className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setIsDrawerOpen(false)} />
          
          <div className="ml-auto relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col transform transition-transform animate-slide-in-right">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Webhook' : 'New Webhook'}</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-light">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="webhook-form" onSubmit={handleSave} className="space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input 
                      type="text" required
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Production ERP Integration"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target URL *</label>
                    <input 
                      type="url" required
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})}
                      placeholder="https://api.example.com/webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                      <span>Signing Secret</span>
                      <button 
                        type="button" 
                        className="text-indigo-600 text-xs font-semibold hover:underline"
                        onClick={() => setFormData({...formData, secret: generateRandomSecret()})}
                      >
                        Auto-generate
                      </button>
                    </label>
                    <input 
                      type="text"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500"
                      value={formData.secret}
                      onChange={e => setFormData({...formData, secret: e.target.value})}
                      placeholder="Used for HMAC-SHA256 signatures (Optional)"
                    />
                  </div>
                </div>

                {/* Subscriptions */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Event Subscriptions</h3>
                  <div className="space-y-4">
                    {AVAILABLE_EVENTS.map(group => (
                      <div key={group.category}>
                        <h4 className="text-xs font-medium text-gray-500 mb-2">{group.category}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {group.events.map(ev => (
                            <label key={ev} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                              <input 
                                type="checkbox"
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                checked={formData.events.includes(ev)}
                                onChange={() => handleToggleEvent(ev)}
                              />
                              <span>{ev}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Headers */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Custom Headers</h3>
                  <div className="space-y-2">
                    {formData.custom_headers.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input 
                          type="text" placeholder="Key (e.g. Authorization)"
                          className="flex-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          value={h.key} onChange={e => handleHeaderChange(i, 'key', e.target.value)}
                        />
                        <input 
                          type="text" placeholder="Value"
                          className="flex-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          value={h.value} onChange={e => handleHeaderChange(i, 'value', e.target.value)}
                        />
                        <button type="button" onClick={() => removeHeaderRow(i)} className="text-gray-400 hover:text-red-500 px-2">×</button>
                      </div>
                    ))}
                    <button type="button" onClick={addHeaderRow} className="text-indigo-600 text-sm font-medium mt-1">+ Add Header</button>
                  </div>
                </div>

                {/* Retry settings */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Retry Count (1-5)</label>
                  <input 
                    type="number" min="1" max="5" required
                    className="w-1/3 border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.retry_count}
                    onChange={e => setFormData({...formData, retry_count: e.target.value})}
                  />
                </div>

                {/* Testing Section */}
                {editingId && (
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Test Webhook Delivery</p>
                        <p className="text-xs text-gray-500">Sends a mock payload to the target URL.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {testResult && (
                          <div className={`flex items-center gap-1 text-sm font-bold ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.success ? '✓' : '✗'} Status {testResult.statusCode}
                            <span className="text-gray-400 font-normal ml-1">({testResult.latencyMs}ms)</span>
                          </div>
                        )}
                        <button 
                          type="button" 
                          onClick={handleTest}
                          disabled={isTesting}
                          className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {isTesting ? 'Testing...' : 'Send Test'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="submit" form="webhook-form" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 shadow-sm transition-colors">
                {editingId ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
