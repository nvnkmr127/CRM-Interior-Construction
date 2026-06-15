import React, { useEffect, useState } from 'react';
import { getActivities, logActivity } from '../../api/leads';
import { formatDistanceToNow } from 'date-fns';

const Icons = {
  call: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
  note: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  email: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  site_visit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  whatsapp: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  meeting: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
};

export default function ActivityTimeline({ leadId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [formData, setFormData] = useState({
    type: 'call',
    notes: '',
    outcome: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!formData.notes.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await logActivity(leadId, formData);
      if (res.success) {
        await fetchActivities(1, false);
        setFormData({ type: 'call', notes: '', outcome: '' });
        setIsFormOpen(false);
      }
    } catch (err) {
      alert('Failed to log activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'site_visit': return 'bg-green-100 text-green-600 border-green-200';
      case 'email': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'whatsapp': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'meeting': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'note':
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const hasMore = meta.total > meta.page * meta.limit;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm transition-all">
        {!isFormOpen ? (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="w-full py-3 px-4 text-left text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-50 flex items-center gap-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Log Activity
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {['call', 'note', 'email', 'site_visit', 'whatsapp'].map(type => {
                const Icon = Icons[type] || Icons.note;
                const isSelected = formData.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type, outcome: '' }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold capitalize transition-colors shadow-sm ${
                      isSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon />
                    {type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>

            <textarea
              required
              rows="3"
              placeholder={`Write a ${formData.type.replace('_', ' ')} note...`}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 p-3 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
            ></textarea>

            {formData.type === 'call' && (
              <div>
                <select
                  value={formData.outcome}
                  onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full md:w-auto rounded-md border border-gray-300 p-2 text-sm bg-white shadow-sm outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Outcome...</option>
                  <option value="connected">Connected</option>
                  <option value="left_voicemail">Left Voicemail</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="wrong_number">Wrong Number</option>
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.notes.trim()}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save Activity'}
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
              const Icon = Icons[activity.type] || Icons.note;
              const typeLabel = activity.title || activity.type.replace('_', ' ');
              let timeAgo = '';
              try {
                timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });
              } catch(e) {}

              return (
                <div key={activity.id} className="relative group">
                  <div className={`absolute -left-[27px] sm:-left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm ${getTypeStyle(activity.type)}`}>
                    <Icon />
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-lg p-3.5 shadow-sm hover:shadow transition-shadow group-hover:border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-800">
                        <span className="font-bold capitalize">{typeLabel}</span>
                        <span className="text-gray-500"> by {activity.user_name || 'System'}</span>
                        <span className="text-gray-400 text-xs ml-1 font-medium">· {timeAgo}</span>
                      </div>
                      
                      {activity.outcome && (
                        <span className="shrink-0 ml-2 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-gray-200">
                          {activity.outcome.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    
                    {activity.notes && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{activity.notes}</p>
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
