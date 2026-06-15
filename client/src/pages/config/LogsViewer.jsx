import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('outbound');
  
  // Metadata for filters
  const [webhooks, setWebhooks] = useState([]);
  const [sources, setSources] = useState([]);
  
  // Data state
  const [outboundLogs, setOutboundLogs] = useState([]);
  const [inboundLogs, setInboundLogs] = useState([]);
  
  // Filter state
  const [outFilters, setOutFilters] = useState({ webhookId: '', status: '', event: '', from: '', to: '' });
  const [inFilters, setInFilters] = useState({ sourceKey: '', status: '', from: '', to: '' });
  
  // Pagination state
  const [outPage, setOutPage] = useState(1);
  const [inPage, setInPage] = useState(1);
  const [outHasMore, setOutHasMore] = useState(true);
  const [inHasMore, setInHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Expanded rows
  const [expandedOut, setExpandedOut] = useState(null);
  const [expandedIn, setExpandedIn] = useState(null);
  
  // Retrying state map
  const [retrying, setRetrying] = useState({});

  useEffect(() => {
    // Fetch metadata for filter dropdowns
    api.get('/config/webhooks').then(res => {
      if (res.data?.success) setWebhooks(res.data.data);
    }).catch(e => console.error('Failed to fetch webhooks list:', e));
    
    api.get('/config/webhook-sources').then(res => {
      if (res.data?.success) setSources(res.data.data);
    }).catch(e => console.error('Failed to fetch webhook sources list:', e));
  }, []);

  const fetchOutbound = useCallback(async (pageToLoad = 1, append = false) => {
    setLoading(true);
    try {
      const params = { ...outFilters, page: pageToLoad, limit: 20 };
      // Clean empty params
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      
      const res = await api.get('/logs/webhook-events', { params });
      if (res.data?.success) {
        const newData = res.data.data;
        setOutboundLogs(prev => append ? [...prev, ...newData] : newData);
        setOutHasMore(newData.length === 20);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [outFilters]);

  const fetchInbound = useCallback(async (pageToLoad = 1, append = false) => {
    setLoading(true);
    try {
      const params = { ...inFilters, page: pageToLoad, limit: 20 };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      
      const res = await api.get('/logs/inbound', { params });
      if (res.data?.success) {
        const newData = res.data.data;
        setInboundLogs(prev => append ? [...prev, ...newData] : newData);
        setInHasMore(newData.length === 20);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [inFilters]);

  // Initial loads and filter changes
  useEffect(() => {
    if (activeTab === 'outbound') {
      setOutPage(1);
      fetchOutbound(1, false);
      setExpandedOut(null);
    } else {
      setInPage(1);
      fetchInbound(1, false);
      setExpandedIn(null);
    }
  }, [activeTab, outFilters, inFilters, fetchOutbound, fetchInbound]);

  const loadMore = () => {
    if (activeTab === 'outbound') {
      const next = outPage + 1;
      setOutPage(next);
      fetchOutbound(next, true);
    } else {
      const next = inPage + 1;
      setInPage(next);
      fetchInbound(next, true);
    }
  };

  const handleRetry = async (logId, e) => {
    e.stopPropagation();
    setRetrying(prev => ({ ...prev, [logId]: true }));
    try {
      const res = await api.post(`/logs/webhook-events/${logId}/retry`);
      if (res.data?.success) {
        const { statusCode } = res.data.data;
        setOutboundLogs(prev => prev.map(log => 
          log.id === logId ? { ...log, status_code: statusCode, attempt_number: (log.attempt_number || 1) + 1 } : log
        ));
      }
    } catch (err) {
      console.error(err);
      alert('Retry failed');
    } finally {
      setRetrying(prev => ({ ...prev, [logId]: false }));
    }
  };

  const renderJson = (data) => {
    let parsed = data;
    if (typeof data === 'string') {
      try { parsed = JSON.parse(data); } catch(e) {}
    }
    return JSON.stringify(parsed, null, 2);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webhook Logs</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor webhook deliveries and inbound payloads.</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('outbound')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'outbound' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Outbound Webhook Logs
            </button>
            <button
              onClick={() => setActiveTab('inbound')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'inbound' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inbound Webhook Logs
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-center">
          {activeTab === 'outbound' ? (
            <>
              <select 
                className="border-gray-300 rounded-md shadow-sm text-sm p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                value={outFilters.webhookId} onChange={e => setOutFilters({...outFilters, webhookId: e.target.value})}
              >
                <option value="">All Webhooks</option>
                {webhooks.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select 
                className="border-gray-300 rounded-md shadow-sm text-sm p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                value={outFilters.status} onChange={e => setOutFilters({...outFilters, status: e.target.value})}
              >
                <option value="">All Statuses</option>
                <option value="success">Success (2xx)</option>
                <option value="error">Failed (4xx/5xx)</option>
              </select>
              <input 
                type="text" placeholder="Event (e.g. lead.created)" 
                className="border-gray-300 rounded-md shadow-sm text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={outFilters.event} onChange={e => setOutFilters({...outFilters, event: e.target.value})} 
              />
            </>
          ) : (
            <>
              <select 
                className="border-gray-300 rounded-md shadow-sm text-sm p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                value={inFilters.sourceKey} onChange={e => setInFilters({...inFilters, sourceKey: e.target.value})}
              >
                <option value="">All Sources</option>
                {sources.map(s => <option key={s.source_key} value={s.source_key}>{s.name} ({s.source_key})</option>)}
              </select>
              <select 
                className="border-gray-300 rounded-md shadow-sm text-sm p-2 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                value={inFilters.status} onChange={e => setInFilters({...inFilters, status: e.target.value})}
              >
                <option value="">All Statuses</option>
                <option value="processed">Processed</option>
                <option value="ignored">Ignored</option>
                <option value="failed">Failed</option>
              </select>
            </>
          )}
          
          <div className="flex gap-2 items-center ml-auto">
            <span className="text-sm font-medium text-gray-500">From</span>
            <input 
              type="date" 
              className="border-gray-300 rounded-md shadow-sm text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" 
              value={activeTab === 'outbound' ? outFilters.from : inFilters.from}
              onChange={e => activeTab === 'outbound' ? setOutFilters({...outFilters, from: e.target.value}) : setInFilters({...inFilters, from: e.target.value})} 
            />
            <span className="text-sm font-medium text-gray-400">To</span>
            <input 
              type="date" 
              className="border-gray-300 rounded-md shadow-sm text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500" 
              value={activeTab === 'outbound' ? outFilters.to : inFilters.to}
              onChange={e => activeTab === 'outbound' ? setOutFilters({...outFilters, to: e.target.value}) : setInFilters({...inFilters, to: e.target.value})} 
            />
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {activeTab === 'outbound' ? (
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Webhook Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Latency</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Attempt</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead Created/Updated</th>
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {activeTab === 'outbound' ? (
                outboundLogs.length === 0 && !loading ? (
                  <tr><td colSpan="6" className="p-12 text-center text-gray-500">No outbound logs found matching these filters.</td></tr>
                ) : (
                  outboundLogs.map(log => {
                    const isSuccess = log.status_code >= 200 && log.status_code < 300;
                    const whName = webhooks.find(w => w.id === log.webhook_id)?.name || 'Unknown';
                    const isExpanded = expandedOut === log.id;

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-indigo-50/50 cursor-pointer transition-colors" onClick={() => setExpandedOut(isExpanded ? null : log.id)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.event}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{whName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-md ${isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {log.status_code === 0 ? 'Failed (Network)' : log.status_code}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.latency_ms} ms</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                            {!isSuccess && (
                              <button 
                                onClick={(e) => handleRetry(log.id, e)}
                                disabled={retrying[log.id]}
                                className="mr-3 text-xs bg-white border border-gray-300 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-300 text-gray-700 px-3 py-1.5 rounded transition-all shadow-sm disabled:opacity-50"
                              >
                                {retrying[log.id] ? 'Retrying...' : 'Retry'}
                              </button>
                            )}
                            <span className="text-gray-400">Attempt #{log.attempt_number || 1}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <td colSpan="6" className="p-6 shadow-inner">
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Request Payload</p>
                                  <pre className="text-xs text-gray-800 bg-gray-900 !text-green-400 p-4 rounded-lg overflow-auto max-h-80 shadow-inner">
                                    {renderJson(log.payload)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Response Body</p>
                                  <pre className={`text-xs p-4 rounded-lg overflow-auto max-h-80 shadow-inner ${isSuccess ? 'bg-gray-900 !text-blue-300' : 'bg-red-900 !text-red-300'}`}>
                                    {renderJson(log.response_body)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              ) : (
                inboundLogs.length === 0 && !loading ? (
                  <tr><td colSpan="4" className="p-12 text-center text-gray-500">No inbound logs found matching these filters.</td></tr>
                ) : (
                  inboundLogs.map(log => {
                    const sourceName = sources.find(s => s.source_key === log.source_key)?.name || log.source_key;
                    const isExpanded = expandedIn === log.id;
                    const isSuccess = log.status === 'processed';
                    const isIgnored = log.status === 'ignored';

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-indigo-50/50 cursor-pointer transition-colors" onClick={() => setExpandedIn(isExpanded ? null : log.id)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sourceName}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs font-bold rounded-md ${isSuccess ? 'bg-emerald-100 text-emerald-800' : isIgnored ? 'bg-gray-200 text-gray-800' : 'bg-rose-100 text-rose-800'}`}>
                              {log.status ? log.status.toUpperCase() : 'FAILED'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                            {log.lead_id ? (
                              <a href={`/leads?id=${log.lead_id}`} onClick={e => e.stopPropagation()} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                                {log.lead_id.split('-')[0]}...
                              </a>
                            ) : <span className="text-gray-400">N/A</span>}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <td colSpan="4" className="p-6 shadow-inner">
                              {log.error && (
                                <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-lg text-sm border border-red-200 flex items-start gap-2">
                                  <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                                  </svg>
                                  <div>
                                    <strong className="block font-bold mb-1">Processing Error</strong> 
                                    {log.error}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Raw Incoming Payload</p>
                                  <pre className="text-xs text-gray-800 bg-gray-900 !text-indigo-300 p-4 border border-gray-200 rounded-lg overflow-auto max-h-80 shadow-inner">
                                    {renderJson(log.raw_payload)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Mapped Output Data</p>
                                  <pre className="text-xs text-gray-800 bg-gray-900 !text-teal-300 p-4 border border-gray-200 rounded-lg overflow-auto max-h-80 shadow-inner">
                                    {renderJson(log.mapped_data)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              )}
            </tbody>
          </table>
          
          {loading && (
            <div className="text-center p-8 text-sm font-medium text-gray-500 flex justify-center items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading data...
            </div>
          )}

          {/* Load More */}
          {((activeTab === 'outbound' && outHasMore) || (activeTab === 'inbound' && inHasMore)) && !loading && (
            <div className="p-6 border-t border-gray-200 flex justify-center bg-gray-50">
              <button 
                onClick={loadMore}
                className="px-6 py-2.5 bg-white border border-gray-300 rounded-md text-sm font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-sm"
              >
                Load More Logs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
