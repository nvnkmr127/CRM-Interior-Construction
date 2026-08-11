/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { getAutomationEvents, triggerAutomationEvent } from '../../api/leads';
import { Button, Badge, Input, Select, EmptyState } from '../ui';
import { useToast } from '../../store/toastContext';

const STATUS_CONFIG = {
  success: { variant: 'success', label: 'Success', icon: '✓' },
  failed:  { variant: 'danger', label: 'Failed',  icon: '✗' },
  skipped: { variant: 'warning', label: 'Skipped', icon: '⊘' },
};

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AutomationHistoryTab({ leadId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [triggering, setTriggering] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('allocation');
  
  const toast = useToast();

  const presets = {
    allocation: {
      workflow: 'Lead Allocation Routing',
      trigger_type: 'Lead Created',
      action_type: 'Round Robin Assignment',
      status: 'success',
      error_message: null
    },
    welcome: {
      workflow: 'Auto Welcome Email Campaign',
      trigger_type: 'Lead Stage Updated (New -> Contacted)',
      action_type: 'Send Email Template (Welcome)',
      status: 'success',
      error_message: null
    },
    alert: {
      workflow: 'High Value Alert SMS Trigger',
      trigger_type: 'Design Budget Set > $50k',
      action_type: 'Send WhatsApp notification to Architect Manager',
      status: 'success',
      error_message: null
    },
    sync: {
      workflow: 'Sync Contact details with External ERP System',
      trigger_type: 'Stakeholder Added',
      action_type: 'REST Webhook dispatch',
      status: 'failed',
      error_message: 'External API Gateway returned 504 Gateway Timeout.'
    }
  };

  const fetchEvents = () => {
    if (!leadId) return;
    setLoading(true);
    getAutomationEvents(leadId)
      .then(data => setEvents(data || []))
      .catch(() => setError('Failed to load automation history.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, [leadId]);

  const handleTestTrigger = async (e) => {
    e.preventDefault();
    if (!leadId || triggering) return;
    setTriggering(true);
    try {
      const payload = presets[selectedPreset];
      await triggerAutomationEvent(leadId, payload);
      toast.success('Mock automation workflow executed successfully!');
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger mock workflow execution.');
    } finally {
      setTriggering(false);
    }
  };

  // Filter & Search Logic
  const filteredEvents = events.filter(evt => {
    const matchesSearch = 
      (evt.workflow || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.trigger_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.action_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.error_message || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalRuns = events.length;
  const successRuns = events.filter(e => e.status === 'success').length;
  const failedRuns = events.filter(e => e.status === 'failed').length;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm font-medium">Fetching automation history log vault…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-xl text-sm flex items-center gap-2">
        <span>⚠️</span> {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Console */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric Card 1: Total */}
        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Runs</p>
            <h4 className="text-2xl font-black text-gray-800 mt-1">{totalRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-indigo-50 rounded-xl">🤖</span>
        </div>

        {/* Metric Card 2: Successes */}
        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Successful</p>
            <h4 className="text-2xl font-black text-green-600 mt-1">{successRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-green-50 rounded-xl">✓</span>
        </div>

        {/* Metric Card 3: Failures */}
        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Failed Runs</p>
            <h4 className="text-2xl font-black text-red-650 mt-1">{failedRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-red-50 rounded-xl">✗</span>
        </div>
      </div>

      {/* Action Console & Live Tester */}
      <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-100/80 p-5 rounded-2xl shadow-sm">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
          <span>⚙️</span> Automation Testing Console
        </h4>
        <form onSubmit={handleTestTrigger} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          <div className="flex-1 w-full">
            <Select
              label="Select Automation Rule to Test"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              <option value="allocation">Round Robin Assignment Routing (Success)</option>
              <option value="welcome">Auto Welcome Email Campaign (Success)</option>
              <option value="alert">High Value Alert SMS Trigger (Success)</option>
              <option value="sync">Sync Contact Details with External ERP (Failed)</option>
            </Select>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={triggering}
            style={{ height: '38px', padding: '0 16px', whiteSpace: 'nowrap' }}
          >
            {triggering ? 'Triggering...' : '⚡ Fire Test Event'}
          </Button>
        </form>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by workflow, trigger, or actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'success', label: 'Success' },
            { id: 'failed', label: 'Failed' },
            { id: 'skipped', label: 'Skipped' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all duration-200"
              style={{
                background: statusFilter === tab.id ? 'var(--color-accent)' : '#fff',
                borderColor: statusFilter === tab.id ? 'var(--color-accent)' : 'rgba(0,0,0,0.06)',
                color: statusFilter === tab.id ? '#fff' : '#4b5563',
                boxShadow: statusFilter === tab.id ? '0 4px 12px rgba(139,92,246,0.15)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <EmptyState
            title="No Automation Events Found"
            description={
              searchQuery || statusFilter !== 'all'
                ? "No logs match your current search terms and status filters."
                : "No automation workflows have been triggered for this lead yet."
            }
          />
        ) : (
          filteredEvents.map(evt => {
            const badgeCfg = STATUS_CONFIG[evt.status] || { variant: 'neutral', label: evt.status, icon: '?' };
            return (
              <div 
                key={evt.id} 
                className="group relative bg-white/45 backdrop-blur-md border border-white/50 hover:border-indigo-200 hover:bg-white/80 p-5 rounded-2xl shadow-sm transition-all duration-200"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-black text-gray-800 bg-indigo-50 border border-indigo-100/60 px-3 py-1 rounded-xl">
                      {evt.workflow || 'Unknown Workflow'}
                    </span>
                    <Badge variant={badgeCfg.variant}>
                      <span className="mr-1">{badgeCfg.icon}</span> {badgeCfg.label}
                    </Badge>
                  </div>
                  <span className="text-[11.5px] text-gray-400 font-medium sm:text-right shrink-0">
                    🕒 {formatDate(evt.executed_at)}
                  </span>
                </div>

                {/* Details layout Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {evt.trigger_type && (
                    <div className="bg-gray-50/40 p-2.5 rounded-xl border border-gray-100/30">
                      <span className="text-gray-400 block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Trigger</span>
                      <span className="text-gray-700 font-medium">{evt.trigger_type}</span>
                    </div>
                  )}
                  {evt.action_type && (
                    <div className="bg-gray-50/40 p-2.5 rounded-xl border border-gray-100/30">
                      <span className="text-gray-400 block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Action</span>
                      <span className="text-gray-700 font-medium">{evt.action_type}</span>
                    </div>
                  )}
                  {evt.duration_ms != null && (
                    <div className="bg-gray-50/40 p-2.5 rounded-xl border border-gray-100/30">
                      <span className="text-gray-400 block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Duration</span>
                      <span className="text-gray-700 font-bold">{evt.duration_ms} ms</span>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {evt.status === 'failed' && evt.error_message && (
                  <div className="mt-4 p-3 bg-red-50/65 border border-red-100 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <div>
                      <strong className="block font-bold mb-0.5">Execution Failure Details:</strong>
                      <span className="font-mono leading-relaxed">{evt.error_message}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
