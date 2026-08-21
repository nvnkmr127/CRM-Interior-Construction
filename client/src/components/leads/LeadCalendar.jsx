/* eslint-disable no-unused-vars, react-hooks/preserve-manual-memoization */
import React, { useState, useMemo } from 'react';
import { Button } from '../ui';

export default function LeadCalendar({ leads, onLeadClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
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
                {dayLeads.slice(0, 3).map(lead => {
                  const pillStyle = getLeadPillStyle(lead);
                  return (
                    <div 
                      key={lead.id}
                      onClick={() => onLeadClick(lead.id)}
                      className="text-[11px] px-2 py-1 rounded cursor-pointer truncate transition-all duration-150 hover:translate-x-0.5 hover:shadow-sm flex items-center gap-1.5"
                      style={pillStyle}
                      title={`${lead.name} (${lead.stage_name || 'No Stage'}) - Score: ${lead.score || 'N/A'}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lead.stage_color || 'var(--color-text-secondary)' }} />
                      <span className="font-medium truncate">{lead.name}</span>
                    </div>
                  );
                })}
                {dayLeads.length > 3 && (
                  <div 
                    className="text-[10px] font-semibold pl-1 cursor-pointer hover:underline" 
                    style={{ color: 'var(--color-primary, #AA3BFF)' }}
                    onClick={() => {
                      if (dayLeads[3]) onLeadClick(dayLeads[3].id);
                    }}
                  >
                    +{dayLeads.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
