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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          {currentDate.toLocaleString('default', { month: 'long' })} {currentYear}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline">Today</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50 py-2 text-center text-sm font-semibold text-gray-600">
            {day}
          </div>
        ))}
        {calendarDays.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="bg-gray-50 min-h-[120px]"></div>;
          
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const dayLeads = leadsByDate[dateKey] || [];
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={dateKey} className={`bg-white p-2 min-h-[120px] ${isToday ? 'bg-blue-50/30' : ''}`}>
              <div className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                {date.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayLeads.slice(0, 3).map(lead => (
                  <div 
                    key={lead.id}
                    onClick={() => onLeadClick(lead.id)}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded cursor-pointer hover:bg-blue-100 truncate"
                    title={lead.name}
                  >
                    {lead.name}
                  </div>
                ))}
                {dayLeads.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium pl-1">
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
