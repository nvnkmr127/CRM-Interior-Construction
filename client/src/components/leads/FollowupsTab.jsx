import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function FollowupsTab({ leadId }) {
  const toast = useToast();
  const [followups, setFollowups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', due_at: '', notes: '' });

  useEffect(() => {
    api.get(`/leads/${leadId}/followups`)
      .then(res => { if (res.data.success) setFollowups(res.data.data); })
      .catch(() => {});
  }, [leadId]);

  const create = async () => {
    if (!form.title || !form.due_at) { toast.error('Title and due date required'); return; }
    try {
      const res = await api.post(`/leads/${leadId}/followups`, form);
      if (res.data.success) {
        setFollowups(prev => [...prev, res.data.data]);
        setForm({ title: '', due_at: '', notes: '' });
        setShowForm(false);
        toast.success('Follow-up scheduled');
      }
    } catch { toast.error('Failed to create follow-up'); }
  };

  const toggle = async (f) => {
    try {
      const res = await api.patch(`/leads/${leadId}/followups/${f.id}`, { is_done: !f.is_done });
      if (res.data.success) setFollowups(prev => prev.map(x => x.id === f.id ? res.data.data : x));
    } catch { toast.error('Failed to update'); }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/leads/${leadId}/followups/${id}`);
      setFollowups(prev => prev.filter(x => x.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-700">Follow-ups</h4>
        <button onClick={() => setShowForm(s => !s)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add</button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
          <input
            type="text"
            placeholder="Title (e.g. Call back, Site visit follow-up)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full text-sm border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="relative">
            <DatePicker
              selected={form.due_at ? new Date(form.due_at) : null}
              onChange={(date) => {
                if (date) {
                  const tzoffset = date.getTimezoneOffset() * 60000;
                  const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
                  setForm(f => ({ ...f, due_at: localISOTime }));
                } else {
                  setForm(f => ({ ...f, due_at: '' }));
                }
              }}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              placeholderText="Select Date and Time"
              className="w-full text-sm border border-gray-300 rounded-lg p-2 pr-10 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 shadow-sm transition-colors"
              wrapperClassName="w-full"
              popperPlacement="bottom-start"
              calendarClassName="shadow-xl rounded-xl border-gray-200 font-sans text-sm"
              popperProps={{ strategy: "fixed" }}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-blue-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
          </div>
          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full text-sm border-gray-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button onClick={create} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {followups.length === 0 && !showForm && (
          <li className="text-sm text-gray-500 text-center py-6">No follow-ups scheduled</li>
        )}
        {followups.map(f => {
          const due = new Date(f.due_at);
          const isOverdue = !f.is_done && due < now;
          return (
            <li key={f.id} className={`bg-white border rounded-lg p-3 flex items-start gap-3 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <input
                type="checkbox"
                checked={f.is_done}
                onChange={() => toggle(f)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${f.is_done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{f.title}</p>
                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  {isOverdue ? '&#9888; Overdue · ' : ''}{due.toLocaleString()}
                </p>
                {f.notes && <p className="text-xs text-gray-500 mt-1">{f.notes}</p>}
              </div>
              <button onClick={() => remove(f.id)} className="text-gray-300 hover:text-red-500 shrink-0 text-lg leading-none">&times;</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
