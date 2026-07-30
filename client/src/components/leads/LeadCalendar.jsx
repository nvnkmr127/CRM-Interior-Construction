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
    (Array.isArray(leads) ? leads : []).forEach(lead => {
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
    <div className="rounded-xl p-6" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.5)', boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline">Today</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(255,255,255,0.4)' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-sm font-semibold uppercase tracking-wider" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', color: 'var(--color-text-secondary)' }}>
            {day}
          </div>
        ))}
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="min-h-[120px]" style={{ background: 'rgba(255, 255, 255, 0.3)' }}></div>;
          
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayLeads = leadsByDate[dateKey] || [];
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={dateKey} className="p-3 min-h-[120px] transition-colors duration-200" style={{ background: isToday ? 'rgba(170, 59, 255, 0.05)' : 'rgba(255, 255, 255, 0.6)' }}>
              <div className="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-3" style={isToday ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 10px rgba(170, 59, 255, 0.3)' } : { color: 'var(--color-text-secondary)' }}>
                {date.getDate()}
              </div>
              <div className="flex flex-col gap-1.5">
                {dayLeads.slice(0, 3).map(lead => (
                  <div 
                    key={lead.id}
                    onClick={() => onLeadClick(lead.id)}
                    className="text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-transform hover:scale-[1.02]"
                    style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--color-text)', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
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
