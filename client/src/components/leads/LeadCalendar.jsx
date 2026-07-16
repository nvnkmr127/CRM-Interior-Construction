/* eslint-disable no-unused-vars, react-hooks/preserve-manual-memoization */
import React, { useMemo } from 'react';
import { Button } from '../ui';

export default function LeadCalendar({ leads, onLeadClick }) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentYear, currentMonth, i));
    }
    return days;
  }, [currentMonth, currentYear, daysInMonth, firstDayOfMonth]);

  const leadsByDate = useMemo(() => {
    const map = {};
    leads.forEach(lead => {
      const dateStr = lead.last_activity_at || lead.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    });
    return map;
  }, [leads]);

  return (
    <div className="rounded-xl shadow-sm border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline">Today</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px border rounded-lg overflow-hidden" style={{ background: 'var(--color-border)', borderColor: 'var(--color-border)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-sm font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}>
            {day}
          </div>
        ))}
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="min-h-[120px]" style={{ background: 'var(--color-surface-2)' }}></div>;
          
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayLeads = leadsByDate[dateKey] || [];
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={dateKey} className="p-2 min-h-[120px]" style={{ background: isToday ? 'var(--color-info-bg)' : 'var(--color-surface)' }}>
              <div className="text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2" style={isToday ? { background: '#2563eb', color: '#fff' } : { color: 'var(--color-text)' }}>
                {date.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayLeads.slice(0, 3).map(lead => (
                  <div 
                    key={lead.id}
                    onClick={() => onLeadClick(lead.id)}
                    className="text-xs px-2 py-1 border rounded cursor-pointer truncate"
                    style={{ background: 'var(--color-surface-3)', color: 'var(--color-text)', borderColor: 'var(--color-border-strong)' }}
                    title={lead.name}
                  >
                    {lead.name}
                  </div>
                ))}
                {dayLeads.length > 3 && (
                  <div className="text-xs font-medium pl-1" style={{ color: 'var(--color-text-secondary)' }}>
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
