/* eslint-disable no-unused-vars, react-hooks/preserve-manual-memoization */
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';

export default function LeadCalendar({ leads, onLeadClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [siteVisits, setSiteVisits] = useState([]);
  const [loadingAdditions, setLoadingAdditions] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('tasks'); // 'tasks' or 'visits'

  useEffect(() => {
    let active = true;
    const fetchAdditions = async () => {
      setLoadingAdditions(true);
      try {
        const [tasksRes, visitsRes] = await Promise.all([
          api.get('/tasks', { params: { limit: 200 } }),
          api.get('/site-visits')
        ]);
        if (active) {
          setTasks(tasksRes.data?.data || tasksRes.data || []);
          setSiteVisits(visitsRes.data?.data || visitsRes.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch calendar additions:', err);
      } finally {
        if (active) setLoadingAdditions(false);
      }
    };
    fetchAdditions();
    return () => { active = false; };
  }, []);
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
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'rgb(5, 150, 105)',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      } else if (score >= 30) {
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          color: 'rgb(217, 119, 6)',
          border: '1px solid rgba(245, 158, 11, 0.3)'
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

  return (
    <div 
      className="rounded-xl p-6" 
      style={{ 
        background: 'var(--color-surface)',
        backdropFilter: 'blur(16px)', 
        WebkitBackdropFilter: 'blur(16px)', 
        border: '1px solid var(--color-border)', 
        boxShadow: 'var(--shadow-md)' 
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
          </h2>
          <span 
            className="text-xs px-2 py-1 rounded font-bold uppercase tracking-wider" 
            style={{ 
              background: 'var(--color-surface-2)', 
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)'
            }}
          >
            {leads.length} Active Leads
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Block */}
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
                className="py-3 text-center text-sm font-semibold uppercase tracking-wider" 
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
              const dayTasks = tasksByDate[dateKey] || [];
              const dayVisits = siteVisitsByDate[dateKey] || [];
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <div 
                  key={`${dateKey}-${idx}`} 
                  className="p-3 min-h-[120px] transition-all duration-200 flex flex-col group relative" 
                  style={{ 
                    background: isToday 
                      ? 'rgba(170, 59, 255, 0.05)' 
                      : isCurrentMonth 
                        ? 'var(--color-surface)' 
                        : '#f3f4f6',
                    opacity: 1,
                    borderBottom: '1px solid var(--color-border)',
                    borderRight: '1px solid var(--color-border)'
                  }}
                >
                  <div 
                    className="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-3" 
                    style={
                      isToday 
                        ? { 
                            background: 'var(--color-accent, #E8935A)', 
                            color: '#fff', 
                            boxShadow: '0 4px 10px rgba(232, 147, 90, 0.3)',
                            fontWeight: '700'
                          } 
                        : { 
                            color: isCurrentMonth ? 'var(--color-text)' : '#4b5563' 
                          }
                    }
                  >
                    {date.getDate()}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 justify-start">
                    {/* Render Leads */}
                    {dayLeads.slice(0, 2).map(lead => {
                      const pillStyle = getLeadPillStyle(lead);
                      return (
                        <div 
                          key={lead.id}
                          onClick={() => onLeadClick(lead.id)}
                          className="text-[11px] px-2 py-1 rounded cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-sm flex items-center gap-1.5"
                          style={pillStyle}
                          title={`Lead: ${lead.name} (${lead.stage_name || 'No Stage'})`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lead.stage_color || 'var(--color-text-secondary)' }} />
                          <span className="font-medium truncate">{lead.name}</span>
                        </div>
                      );
                    })}

                    {/* Render Site Visits */}
                    {dayVisits.slice(0, 1).map(visit => (
                      <div 
                        key={visit.id}
                        onClick={() => visit.lead_id && onLeadClick(visit.lead_id)}
                        className="text-[10px] px-2 py-0.5 rounded cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-sm flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200"
                        title={`Site Visit: ${visit.lead_name || 'Scheduled visit'}`}
                      >
                        <span>📍</span>
                        <span className="font-medium truncate">{visit.lead_name || 'Site Visit'}</span>
                      </div>
                    ))}

                    {/* Render Tasks */}
                    {dayTasks.slice(0, 1).map(task => (
                      <div 
                        key={task.id}
                        onClick={() => task.lead_id && onLeadClick(task.lead_id)}
                        className="text-[10px] px-2 py-0.5 rounded cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-sm flex items-center gap-1 bg-slate-50 text-slate-700 border border-slate-200"
                        title={`Task: ${task.title}`}
                      >
                        <span>📋</span>
                        <span className="font-medium truncate">{task.title}</span>
                      </div>
                    ))}

                    {/* More items indicator */}
                    {(dayLeads.length > 2 || dayVisits.length > 1 || dayTasks.length > 1) && (
                      <div className="text-[9px] font-semibold pl-1 text-gray-400">
                        +{(dayLeads.length > 2 ? dayLeads.length - 2 : 0) + 
                          (dayVisits.length > 1 ? dayVisits.length - 1 : 0) + 
                          (dayTasks.length > 1 ? dayTasks.length - 1 : 0)} more items
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div 
          className="lg:col-span-1 rounded-xl p-4 flex flex-col h-full"
          style={{ 
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div className="flex border-b pb-2 mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => setSidebarTab('tasks')}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
                sidebarTab === 'tasks'
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              📋 Tasks ({tasks.filter(t => t.status !== 'done').length})
            </button>
            <button
              onClick={() => setSidebarTab('visits')}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all ${
                sidebarTab === 'visits'
                  ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-100'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              📍 Site Visits ({siteVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[550px] custom-scrollbar space-y-3">
            {sidebarTab === 'tasks' ? (
              tasks.filter(t => t.status !== 'done').length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 italic">No upcoming tasks</div>
              ) : (
                tasks.filter(t => t.status !== 'done').map(task => (
                  <div
                    key={task.id}
                    onClick={() => task.lead_id && onLeadClick(task.lead_id)}
                    className="p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow transition-all duration-150 cursor-pointer flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-gray-900 line-clamp-2">{task.title}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        task.priority === 'urgent' ? 'bg-red-50 text-red-755 border border-red-100' :
                        task.priority === 'high' ? 'bg-orange-50 text-orange-755 border border-orange-100' :
                        'bg-blue-50 text-blue-755 border border-blue-100'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    {task.lead_name && (
                      <div className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>👤</span> <span className="font-medium text-gray-700 truncate">{task.lead_name}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1">
                      <span>📅 {formatDateTime(task.due_date)}</span>
                      {task.assignee_name && <span className="truncate max-w-[80px]">👤 {task.assignee_name}</span>}
                    </div>
                  </div>
                ))
              )
            ) : (
              siteVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 italic">No upcoming site visits</div>
              ) : (
                siteVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').map(visit => (
                  <div
                    key={visit.id}
                    onClick={() => visit.lead_id && onLeadClick(visit.lead_id)}
                    className="p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow transition-all duration-150 cursor-pointer flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-purple-900 truncate">{visit.lead_name || 'Site Visit'}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-purple-50 text-purple-755 border border-purple-100">
                        {visit.status || 'scheduled'}
                      </span>
                    </div>
                    {visit.notes && <p className="text-[9px] text-gray-500 line-clamp-1 italic">"{visit.notes}"</p>}
                    <div className="flex justify-between items-center text-[9px] text-gray-400 mt-1">
                      <span>📅 {formatDateTime(visit.scheduled_at)}</span>
                      {visit.assignee_name && <span className="truncate max-w-[80px]">👤 {visit.assignee_name}</span>}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
