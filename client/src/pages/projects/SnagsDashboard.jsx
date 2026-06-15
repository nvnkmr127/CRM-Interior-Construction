import React, { useState, useEffect } from 'react';
import { getSnags, updateSnag } from '../../api/snags';
import { Avatar, Badge, Button, Textarea, Spinner } from '../../components/ui';

// Mock users for assignment dropdown
const MOCK_USERS = [
  { value: 'user1', label: 'Alice Designer' },
  { value: 'user2', label: 'Bob Manager' },
  { value: 'user3', label: 'Charlie Admin' }
];

export default function SnagsDashboard({ projectId }) {
  const [snags, setSnags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const [assignModal, setAssignModal] = useState({ isOpen: false, snagId: null, assigneeId: '' });
  const [resolveModal, setResolveModal] = useState({ isOpen: false, snagId: null, resolutionNote: '' });

  const fetchSnags = async () => {
    setLoading(true);
    try {
      const res = await getSnags({
        projectId,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        assigneeId: assigneeFilter || undefined
      });
      setSnags(res.data?.data || res.data || []);
    } catch (e) {
      console.error('Failed to fetch snags', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnags();
  }, [projectId, statusFilter, categoryFilter, assigneeFilter]);

  const handleUpdateStatus = async (snagId, newStatus, extraData = {}) => {
    try {
      await updateSnag(snagId, { status: newStatus, ...extraData });
      fetchSnags();
    } catch (e) {
      console.error('Failed to update snag', e);
      alert('Error updating snag');
    }
  };

  const handleAssignSubmit = async () => {
    if (!assignModal.assigneeId) return;
    await updateSnag(assignModal.snagId, { assigneeId: assignModal.assigneeId });
    setAssignModal({ isOpen: false, snagId: null, assigneeId: '' });
    fetchSnags();
  };

  const handleResolveSubmit = async () => {
    if (!resolveModal.resolutionNote) return alert('Resolution note is required');
    await handleUpdateStatus(resolveModal.snagId, 'resolved', { resolutionNote: resolveModal.resolutionNote });
    setResolveModal({ isOpen: false, snagId: null, resolutionNote: '' });
  };

  // Compute SLAs
  // "Resolve within 12h" -> Amber if <50% time left, red if overdue.
  const computeSlaStatus = (createdAt, slaHours = 48) => {
    if (!createdAt) return { status: 'ok', text: `${slaHours}h left` };
    const created = new Date(createdAt);
    const now = new Date();
    const elapsedHours = (now - created) / (1000 * 60 * 60);
    const remainingHours = slaHours - elapsedHours;
    
    if (remainingHours < 0) return { status: 'breached', text: `Overdue by ${Math.abs(Math.round(remainingHours))}h` };
    if (remainingHours <= slaHours * 0.5) return { status: 'at_risk', text: `${Math.round(remainingHours)}h left` };
    return { status: 'ok', text: `${Math.round(remainingHours)}h left` };
  };

  const breachingCount = snags.filter(s => s.status !== 'resolved' && s.status !== 'client_verified' && computeSlaStatus(s.created_at, s.sla_hours).status === 'breached').length;

  const getStatusColor = (status) => {
    switch(status) {
      case 'open': return 'danger';
      case 'assigned': return 'warning';
      case 'in_progress': return 'primary';
      case 'resolved': return 'success';
      case 'client_verified': return 'success';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Snags & Punch List</h2>
          <div className="flex gap-4 mt-2 items-center">
            {breachingCount > 0 && (
              <Badge variant="danger" size="sm">{breachingCount} snags breaching SLA</Badge>
            )}
            <span className="text-slate-400 text-sm font-medium">Avg resolution: 24h</span>
          </div>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner">
          <button onClick={() => setView('grid')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Grid</button>
          <button onClick={() => setView('list')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${view === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>List</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-900/80 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 transition-colors">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="client_verified">Verified</option>
        </select>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-900/80 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 transition-colors">
          <option value="">All Categories</option>
          <option value="civil">Civil</option>
          <option value="electrical">Electrical</option>
          <option value="plumbing">Plumbing</option>
          <option value="finishes">Finishes</option>
        </select>
        
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="bg-slate-900/80 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 transition-colors">
          <option value="">All Assignees</option>
          {MOCK_USERS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Spinner size="lg" /></div>
      ) : snags.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-slate-800/20 rounded-xl border border-slate-700/50 border-dashed">
          No snags found for these filters.
        </div>
      ) : (
        <div className={view === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
          {snags.map(snag => {
            const sla = computeSlaStatus(snag.created_at, snag.sla_hours);
            const slaColor = sla.status === 'breached' ? 'text-red-400' : sla.status === 'at_risk' ? 'text-amber-400' : 'text-slate-400';
            const isResolved = snag.status === 'resolved' || snag.status === 'client_verified';

            return (
              <div key={snag.id} className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col hover:border-slate-600 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-white line-clamp-2 text-lg">{snag.title}</h3>
                  <Badge variant={getStatusColor(snag.status)} className="capitalize shrink-0 whitespace-nowrap ml-3">{snag.status.replace('_', ' ')}</Badge>
                </div>
                
                <div className="flex gap-2 mb-4">
                  {snag.category && <Badge variant="neutral" className="capitalize">{snag.category}</Badge>}
                </div>
                
                <div className="text-sm text-slate-300 mb-6 flex-1 line-clamp-3">{snag.description}</div>
                
                <div className="flex items-center justify-between text-xs font-medium bg-slate-900/60 p-3 rounded-lg mb-4 border border-slate-700/50">
                  <div>
                    <span className="text-slate-500 block mb-1.5 uppercase tracking-wider text-[10px] font-bold">Assignee</span>
                    {snag.assignee_id ? (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Avatar name={snag.assignee_name || 'Assigned'} size="sm" />
                        {snag.assignee_name || 'Assigned User'}
                      </div>
                    ) : (
                      <span className="text-red-400 font-bold px-2 py-1 bg-red-500/10 rounded border border-red-500/20">Unassigned</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block mb-1.5 uppercase tracking-wider text-[10px] font-bold">Raised By</span>
                    <span className="text-slate-300 font-medium">{snag.raised_by_client ? 'Client' : 'Staff'}</span>
                  </div>
                </div>

                {!isResolved && (
                  <div className={`text-xs font-bold ${slaColor} mb-5 flex items-center gap-1.5`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    SLA: {sla.text}
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-700/80 flex justify-end gap-3 mt-auto">
                  {snag.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => setAssignModal({ isOpen: true, snagId: snag.id, assigneeId: '' })}>Assign to user</Button>
                  )}
                  {snag.status === 'assigned' && (
                    <Button size="sm" variant="primary" onClick={() => handleUpdateStatus(snag.id, 'in_progress')}>Start Progress</Button>
                  )}
                  {snag.status === 'in_progress' && (
                    <Button size="sm" variant="success" onClick={() => setResolveModal({ isOpen: true, snagId: snag.id, resolutionNote: '' })}>Mark as Resolved</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      {assignModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5">Assign Snag</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Assignee</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-blue-500 transition-colors"
                value={assignModal.assigneeId}
                onChange={e => setAssignModal(prev => ({...prev, assigneeId: e.target.value}))}
              >
                <option value="">Choose a team member...</option>
                {MOCK_USERS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAssignModal({ isOpen: false, snagId: null, assigneeId: '' })}>Cancel</Button>
              <Button variant="primary" onClick={handleAssignSubmit} disabled={!assignModal.assigneeId}>Confirm Assignment</Button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5">Resolve Snag</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Resolution Note *</label>
              <Textarea 
                value={resolveModal.resolutionNote}
                onChange={e => setResolveModal(prev => ({...prev, resolutionNote: e.target.value}))}
                placeholder="Describe how the snag was fixed..."
                required
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResolveModal({ isOpen: false, snagId: null, resolutionNote: '' })}>Cancel</Button>
              <Button variant="success" onClick={handleResolveSubmit} disabled={!resolveModal.resolutionNote}>Submit Resolution</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
