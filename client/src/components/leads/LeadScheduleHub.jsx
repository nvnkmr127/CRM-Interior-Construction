/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Badge, Button } from '../ui';
import { useToast } from '../../store/toastContext';

export default function LeadScheduleHub({ leadId, onNavigateTab }) {
  const toast = useToast();
  const [followups, setFollowups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('followups'); // 'followups', 'tasks', 'visits'

  const fetchData = async () => {
    if (!leadId) return;
    try {
      const [fRes, tRes, vRes] = await Promise.all([
        api.get(`/leads/${leadId}/followups`).catch(() => ({ data: { data: [] } })),
        api.get('/tasks', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } })),
        api.get(`/site-visits/lead/${leadId}`).catch(() => ({ data: { data: [] } }))
      ]);

      setFollowups(fRes.data?.data || fRes.data || []);
      
      const allTasks = tRes.data?.data || tRes.data || [];
      setTasks(allTasks.filter(t => t.lead_id === leadId));

      setSiteVisits(vRes.data?.data || vRes.data || []);
    } catch (err) {
      console.error('Failed to fetch schedule hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const toggleFollowup = async (f, e) => {
    if (e) e.stopPropagation();
    try {
      const updatedIsDone = !f.is_done;
      const res = await api.patch(`/leads/${leadId}/followups/${f.id}`, { is_done: updatedIsDone });
      if (res.data?.success || res.status === 200) {
        setFollowups(prev => prev.map(item => item.id === f.id ? { ...item, is_done: updatedIsDone } : item));
        toast.success(updatedIsDone ? 'Follow-up marked completed' : 'Follow-up marked pending');
      }
    } catch (err) {
      toast.error('Failed to update follow-up');
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const now = new Date();
  const pendingFollowups = followups.filter(f => !f.is_done);
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const pendingVisits = siteVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled');

  return (
    <div 
      className="p-6 rounded-2xl shadow-sm border transition-all" 
      style={{ 
        background: 'var(--color-surface, #ffffff)', 
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <span className="text-base">📅</span>
          Schedule & Activity Hub
        </h4>
        <div className="flex gap-1">
          <button
            onClick={() => onNavigateTab && onNavigateTab('followups')}
            className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-0.5 hover:underline"
          >
            Manage &rarr;
          </button>
        </div>
      </div>

      {/* 3 Metric Pills */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setActiveSubTab('followups')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeSubTab === 'followups'
              ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
              : 'bg-white border-gray-100 hover:border-amber-150'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span>⏰ Follow-ups</span>
            <span className="text-xs font-black bg-amber-100 px-1.5 py-0.2 rounded text-amber-900">{pendingFollowups.length}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {followups.length} total
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeSubTab === 'tasks'
              ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
              : 'bg-white border-gray-100 hover:border-blue-150'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center justify-between">
            <span>📋 Tasks</span>
            <span className="text-xs font-black bg-blue-100 px-1.5 py-0.2 rounded text-blue-900">{pendingTasks.length}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {tasks.length} total
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('visits')}
          className={`p-2.5 rounded-xl border text-left transition-all ${
            activeSubTab === 'visits'
              ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
              : 'bg-white border-gray-100 hover:border-purple-150'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800 flex items-center justify-between">
            <span>📍 Visits</span>
            <span className="text-xs font-black bg-purple-100 px-1.5 py-0.2 rounded text-purple-900">{pendingVisits.length}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {siteVisits.length} total
          </div>
        </button>
      </div>

      {/* Subtab Content List */}
      <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar">
        {/* 1. FOLLOW-UPS */}
        {activeSubTab === 'followups' && (
          followups.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              No follow-ups recorded. <button onClick={() => onNavigateTab && onNavigateTab('followups')} className="text-amber-700 underline font-semibold ml-1">Schedule now</button>
            </div>
          ) : (
            followups.slice(0, 4).map(f => {
              const isOverdue = !f.is_done && new Date(f.due_at) < now;
              return (
                <div
                  key={f.id}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-all ${
                    f.is_done ? 'bg-gray-50 text-gray-400' : isOverdue ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-100 shadow-2xs'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!f.is_done}
                    onChange={(e) => toggleFollowup(f, e)}
                    className="w-3.5 h-3.5 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-semibold truncate ${f.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {f.title}
                      </span>
                      {isOverdue && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-bold uppercase">Overdue</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      📅 {formatDateTime(f.due_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {/* 2. TASKS */}
        {activeSubTab === 'tasks' && (
          tasks.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              No tasks assigned. <button onClick={() => onNavigateTab && onNavigateTab('tasks')} className="text-blue-700 underline font-semibold ml-1">Add task</button>
            </div>
          ) : (
            tasks.slice(0, 4).map(t => (
              <div
                key={t.id}
                className="p-2.5 rounded-xl border border-gray-100 bg-white shadow-2xs flex items-start justify-between gap-2 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900 truncate">{t.title}</span>
                    <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase ${
                      t.priority === 'urgent' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {t.priority || 'Normal'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    📅 Due: {formatDateTime(t.due_date || t.dueDate)}
                  </div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                }`}>
                  {t.status || 'To Do'}
                </span>
              </div>
            ))
          )
        )}

        {/* 3. SITE VISITS */}
        {activeSubTab === 'visits' && (
          siteVisits.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              No site visits scheduled. <button onClick={() => onNavigateTab && onNavigateTab('site-visits')} className="text-purple-700 underline font-semibold ml-1">Schedule visit</button>
            </div>
          ) : (
            siteVisits.slice(0, 4).map(v => (
              <div
                key={v.id}
                className="p-2.5 rounded-xl border border-purple-100 bg-white shadow-2xs flex items-start justify-between gap-2 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-purple-950 truncate">Site Inspection</span>
                    <span className="text-[8px] px-1 py-0.2 rounded font-bold uppercase bg-purple-50 text-purple-700">
                      {v.status || 'Scheduled'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    📅 {formatDateTime(v.scheduled_at)}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Footer Navigation Button */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
        <span className="text-gray-400 text-[11px]">
          {activeSubTab === 'followups' ? `${followups.length} follow-ups` : activeSubTab === 'tasks' ? `${tasks.length} tasks` : `${siteVisits.length} site visits`}
        </span>
        <button
          onClick={() => onNavigateTab && onNavigateTab(activeSubTab === 'followups' ? 'followups' : activeSubTab === 'tasks' ? 'tasks' : 'site-visits')}
          className="font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          Open {activeSubTab === 'followups' ? 'Follow-ups' : activeSubTab === 'tasks' ? 'Tasks' : 'Site Visits'} Tab &rarr;
        </button>
      </div>
    </div>
  );
}
