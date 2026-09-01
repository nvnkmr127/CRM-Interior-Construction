/* eslint-disable no-unused-vars, react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import { Button, Badge } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { createGlobalTask, updateGlobalTask, deleteGlobalTask } from '../../api/tasks';

export default function LeadCalendar({ leads = [], onLeadClick }) {
  const toast = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loadingAdditions, setLoadingAdditions] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('followups'); // 'followups', 'tasks', or 'visits'
  
  // Interactive Lead & Day Modals
  const [selectedLeadForModal, setSelectedLeadForModal] = useState(null);
  const [leadModalTab, setLeadModalTab] = useState('all'); // 'all', 'followups', 'tasks', 'visits'
  const [selectedDayForModal, setSelectedDayForModal] = useState(null);

  // Per-Lead Live Fetched Items & Loading State
  const [loadingLeadItems, setLoadingLeadItems] = useState(false);
  const [leadSpecificFollowups, setLeadSpecificFollowups] = useState([]);
  const [leadSpecificTasks, setLeadSpecificTasks] = useState([]);
  const [leadSpecificVisits, setLeadSpecificVisits] = useState([]);
  
  // Inline Creation Form Type: null | 'followup' | 'task' | 'visit'
  const [activeFormType, setActiveFormType] = useState(null);
  const [submittingItem, setSubmittingItem] = useState(false);

  // Form States
  const [newFollowupForm, setNewFollowupForm] = useState({ title: '', due_at: '', notes: '' });
  const [newTaskForm, setNewTaskForm] = useState({ title: '', due_date: '', priority: 'medium', description: '' });
  const [newVisitForm, setNewVisitForm] = useState({ scheduled_at: '', notes: '' });

  // Initial Calendar bulk fetch
  const fetchAdditions = async () => {
    setLoadingAdditions(true);
    try {
      const [tasksRes, visitsRes, followupsRes] = await Promise.all([
        api.get('/tasks', { params: { limit: 200 } }).catch(() => ({ data: [] })),
        api.get('/site-visits').catch(() => ({ data: [] })),
        api.get('/leads/followups/all').catch(() => ({ data: [] }))
      ]);
      setTasks(tasksRes.data?.data || tasksRes.data || []);
      setSiteVisits(visitsRes.data?.data || visitsRes.data || []);
      setFollowups(followupsRes.data?.data || followupsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar additions:', err);
    } finally {
      setLoadingAdditions(false);
    }
  };

  useEffect(() => {
    fetchAdditions();
  }, []);

  // Fetch live items when a specific lead is opened in modal
  const fetchLeadLiveItems = async (leadId) => {
    if (!leadId) return;
    setLoadingLeadItems(true);
    try {
      const [fRes, tRes, vRes] = await Promise.all([
        api.get(`/leads/${leadId}/followups`).catch(() => ({ data: { data: [] } })),
        api.get('/tasks', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } })),
        api.get(`/site-visits/lead/${leadId}`).catch(() => ({ data: { data: [] } }))
      ]);

      const leadFollows = fRes.data?.data || fRes.data || [];
      const allTasks = tRes.data?.data || tRes.data || [];
      const leadTasksFiltered = allTasks.filter(t => t.lead_id === leadId || t.leadId === leadId);
      const leadVisitsFiltered = vRes.data?.data || vRes.data || [];

      setLeadSpecificFollowups(leadFollows);
      setLeadSpecificTasks(leadTasksFiltered);
      setLeadSpecificVisits(leadVisitsFiltered);
    } catch (err) {
      console.error('Failed to fetch lead specific schedule items:', err);
    } finally {
      setLoadingLeadItems(false);
    }
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleMonthChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setCurrentDate(prev => new Date(prev.getFullYear(), val, 1));
  };

  const handleYearChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setCurrentDate(prev => new Date(val, prev.getMonth(), 1));
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let y = current - 5; y <= current + 5; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const selectStyle = {
    height: '36px',
    padding: '0 12px',
    border: '1px solid var(--color-accent, #E8935A)',
    borderRadius: 'var(--radius-md, 8px)',
    fontSize: '13px',
    background: 'var(--color-surface)',
    color: 'var(--color-accent, #E8935A)',
    cursor: 'pointer',
    outline: 'none',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  };

  const calendarDays = useMemo(() => {
    const days = [];
    
    // Previous month padding
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevDaysInMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(prevMonthYear, prevMonth, prevDaysInMonth - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(currentYear, currentMonth, i),
        isCurrentMonth: true
      });
    }

    // Next month padding to fill rows of 7
    const totalCells = Math.ceil(days.length / 7) * 7;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    let nextDay = 1;
    while (days.length < totalCells) {
      days.push({
        date: new Date(nextMonthYear, nextMonth, nextDay++),
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentMonth, currentYear, daysInMonth, firstDayOfMonth]);

  const leadsByDate = useMemo(() => {
    const map = {};
    (Array.isArray(leads) ? leads : []).forEach(lead => {
      const dateStr = lead.last_activity_at || lead.created_at || lead.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    });
    return map;
  }, [leads]);

  const followupsByDate = useMemo(() => {
    const map = {};
    (Array.isArray(followups) ? followups : []).forEach(f => {
      const dateStr = f.due_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [followups]);

  const tasksByDate = useMemo(() => {
    const map = {};
    (Array.isArray(tasks) ? tasks : []).forEach(task => {
      const dateStr = task.due_date || task.dueDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    return map;
  }, [tasks]);

  const siteVisitsByDate = useMemo(() => {
    const map = {};
    (Array.isArray(siteVisits) ? siteVisits : []).forEach(visit => {
      const dateStr = visit.scheduled_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(visit);
    });
    return map;
  }, [siteVisits]);

  // Color helper based on score or stage
  const getLeadPillStyle = (lead) => {
    const score = lead.score;
    if (score !== undefined && score !== null) {
      if (score >= 70) {
        return {
          background: 'rgba(16, 185, 129, 0.12)',
          color: 'rgb(5, 150, 105)',
          border: '1px solid rgba(16, 185, 129, 0.28)'
        };
      } else if (score >= 30) {
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          color: 'rgb(217, 119, 6)',
          border: '1px solid rgba(245, 158, 11, 0.28)'
        };
      }
    }
    return {
      background: 'rgba(107, 114, 128, 0.1)',
      color: 'var(--color-text-secondary)',
      border: '1px solid rgba(107, 114, 128, 0.2)'
    };
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

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Open Lead modal from lead ID or lead object
  const openLeadScheduleModal = (leadOrId) => {
    if (!leadOrId) return;
    let foundLead = typeof leadOrId === 'object' ? leadOrId : leads.find(l => l.id === leadOrId);
    if (!foundLead) {
      const matchingFollowup = followups.find(f => f.lead_id === leadOrId);
      const matchingTask = tasks.find(t => t.lead_id === leadOrId || t.leadId === leadOrId);
      const matchingVisit = siteVisits.find(v => v.lead_id === leadOrId);
      const name = matchingFollowup?.lead_name || matchingTask?.lead_name || matchingVisit?.lead_name || 'Lead Details';
      foundLead = { id: leadOrId, name };
    }
    setSelectedLeadForModal(foundLead);
    setActiveFormType(null);
    setLeadModalTab('all');
    fetchLeadLiveItems(foundLead.id);
  };

  // Toggle followup status
  const handleToggleFollowup = async (f, e) => {
    if (e) e.stopPropagation();
    try {
      const updatedIsDone = !f.is_done;
      const res = await api.patch(`/leads/${f.lead_id}/followups/${f.id}`, { is_done: updatedIsDone });
      if (res.data?.success || res.status === 200) {
        const updatedObj = { ...f, is_done: updatedIsDone, done_at: updatedIsDone ? new Date().toISOString() : null };
        setFollowups(prev => prev.map(item => item.id === f.id ? updatedObj : item));
        setLeadSpecificFollowups(prev => prev.map(item => item.id === f.id ? updatedObj : item));
        toast.success(updatedIsDone ? 'Follow-up marked completed' : 'Follow-up marked pending');
      }
    } catch (err) {
      console.error('Failed to toggle followup:', err);
      toast.error('Failed to update follow-up status');
    }
  };

  // Delete followup
  const handleDeleteFollowup = async (followupId, e) => {
    if (e) e.stopPropagation();
    if (!selectedLeadForModal?.id) return;
    try {
      await api.delete(`/leads/${selectedLeadForModal.id}/followups/${followupId}`);
      setFollowups(prev => prev.filter(f => f.id !== followupId));
      setLeadSpecificFollowups(prev => prev.filter(f => f.id !== followupId));
      toast.success('Follow-up deleted');
    } catch (err) {
      toast.error('Failed to delete follow-up');
    }
  };

  // Toggle Task Status
  const handleToggleTaskStatus = async (task, e) => {
    if (e) e.stopPropagation();
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await updateGlobalTask(task.id, { status: newStatus });
      const updated = { ...task, status: newStatus };
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      setLeadSpecificTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      toast.success(`Task status marked as ${newStatus === 'done' ? 'Completed' : 'To Do'}`);
    } catch (err) {
      toast.error('Failed to update task status');
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteGlobalTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setLeadSpecificTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  // Delete Site Visit
  const handleDeleteSiteVisit = async (visitId, e) => {
    if (e) e.stopPropagation();
    try {
      await api.delete(`/site-visits/${visitId}`);
      setSiteVisits(prev => prev.filter(v => v.id !== visitId));
      setLeadSpecificVisits(prev => prev.filter(v => v.id !== visitId));
      toast.success('Site visit removed');
    } catch (err) {
      toast.error('Failed to remove site visit');
    }
  };

  // Quick Add Follow-up Submit
  const handleQuickAddFollowup = async (e) => {
    e.preventDefault();
    if (!newFollowupForm.title || !newFollowupForm.due_at || !selectedLeadForModal?.id) {
      toast.error('Title and scheduled date/time are required');
      return;
    }
    setSubmittingItem(true);
    try {
      const res = await api.post(`/leads/${selectedLeadForModal.id}/followups`, newFollowupForm);
      if (res.data?.success || res.status === 200 || res.status === 201) {
        const created = res.data?.data || res.data;
        const newObj = {
          ...created,
          lead_name: selectedLeadForModal.name,
          stage_name: selectedLeadForModal.stage_name,
          stage_color: selectedLeadForModal.stage_color
        };
        setFollowups(prev => [newObj, ...prev]);
        setLeadSpecificFollowups(prev => [newObj, ...prev]);
        setNewFollowupForm({ title: '', due_at: '', notes: '' });
        setActiveFormType(null);
        toast.success('Follow-up scheduled successfully');
      }
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      toast.error('Failed to schedule follow-up');
    } finally {
      setSubmittingItem(false);
    }
  };

  // Quick Add Task Submit
  const handleQuickAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.title || !selectedLeadForModal?.id) {
      toast.error('Task title is required');
      return;
    }
    setSubmittingItem(true);
    try {
      const res = await createGlobalTask({
        leadId: selectedLeadForModal.id,
        title: newTaskForm.title,
        dueDate: newTaskForm.due_date || null,
        priority: newTaskForm.priority || 'medium',
        description: newTaskForm.description || null,
        status: 'todo'
      });
      const created = res.data?.data || res.data;
      const newObj = {
        ...created,
        lead_id: selectedLeadForModal.id,
        lead_name: selectedLeadForModal.name
      };
      setTasks(prev => [newObj, ...prev]);
      setLeadSpecificTasks(prev => [newObj, ...prev]);
      setNewTaskForm({ title: '', due_date: '', priority: 'medium', description: '' });
      setActiveFormType(null);
      toast.success('Task created successfully');
    } catch (err) {
      console.error('Failed to create task:', err);
      toast.error('Failed to create task');
    } finally {
      setSubmittingItem(false);
    }
  };

  // Quick Add Site Visit Submit
  const handleQuickAddVisit = async (e) => {
    e.preventDefault();
    if (!newVisitForm.scheduled_at || !selectedLeadForModal?.id) {
      toast.error('Scheduled date and time are required');
      return;
    }
    setSubmittingItem(true);
    try {
      const res = await api.post(`/site-visits/lead/${selectedLeadForModal.id}`, {
        scheduled_at: newVisitForm.scheduled_at,
        notes: newVisitForm.notes || null,
        status: 'scheduled'
      });
      const created = res.data?.data || res.data;
      const newObj = {
        ...created,
        lead_id: selectedLeadForModal.id,
        lead_name: selectedLeadForModal.name
      };
      setSiteVisits(prev => [newObj, ...prev]);
      setLeadSpecificVisits(prev => [newObj, ...prev]);
      setNewVisitForm({ scheduled_at: '', notes: '' });
      setActiveFormType(null);
      toast.success('Site visit scheduled successfully');
    } catch (err) {
      console.error('Failed to schedule site visit:', err);
      toast.error('Failed to schedule site visit');
    } finally {
      setSubmittingItem(false);
    }
  };

  const pendingFollowups = useMemo(() => followups.filter(f => !f.is_done), [followups]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const pendingVisits = useMemo(() => siteVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled'), [siteVisits]);

  const now = new Date();

  // Lead Modal stats calculation
  const modalPendingFollowups = leadSpecificFollowups.filter(f => !f.is_done);
  const modalOverdueFollowups = leadSpecificFollowups.filter(f => !f.is_done && new Date(f.due_at) < now);
  const modalPendingTasks = leadSpecificTasks.filter(t => t.status !== 'done');
  const modalPendingVisits = leadSpecificVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled');

  return (
    <div 
      className="rounded-xl p-6 relative" 
      style={{ 
        background: 'var(--color-surface)',
        backdropFilter: 'blur(16px)', 
        WebkitBackdropFilter: 'blur(16px)', 
        border: '1px solid var(--color-border)', 
        boxShadow: 'var(--shadow-md)' 
      }}
    >
      {/* Calendar Top Bar */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
          </h2>
          <span 
            className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider" 
            style={{ 
              background: 'var(--color-surface-2)', 
              color: 'var(--color-accent, #E8935A)',
              border: '1px solid var(--color-border)'
            }}
          >
            {leads.length} Active Leads
          </span>
          <span 
            className="text-xs px-2.5 py-1 rounded-full font-semibold" 
            style={{ 
              background: 'rgba(232, 147, 90, 0.1)', 
              color: 'var(--color-accent, #E8935A)',
              border: '1px solid rgba(232, 147, 90, 0.25)'
            }}
          >
            ⏰ {pendingFollowups.length} Follow-ups
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={currentMonth} 
            onChange={handleMonthChange} 
            style={selectStyle}
          >
            {months.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <select 
            value={currentYear} 
            onChange={handleYearChange} 
            style={selectStyle}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', margin: '0 4px' }} />

          <Button variant="outline" onClick={handlePrevMonth} style={{ padding: '6px 12px', fontSize: '13px' }}>
            &larr; Prev
          </Button>
          <Button variant="outline" onClick={handleToday} style={{ padding: '6px 12px', fontSize: '13px' }}>
            Today
          </Button>
          <Button variant="outline" onClick={handleNextMonth} style={{ padding: '6px 12px', fontSize: '13px' }}>
            Next &rarr;
          </Button>
        </div>
      </div>

      {/* Main Grid: Calendar (3 cols) + Sidebar (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid Block */}
        <div className="lg:col-span-3">
          <div 
            className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" 
            style={{ 
              background: 'var(--color-border)', 
              border: '1px solid var(--color-border)' 
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div 
                key={day} 
                className="py-3 text-center text-xs font-bold uppercase tracking-wider" 
                style={{ 
                  background: 'var(--color-surface-2)', 
                  color: 'var(--color-text-secondary)' 
                }}
              >
                {day}
              </div>
            ))}
            {calendarDays.map(({ date, isCurrentMonth }, idx) => {
              const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const dayLeads = leadsByDate[dateKey] || [];
              const dayFollowups = followupsByDate[dateKey] || [];
              const dayVisits = siteVisitsByDate[dateKey] || [];
              const dayTasks = tasksByDate[dateKey] || [];
              const isToday = new Date().toDateString() === date.toDateString();

              const totalItems = dayLeads.length + dayFollowups.length + dayVisits.length + dayTasks.length;
              let renderedCount = 0;

              return (
                <div 
                  key={`${dateKey}-${idx}`} 
                  className="p-2.5 min-h-[125px] transition-all duration-200 flex flex-col group relative" 
                  style={{ 
                    background: isToday 
                      ? 'rgba(232, 147, 90, 0.06)' 
                      : isCurrentMonth 
                        ? 'var(--color-surface)' 
                        : 'var(--color-surface-2, #f9fafb)',
                    opacity: isCurrentMonth ? 1 : 0.75,
                    borderBottom: '1px solid var(--color-border)',
                    borderRight: '1px solid var(--color-border)'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div 
                      className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full" 
                      style={
                        isToday 
                          ? { 
                              background: 'var(--color-accent, #E8935A)', 
                              color: '#fff', 
                              boxShadow: '0 2px 8px rgba(232, 147, 90, 0.4)',
                              fontWeight: '700'
                            } 
                          : { 
                              color: isCurrentMonth ? 'var(--color-text)' : 'var(--color-text-secondary)' 
                            }
                      }
                    >
                      {date.getDate()}
                    </div>
                    {totalItems > 0 && (
                      <button
                        onClick={() => setSelectedDayForModal({ dateKey, date, dayLeads, dayFollowups, dayVisits, dayTasks })}
                        className="text-[10px] font-bold text-gray-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="View day schedule"
                      >
                        {totalItems} items
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-1 justify-start overflow-hidden">
                    {/* 1. Render Leads */}
                    {dayLeads.slice(0, 1).map(lead => {
                      const pillStyle = getLeadPillStyle(lead);
                      renderedCount++;
                      return (
                        <div 
                          key={`lead-${lead.id}`}
                          onClick={() => openLeadScheduleModal(lead)}
                          className="text-[11px] px-2 py-0.5 rounded-md cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-xs flex items-center gap-1.5"
                          style={pillStyle}
                          title={`Lead: ${lead.name} (${lead.stage_name || 'No Stage'}) - Click to view activities`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lead.stage_color || 'var(--color-text-secondary)' }} />
                          <span className="font-semibold truncate">{lead.name}</span>
                        </div>
                      );
                    })}

                    {/* 2. Render Follow-ups */}
                    {dayFollowups.slice(0, 1).map(f => {
                      renderedCount++;
                      const isOverdue = !f.is_done && new Date(f.due_at) < now;
                      return (
                        <div 
                          key={`fup-${f.id}`}
                          onClick={() => openLeadScheduleModal(f.lead_id)}
                          className={`text-[10px] px-2 py-0.5 rounded-md cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-xs flex items-center gap-1.5 ${
                            f.is_done
                              ? 'bg-gray-100 text-gray-400 line-through border border-gray-200'
                              : isOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200 font-semibold'
                                : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                          title={`Follow-up: ${f.title} ${f.lead_name ? `(${f.lead_name})` : ''} - Click to view lead`}
                        >
                          <span className="shrink-0 text-[10px]">⏰</span>
                          <span className="font-medium truncate">{f.title}</span>
                          {f.due_at && <span className="text-[9px] text-amber-700/70 shrink-0 ml-auto">{formatTimeOnly(f.due_at)}</span>}
                        </div>
                      );
                    })}

                    {/* 3. Render Site Visits */}
                    {dayVisits.slice(0, 1).map(visit => {
                      renderedCount++;
                      return (
                        <div 
                          key={`visit-${visit.id}`}
                          onClick={() => visit.lead_id && openLeadScheduleModal(visit.lead_id)}
                          className="text-[10px] px-2 py-0.5 rounded-md cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-xs flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200"
                          title={`Site Visit: ${visit.lead_name || 'Scheduled visit'} - Click to view lead`}
                        >
                          <span className="shrink-0">📍</span>
                          <span className="font-medium truncate">{visit.lead_name || 'Site Visit'}</span>
                        </div>
                      );
                    })}

                    {/* 4. Render Tasks */}
                    {dayTasks.slice(0, 1).map(task => {
                      renderedCount++;
                      return (
                        <div 
                          key={`task-${task.id}`}
                          onClick={() => (task.lead_id || task.leadId) && openLeadScheduleModal(task.lead_id || task.leadId)}
                          className="text-[10px] px-2 py-0.5 rounded-md cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-xs flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200"
                          title={`Task: ${task.title}`}
                        >
                          <span className="shrink-0">📋</span>
                          <span className="font-medium truncate">{task.title}</span>
                        </div>
                      );
                    })}

                    {/* Overflow More Items Indicator */}
                    {totalItems > renderedCount && (
                      <div 
                        onClick={() => setSelectedDayForModal({ dateKey, date, dayLeads, dayFollowups, dayVisits, dayTasks })}
                        className="text-[9px] font-bold px-1 text-orange-600 hover:text-orange-700 hover:underline cursor-pointer flex items-center gap-0.5 mt-0.5"
                      >
                        +{totalItems - renderedCount} more items &rarr;
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Tab Panels */}
        <div 
          className="lg:col-span-1 rounded-xl p-4 flex flex-col h-full"
          style={{ 
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {/* Sidebar 3-way tab header */}
          <div className="flex border-b pb-2 mb-4 gap-1" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setSidebarTab('followups')}
              className={`flex-1 text-center py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                sidebarTab === 'followups'
                  ? 'bg-amber-50 text-amber-900 shadow-xs border border-amber-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Scheduled follow-ups"
            >
              ⏰ Follow-ups ({pendingFollowups.length})
            </button>
            <button
              onClick={() => setSidebarTab('tasks')}
              className={`flex-1 text-center py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                sidebarTab === 'tasks'
                  ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Assigned tasks"
            >
              📋 Tasks ({pendingTasks.length})
            </button>
            <button
              onClick={() => setSidebarTab('visits')}
              className={`flex-1 text-center py-2 px-1 text-xs font-bold rounded-lg transition-all ${
                sidebarTab === 'visits'
                  ? 'bg-purple-50 text-purple-700 shadow-xs border border-purple-200'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Site Visits"
            >
              📍 Visits ({pendingVisits.length})
            </button>
          </div>

          {/* Tab Content List */}
          <div className="flex-1 overflow-y-auto max-h-[580px] custom-scrollbar space-y-3">
            {/* 1. FOLLOWUPS TAB */}
            {sidebarTab === 'followups' && (
              pendingFollowups.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 italic">No upcoming follow-ups</div>
              ) : (
                pendingFollowups.map(f => {
                  const isOverdue = new Date(f.due_at) < now;
                  return (
                    <div
                      key={f.id}
                      onClick={() => openLeadScheduleModal(f.lead_id)}
                      className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 relative group hover:shadow-md ${
                        isOverdue ? 'bg-red-50/20 border-red-200' : 'bg-white border-gray-100 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <input 
                            type="checkbox"
                            checked={!!f.is_done}
                            onChange={(e) => handleToggleFollowup(f, e)}
                            className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                            title="Mark as completed"
                          />
                          <span className={`font-semibold text-xs text-gray-900 line-clamp-2 ${f.is_done ? 'line-through text-gray-400' : ''}`}>
                            {f.title}
                          </span>
                        </div>
                        {isOverdue && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-100 text-red-700 border border-red-200 shrink-0">
                            Overdue
                          </span>
                        )}
                      </div>

                      {f.lead_name && (
                        <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium pl-6">
                          <span>👤</span>
                          <span className="text-orange-700 font-semibold truncate hover:underline">{f.lead_name}</span>
                          {f.stage_name && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-500 font-normal">
                              {f.stage_name}
                            </span>
                          )}
                        </div>
                      )}

                      {f.notes && (
                        <p className="text-[10px] text-gray-500 italic line-clamp-1 pl-6">
                          "{f.notes}"
                        </p>
                      )}

                      <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1 pl-6 pt-1 border-t border-gray-50">
                        <span>📅 {formatDateTime(f.due_at)}</span>
                        {f.assignee_name && <span className="truncate max-w-[90px]">👤 {f.assignee_name}</span>}
                      </div>
                    </div>
                  );
                })
              )
            )}

            {/* 2. TASKS TAB */}
            {sidebarTab === 'tasks' && (
              pendingTasks.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 italic">No upcoming tasks</div>
              ) : (
                pendingTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => (task.lead_id || task.leadId) && openLeadScheduleModal(task.lead_id || task.leadId)}
                    className="p-3 rounded-xl border border-gray-100 bg-white shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-gray-900 line-clamp-2">{task.title}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        task.priority === 'urgent' ? 'bg-red-50 text-red-700 border border-red-100' :
                        task.priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                        'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {task.priority || 'Normal'}
                      </span>
                    </div>
                    {task.lead_name && (
                      <div className="text-[11px] text-gray-600 flex items-center gap-1 font-medium">
                        <span>👤</span> <span className="text-blue-700 font-semibold truncate hover:underline">{task.lead_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1 pt-1 border-t border-gray-50">
                      <span>📅 {formatDateTime(task.due_date || task.dueDate)}</span>
                      {task.assignee_name && <span className="truncate max-w-[90px]">👤 {task.assignee_name}</span>}
                    </div>
                  </div>
                ))
              )
            )}

            {/* 3. VISITS TAB */}
            {sidebarTab === 'visits' && (
              pendingVisits.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 italic">No upcoming site visits</div>
              ) : (
                pendingVisits.map(visit => (
                  <div
                    key={visit.id}
                    onClick={() => visit.lead_id && openLeadScheduleModal(visit.lead_id)}
                    className="p-3 rounded-xl border border-gray-100 bg-white shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-purple-900 truncate">{visit.lead_name || 'Site Visit'}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-purple-50 text-purple-700 border border-purple-100">
                        {visit.status || 'scheduled'}
                      </span>
                    </div>
                    {visit.notes && <p className="text-[10px] text-gray-500 line-clamp-1 italic">"{visit.notes}"</p>}
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1 pt-1 border-t border-gray-50">
                      <span>📅 {formatDateTime(visit.scheduled_at)}</span>
                      {visit.assignee_name && <span className="truncate max-w-[90px]">👤 {visit.assignee_name}</span>}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* ULTRA-ENHANCED LEAD SCHEDULE & ACTIVITIES MODAL */}
      {selectedLeadForModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedLeadForModal(null)}
        >
          <div 
            className="w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn"
            style={{ 
              background: 'var(--color-surface, #ffffff)', 
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 1. Rich Lead Header */}
            <div className="p-6 border-b flex flex-wrap items-start justify-between gap-4" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-start gap-3.5">
                {/* Initials Avatar */}
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-sm shrink-0 uppercase"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(232, 147, 90, 0.2), rgba(232, 147, 90, 0.4))',
                    color: 'var(--color-accent, #E8935A)',
                    border: '1px solid rgba(232, 147, 90, 0.3)'
                  }}
                >
                  {selectedLeadForModal.name ? selectedLeadForModal.name.charAt(0) : 'L'}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                      {selectedLeadForModal.name}
                    </h3>
                    
                    {selectedLeadForModal.stage_name && (
                      <span 
                        className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1" 
                        style={{ 
                          backgroundColor: selectedLeadForModal.stage_color ? `${selectedLeadForModal.stage_color}18` : '#f3f4f6',
                          color: selectedLeadForModal.stage_color || '#374151',
                          border: `1px solid ${selectedLeadForModal.stage_color || '#d1d5db'}`
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedLeadForModal.stage_color || '#6b7280' }} />
                        {selectedLeadForModal.stage_name}
                      </span>
                    )}

                    {selectedLeadForModal.score !== undefined && selectedLeadForModal.score !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                        selectedLeadForModal.score >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        selectedLeadForModal.score >= 30 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        ⭐ {selectedLeadForModal.score} pts
                      </span>
                    )}
                  </div>
                  
                  {/* Lead Contact Chips */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                    {selectedLeadForModal.phone && (
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                        <span>📞</span>
                        <a href={`tel:${selectedLeadForModal.phone}`} className="font-semibold text-gray-800 hover:text-orange-600 hover:underline">
                          {selectedLeadForModal.phone}
                        </a>
                        <a 
                          href={`https://wa.me/${selectedLeadForModal.phone.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold ml-1"
                          title="Open WhatsApp chat"
                        >
                          💬 WhatsApp
                        </a>
                      </div>
                    )}

                    {selectedLeadForModal.email && (
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                        <span>✉️</span>
                        <a href={`mailto:${selectedLeadForModal.email}`} className="font-medium text-gray-700 hover:underline">
                          {selectedLeadForModal.email}
                        </a>
                      </div>
                    )}

                    {selectedLeadForModal.property_type && (
                      <span className="flex items-center gap-1 font-medium bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                        🏢 {selectedLeadForModal.property_type}
                      </span>
                    )}

                    {selectedLeadForModal.budget_max && (
                      <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50/70 border border-emerald-200 px-2 py-0.5 rounded-md">
                        💰 ₹{Number(selectedLeadForModal.budget_max).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => {
                    const leadId = selectedLeadForModal.id;
                    setSelectedLeadForModal(null);
                    if (onLeadClick) onLeadClick(leadId);
                  }}
                  className="whitespace-nowrap font-bold shadow-xs hover:shadow-md"
                >
                  Open Full Lead Profile &rarr;
                </Button>
                <button 
                  onClick={() => setSelectedLeadForModal(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 2. Interactive KPI Metrics Header Cards */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50/60 border-b border-gray-100">
              {/* Followups Card */}
              <div 
                onClick={() => setLeadModalTab('followups')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  leadModalTab === 'followups' 
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-amber-200 hover:shadow-xs'
                }`}
              >
                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center justify-between">
                  <span>⏰ Follow-ups</span>
                  <span className="text-xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-black">{leadSpecificFollowups.length}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs font-semibold">
                  <span className="text-gray-600">{modalPendingFollowups.length} pending</span>
                  {modalOverdueFollowups.length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-extrabold uppercase animate-pulse">
                      {modalOverdueFollowups.length} Overdue
                    </span>
                  )}
                </div>
              </div>

              {/* Tasks Card */}
              <div 
                onClick={() => setLeadModalTab('tasks')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  leadModalTab === 'tasks' 
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-xs'
                }`}
              >
                <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wide flex items-center justify-between">
                  <span>📋 Tasks</span>
                  <span className="text-xs bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-black">{leadSpecificTasks.length}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs font-semibold">
                  <span className="text-gray-600">{modalPendingTasks.length} pending</span>
                  {leadSpecificTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold uppercase">
                      Urgent tasks
                    </span>
                  )}
                </div>
              </div>

              {/* Site Visits Card */}
              <div 
                onClick={() => setLeadModalTab('visits')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  leadModalTab === 'visits' 
                    ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-xs'
                }`}
              >
                <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wide flex items-center justify-between">
                  <span>📍 Site Visits</span>
                  <span className="text-xs bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-black">{leadSpecificVisits.length}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs font-semibold">
                  <span className="text-gray-600">{modalPendingVisits.length} scheduled</span>
                </div>
              </div>
            </div>

            {/* 3. Action Toolbar & Filter Tabs */}
            <div className="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 bg-white" style={{ borderColor: 'var(--color-border)' }}>
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLeadModalTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leadModalTab === 'all' ? 'bg-gray-900 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All Activities ({leadSpecificFollowups.length + leadSpecificTasks.length + leadSpecificVisits.length})
                </button>
                <button
                  onClick={() => setLeadModalTab('followups')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leadModalTab === 'followups' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  ⏰ Follow-ups ({leadSpecificFollowups.length})
                </button>
                <button
                  onClick={() => setLeadModalTab('tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leadModalTab === 'tasks' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  📋 Tasks ({leadSpecificTasks.length})
                </button>
                <button
                  onClick={() => setLeadModalTab('visits')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    leadModalTab === 'visits' ? 'bg-purple-600 text-white shadow-xs' : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  📍 Site Visits ({leadSpecificVisits.length})
                </button>
              </div>

              {/* Action Buttons Group */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveFormType(activeFormType === 'followup' ? null : 'followup')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                    activeFormType === 'followup'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span>+</span> ⏰ Follow-up
                </button>
                <button
                  onClick={() => setActiveFormType(activeFormType === 'task' ? null : 'task')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                    activeFormType === 'task'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <span>+</span> 📋 Task
                </button>
                <button
                  onClick={() => setActiveFormType(activeFormType === 'visit' ? null : 'visit')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                    activeFormType === 'visit'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <span>+</span> 📍 Site Visit
                </button>
              </div>
            </div>

            {/* 4. Modal Body: Tab Content & Forms */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {/* Form 1: Add Follow-up Form */}
              {activeFormType === 'followup' && (
                <form onSubmit={handleQuickAddFollowup} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span>⏰</span> Schedule New Follow-up
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setActiveFormType(null)}
                      className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Title / Action Item *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Call to discuss quote revision"
                        value={newFollowupForm.title}
                        onChange={e => setNewFollowupForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Scheduled Date & Time *</label>
                      <input 
                        type="datetime-local" 
                        required
                        value={newFollowupForm.due_at}
                        onChange={e => setNewFollowupForm(prev => ({ ...prev, due_at: e.target.value }))}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Notes / Key Agenda (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Details, client preferences to mention, or agenda..."
                      value={newFollowupForm.notes}
                      onChange={e => setNewFollowupForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveFormType(null)}>Cancel</Button>
                    <Button type="submit" variant="primary" size="sm" disabled={submittingItem}>
                      {submittingItem ? 'Saving...' : 'Save Follow-up'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Form 2: Add Task Form */}
              {activeFormType === 'task' && (
                <form onSubmit={handleQuickAddTask} className="p-4 rounded-2xl border border-blue-200 bg-blue-50/60 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <span>📋</span> Create New Task
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setActiveFormType(null)}
                      className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Task Title *</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Prepare initial 2D layout draft"
                        value={newTaskForm.title}
                        onChange={e => setNewTaskForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">Priority</label>
                      <select
                        value={newTaskForm.priority}
                        onChange={e => setNewTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                        <option value="urgent">Urgent Priority</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Due Date</label>
                    <input 
                      type="date" 
                      value={newTaskForm.due_date}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Description (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Task instructions and guidelines..."
                      value={newTaskForm.description}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveFormType(null)}>Cancel</Button>
                    <Button type="submit" variant="primary" size="sm" disabled={submittingItem}>
                      {submittingItem ? 'Saving...' : 'Create Task'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Form 3: Add Site Visit Form */}
              {activeFormType === 'visit' && (
                <form onSubmit={handleQuickAddVisit} className="p-4 rounded-2xl border border-purple-200 bg-purple-50/60 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <span>📍</span> Schedule Site Visit / Inspection
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setActiveFormType(null)}
                      className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Scheduled Date & Time *</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={newVisitForm.scheduled_at}
                      onChange={e => setNewVisitForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Location & Inspection Notes (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Site address, contact person, or measurement points..."
                      value={newVisitForm.notes}
                      onChange={e => setNewVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setActiveFormType(null)}>Cancel</Button>
                    <Button type="submit" variant="primary" size="sm" disabled={submittingItem}>
                      {submittingItem ? 'Saving...' : 'Book Visit'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Loading Indicator */}
              {loadingLeadItems && (
                <div className="text-center py-6 text-xs text-gray-400 animate-pulse flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Fetching live lead activities...
                </div>
              )}

              {/* SECTION 1: FOLLOW-UPS */}
              {(leadModalTab === 'all' || leadModalTab === 'followups') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span>⏰</span> Follow-ups ({leadSpecificFollowups.length})
                    </h4>
                    {leadSpecificFollowups.length > 0 && activeFormType !== 'followup' && (
                      <button 
                        onClick={() => setActiveFormType('followup')}
                        className="text-xs text-amber-700 hover:text-amber-900 font-bold hover:underline"
                      >
                        + New Follow-up
                      </button>
                    )}
                  </div>

                  {leadSpecificFollowups.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-amber-200 text-center bg-amber-50/30 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">⏰</div>
                      <div className="text-xs font-bold text-gray-800">No follow-ups recorded for this lead yet</div>
                      <p className="text-[11px] text-gray-500 max-w-xs">
                        Keep the deal moving by scheduling calls, revisions, or reminder follow-ups.
                      </p>
                      <button
                        onClick={() => setActiveFormType('followup')}
                        className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        + Schedule First Follow-up
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {leadSpecificFollowups.map(f => {
                        const isOverdue = !f.is_done && new Date(f.due_at) < now;
                        return (
                          <div 
                            key={f.id}
                            className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all ${
                              f.is_done 
                                ? 'bg-gray-50/70 border-gray-200' 
                                : isOverdue 
                                  ? 'bg-red-50/30 border-red-200 shadow-2xs' 
                                  : 'bg-white border-amber-100 shadow-xs'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              checked={!!f.is_done}
                              onChange={(e) => handleToggleFollowup(f, e)}
                              className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                              title="Toggle completion"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-bold ${f.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {f.title}
                                </span>
                                <div className="flex items-center gap-2">
                                  {f.is_done ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-green-100 text-green-800">
                                      Done
                                    </span>
                                  ) : isOverdue ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                                      Overdue
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-100 text-amber-800">
                                      Pending
                                    </span>
                                  )}

                                  <button
                                    onClick={(e) => handleDeleteFollowup(f.id, e)}
                                    className="text-gray-400 hover:text-red-600 text-xs transition-colors p-1"
                                    title="Delete follow-up"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>

                              {f.notes && (
                                <p className="text-xs text-gray-600 mt-1 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 italic">
                                  "{f.notes}"
                                </p>
                              )}

                              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                                <span>📅 Due: {formatDateTime(f.due_at)}</span>
                                {f.assignee_name && <span>👤 {f.assignee_name}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: TASKS */}
              {(leadModalTab === 'all' || leadModalTab === 'tasks') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <span>📋</span> Tasks ({leadSpecificTasks.length})
                    </h4>
                    {leadSpecificTasks.length > 0 && activeFormType !== 'task' && (
                      <button 
                        onClick={() => setActiveFormType('task')}
                        className="text-xs text-blue-700 hover:text-blue-900 font-bold hover:underline"
                      >
                        + New Task
                      </button>
                    )}
                  </div>

                  {leadSpecificTasks.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-blue-200 text-center bg-blue-50/30 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">📋</div>
                      <div className="text-xs font-bold text-gray-800">No tasks assigned for this lead yet</div>
                      <p className="text-[11px] text-gray-500 max-w-xs">
                        Assign deliverables, drawing drafts, or milestones to keep team execution on track.
                      </p>
                      <button
                        onClick={() => setActiveFormType('task')}
                        className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        + Create Task
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {leadSpecificTasks.map(t => (
                        <div 
                          key={t.id}
                          className="p-3.5 rounded-2xl border border-gray-200 bg-white shadow-xs flex items-start gap-3"
                        >
                          <input 
                            type="checkbox"
                            checked={t.status === 'done'}
                            onChange={(e) => handleToggleTaskStatus(t, e)}
                            className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            title="Toggle complete"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {t.title}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  t.priority === 'urgent' ? 'bg-red-50 text-red-700 border border-red-100' :
                                  t.priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                  'bg-blue-50 text-blue-700 border border-blue-100'
                                }`}>
                                  {t.priority || 'Normal'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  t.status === 'done' ? 'bg-green-100 text-green-800' :
                                  t.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {t.status || 'To Do'}
                                </span>
                                <button
                                  onClick={(e) => handleDeleteTask(t.id, e)}
                                  className="text-gray-400 hover:text-red-600 text-xs transition-colors p-1"
                                  title="Delete task"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {t.description && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                              <span>📅 Due: {formatDateTime(t.due_date || t.dueDate)}</span>
                              {t.assignee_name && <span>👤 {t.assignee_name}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: SITE VISITS */}
              {(leadModalTab === 'all' || leadModalTab === 'visits') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                      <span>📍</span> Site Visits ({leadSpecificVisits.length})
                    </h4>
                    {leadSpecificVisits.length > 0 && activeFormType !== 'visit' && (
                      <button 
                        onClick={() => setActiveFormType('visit')}
                        className="text-xs text-purple-700 hover:text-purple-900 font-bold hover:underline"
                      >
                        + Book Visit
                      </button>
                    )}
                  </div>

                  {leadSpecificVisits.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-purple-200 text-center bg-purple-50/30 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">📍</div>
                      <div className="text-xs font-bold text-gray-800">No site visits scheduled for this lead yet</div>
                      <p className="text-[11px] text-gray-500 max-w-xs">
                        Book a physical measurement or site inspection to evaluate project scope and structural layout.
                      </p>
                      <button
                        onClick={() => setActiveFormType('visit')}
                        className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        + Schedule Site Visit
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {leadSpecificVisits.map(v => (
                        <div 
                          key={v.id}
                          className="p-3.5 rounded-2xl border border-purple-100 bg-white shadow-xs flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-purple-950">Site Inspection / Measurement</span>
                                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                  {v.status || 'scheduled'}
                                </span>
                              </div>
                              <button
                                onClick={(e) => handleDeleteSiteVisit(v.id, e)}
                                className="text-gray-400 hover:text-red-600 text-xs transition-colors p-1"
                                title="Delete visit"
                              >
                                🗑️
                              </button>
                            </div>

                            {v.notes && (
                              <p className="text-xs text-gray-600 mt-1.5 bg-purple-50/40 p-2.5 rounded-xl italic border border-purple-100/50">
                                "{v.notes}"
                              </p>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                              <span>📅 Scheduled: {formatDateTime(v.scheduled_at)}</span>
                              {v.assignee_name && <span>👤 {v.assignee_name}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs text-gray-500 font-medium">
                Viewing schedule & activities for <strong>{selectedLeadForModal.name}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedLeadForModal(null)}
                >
                  Close
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => {
                    const leadId = selectedLeadForModal.id;
                    setSelectedLeadForModal(null);
                    if (onLeadClick) onLeadClick(leadId);
                  }}
                  className="font-bold"
                >
                  Open Full Lead Profile &rarr;
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAY SCHEDULE OVERVIEW MODAL */}
      {selectedDayForModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedDayForModal(null)}
        >
          <div 
            className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fadeIn"
            style={{ 
              background: 'var(--color-surface, #ffffff)', 
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  📅 Schedule for {selectedDayForModal.date?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  All leads, follow-ups, tasks, and site visits for this date.
                </p>
              </div>
              <button 
                onClick={() => setSelectedDayForModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              {/* Leads */}
              {selectedDayForModal.dayLeads?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Leads ({selectedDayForModal.dayLeads.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedDayForModal.dayLeads.map(l => (
                      <div
                        key={l.id}
                        onClick={() => {
                          setSelectedDayForModal(null);
                          openLeadScheduleModal(l);
                        }}
                        className="p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-xs cursor-pointer bg-white transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{l.name}</div>
                          <div className="text-[10px] text-gray-500">{l.stage_name || 'Active'} • {l.phone || 'No phone'}</div>
                        </div>
                        <span className="text-xs text-orange-600 font-bold">&rarr;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-ups */}
              {selectedDayForModal.dayFollowups?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">⏰ Follow-ups ({selectedDayForModal.dayFollowups.length})</h4>
                  <div className="space-y-2">
                    {selectedDayForModal.dayFollowups.map(f => (
                      <div
                        key={f.id}
                        onClick={() => {
                          setSelectedDayForModal(null);
                          openLeadScheduleModal(f.lead_id);
                        }}
                        className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-amber-950">{f.title}</div>
                          <div className="text-[10px] text-amber-800/80">👤 {f.lead_name || 'Lead'} • ⏰ {formatTimeOnly(f.due_at)}</div>
                        </div>
                        <span className="text-xs text-amber-700 font-bold">&rarr;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Site Visits */}
              {selectedDayForModal.dayVisits?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-800">📍 Site Visits ({selectedDayForModal.dayVisits.length})</h4>
                  <div className="space-y-2">
                    {selectedDayForModal.dayVisits.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedDayForModal(null);
                          if (v.lead_id) openLeadScheduleModal(v.lead_id);
                        }}
                        className="p-3 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-purple-950">{v.lead_name || 'Site Visit'}</div>
                          <div className="text-[10px] text-purple-800/80">📅 {formatTimeOnly(v.scheduled_at)} • Status: {v.status || 'Scheduled'}</div>
                        </div>
                        <span className="text-xs text-purple-700 font-bold">&rarr;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {selectedDayForModal.dayTasks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">📋 Tasks ({selectedDayForModal.dayTasks.length})</h4>
                  <div className="space-y-2">
                    {selectedDayForModal.dayTasks.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedDayForModal(null);
                          if (t.lead_id || t.leadId) openLeadScheduleModal(t.lead_id || t.leadId);
                        }}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-slate-950">{t.title}</div>
                          <div className="text-[10px] text-slate-600">👤 {t.lead_name || 'Lead'} • Due: {formatTimeOnly(t.due_date || t.dueDate)}</div>
                        </div>
                        <span className="text-xs text-slate-700 font-bold">&rarr;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedDayForModal(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
