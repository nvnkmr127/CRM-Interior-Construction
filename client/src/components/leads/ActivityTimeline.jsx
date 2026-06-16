import React, { useEffect, useState } from 'react';
import { getActivities, logActivity } from '../../api/leads';
import api from '../../api/axios';
import { formatDistanceToNow, format } from 'date-fns';

const Icons = {
  note: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  email: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  site_visit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  meeting: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  task: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  system: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> // Bolt icon for system
};

const ExpandableText = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 150;
  
  if (!text) return null;
  if (text.length <= maxLength) return <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>;

  return (
    <div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {expanded ? text : `${text.substring(0, maxLength)}...`}
      </p>
      <button 
        className="text-xs text-blue-600 font-medium mt-1 hover:underline focus:outline-none"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  );
};

export default function ActivityTimeline({ leadId, onTaskAdded }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [activeForm, setActiveForm] = useState(null); // 'note', 'email', 'task'

  // Generic form data
  const [formData, setFormData] = useState({
    notes: '',
    // Task specific
    title: '',
    due_date: '',
    assigned_to: '',
    priority: 'medium'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // You might want to fetch reps for task assignment
  const [reps, setReps] = useState([]);
  useEffect(() => {
    api.get('/users?role=sales_rep').then(res => setReps(res.data?.data || [])).catch(() => {});
  }, []);

  const fetchActivities = async (page = 1, append = false) => {
    if (!leadId) return;
    try {
      if (!append) setLoading(true);
      const res = await getActivities(leadId, { page, limit: 20 });
      if (res.success) {
        setActivities(prev => append ? [...prev, ...res.data] : res.data);
        setMeta({ total: res.total, page: res.page, limit: res.limit });
      }
    } catch (error) {
      console.error('Failed to load activities', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (activeForm === 'task') {
        if (!formData.title || !formData.due_date) return;
        await api.post('/tasks', {
          lead_id: leadId,
          title: formData.title,
          due_date: formData.due_date,
          assigned_to: formData.assigned_to,
          priority: formData.priority,
          status: 'open'
        });
        if (onTaskAdded) onTaskAdded();
        // Also log a system activity that a task was scheduled
        await logActivity(leadId, { type: 'note', notes: `Scheduled task: ${formData.title} due on ${formData.due_date}` });
      } else {
        if (!formData.notes.trim()) return;
        await logActivity(leadId, { type: activeForm, notes: formData.notes });
      }
      
      await fetchActivities(1, false);
      setFormData({ notes: '', title: '', due_date: '', assigned_to: '', priority: 'medium' });
      setActiveForm(null);
    } catch (err) {
      alert('Failed to save.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeStyle = (type, isSystem) => {
    if (isSystem) return 'bg-gray-800 text-yellow-400 border-gray-900';
    switch (type) {
      case 'site_visit': return 'bg-green-100 text-green-600 border-green-200';
      case 'email': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'meeting': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'note':
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const hasMore = meta.total > meta.page * meta.limit;

  const systemActivityKeywords = ['stage_change', 'automation', 'score_tier_change', 'sla_breach', 'duplicate', 'task_completed'];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm transition-all sticky top-0 z-10">
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-b rounded-t-lg justify-start">
          <button 
            onClick={() => setActiveForm(activeForm === 'email' ? null : 'email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'email' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
          >
            <Icons.email /> Log Email
          </button>
          <button 
            onClick={() => setActiveForm(activeForm === 'note' ? null : 'note')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'note' ? 'bg-gray-200 text-gray-800 border-gray-400' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
          >
            <Icons.note /> Add Note
          </button>
          <button 
            onClick={() => setActiveForm(activeForm === 'task' ? null : 'task')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'task' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
          >
            <Icons.task /> Schedule Task
          </button>
        </div>

        {activeForm && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            
            {activeForm === 'task' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">Assign to (optional)</option>
                    {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <textarea
                required
                rows="3"
                placeholder={activeForm === 'email' ? "Enter email details..." : "Write a note..."}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-md border border-gray-300 p-3 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
              ></textarea>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (activeForm === 'task' ? !formData.title : !formData.notes.trim())}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="relative pl-4 sm:pl-6 border-l-2 border-gray-100 space-y-6 pb-4">
        {loading && activities.length === 0 ? (
          <div className="animate-pulse space-y-4 pt-2">
            <div className="h-24 bg-gray-100 rounded-lg w-full"></div>
            <div className="h-24 bg-gray-100 rounded-lg w-full"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 italic">No activities recorded yet.</div>
        ) : (
          <>
            {activities.map((activity) => {
              const isSystem = !activity.user_name || systemActivityKeywords.some(kw => activity.type?.includes(kw) || activity.title?.toLowerCase().includes(kw));
              const Icon = isSystem ? Icons.system : (Icons[activity.type] || Icons.note);
              const typeLabel = activity.title || activity.type.replace('_', ' ');
              let timeAgo = '';
              let exactDate = '';
              try {
                const d = new Date(activity.created_at);
                timeAgo = formatDistanceToNow(d, { addSuffix: true });
                exactDate = format(d, 'PPpp');
              } catch(e) {}

              return (
                <div key={activity.id} className="relative group">
                  <div className={`absolute -left-[27px] sm:-left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm ${getTypeStyle(activity.type, isSystem)}`}>
                    <Icon />
                  </div>
                  
                  <div className={`border rounded-lg p-3.5 shadow-sm hover:shadow transition-shadow group-hover:border-gray-300 ${isSystem ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <span className="font-bold capitalize text-gray-800">{typeLabel}</span>
                        {isSystem ? (
                          <span className="ml-2 bg-gray-800 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">System Log</span>
                        ) : (
                          <span className="text-gray-500"> by {activity.user_name}</span>
                        )}
                        <span className="text-gray-400 text-xs ml-1 font-medium cursor-help" title={exactDate}>· {timeAgo}</span>
                      </div>
                    </div>
                    
                    {activity.notes && (
                      <ExpandableText text={activity.notes} />
                    )}
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchActivities(meta.page + 1, true)}
                  disabled={loading}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors shadow-sm"
                >
                  {loading ? 'Loading...' : 'Load older activities'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
