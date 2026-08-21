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
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Total Runs</p>
            <h4 className="text-2xl font-black text-[var(--color-text)] mt-1">{totalRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl">🤖</span>
        </div>

        {/* Metric Card 2: Successes */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Successful</p>
            <h4 className="text-2xl font-black text-green-600 mt-1">{successRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-green-50/50 border border-green-150 rounded-xl text-green-600">✓</span>
        </div>

        {/* Metric Card 3: Failures */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Failed Runs</p>
            <h4 className="text-2xl font-black text-red-600 mt-1">{failedRuns}</h4>
          </div>
          <span className="text-2xl p-2 bg-red-50/50 border border-red-150 rounded-xl text-red-650">✗</span>
        </div>
      </div>

      {/* Action Console & Live Tester */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm">
        <h4 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2 mb-4">
          <span>⚙️</span> Automation Testing Console
        </h4>
        <form onSubmit={handleTestTrigger} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
          <div className="flex-1 w-full">
            <Select
              label="Select Automation Rule to Test"
              value={selectedPreset}
              onChange={(val) => setSelectedPreset(val)}
              options={[
                { value: 'allocation', label: 'Round Robin Assignment Routing (Success)' },
                { value: 'welcome', label: 'Auto Welcome Email Campaign (Success)' },
                { value: 'alert', label: 'High Value Alert SMS Trigger (Success)' },
                { value: 'sync', label: 'Sync Contact Details with External ERP (Failed)' }
              ]}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={triggering}
            className="h-[38px] px-6 whitespace-nowrap"
            style={{ minHeight: '38px' }}
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
                background: statusFilter === tab.id ? 'var(--color-accent)' : 'var(--color-surface)',
                borderColor: statusFilter === tab.id ? 'var(--color-accent)' : 'var(--color-border)',
                color: statusFilter === tab.id ? '#fff' : 'var(--color-text-secondary)',
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
                className="group relative bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)] p-5 rounded-2xl shadow-sm transition-all duration-200"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-[var(--color-text)] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-1 rounded-xl">
                      {evt.workflow || 'Unknown Workflow'}
                    </span>
                    <Badge variant={badgeCfg.variant}>
                      <span className="mr-1">{badgeCfg.icon}</span> {badgeCfg.label}
                    </Badge>
                  </div>
                  <span className="text-[11.5px] text-[var(--color-text-secondary)] font-medium sm:text-right shrink-0">
                    🕒 {formatDate(evt.executed_at)}
                  </span>
                </div>

                {/* Details layout Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {evt.trigger_type && (
                    <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-secondary)] block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Trigger</span>
                      <span className="text-[var(--color-text)] font-medium">{evt.trigger_type}</span>
                    </div>
                  )}
                  {evt.action_type && (
                    <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-secondary)] block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Action</span>
                      <span className="text-[var(--color-text)] font-medium">{evt.action_type}</span>
                    </div>
                  )}
                  {evt.duration_ms != null && (
                    <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-border)]">
                      <span className="text-[var(--color-text-secondary)] block font-semibold uppercase tracking-wider mb-0.5" style={{ fontSize: '9px' }}>Duration</span>
                      <span className="text-[var(--color-text)] font-bold">{evt.duration_ms} ms</span>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {evt.status === 'failed' && evt.error_message && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-750 flex items-start gap-2 animate-fadeIn">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <div>
                      <strong className="block font-bold mb-0.5 text-red-800">Execution Failure Details:</strong>
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
