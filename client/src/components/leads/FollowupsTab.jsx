/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useConfirm } from '../../store/confirmContext';
import { Button, Badge, Input, Textarea, EmptyState } from '../ui';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';

export default function FollowupsTab({ leadId }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [followups, setFollowups] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', due_at: '', notes: '' });
  const [editingFollowupId, setEditingFollowupId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', due_at: '', notes: '' });

  const handleEditClick = (f) => {
    setEditingFollowupId(f.id);
    let formattedDueAt = '';
    if (f.due_at) {
      const date = new Date(f.due_at);
      const tzoffset = date.getTimezoneOffset() * 60000;
      formattedDueAt = (new Date(date - tzoffset)).toISOString().slice(0, 16);
    }
    setEditForm({
      title: f.title,
      due_at: formattedDueAt,
      notes: f.notes || ''
    });
  };

  const update = async (e) => {
    e.preventDefault();
    if (!editForm.title || !editForm.due_at) {
      toast.error('Title and due date required');
      return;
    }
    try {
      const res = await api.patch(`/leads/${leadId}/followups/${editingFollowupId}`, editForm);
      if (res.data.success) {
        setFollowups(prev => prev.map(x => x.id === editingFollowupId ? res.data.data : x));
        setEditingFollowupId(null);
        toast.success('Follow-up updated');
      }
    } catch {
      toast.error('Failed to update follow-up');
    }
  };

  useEffect(() => {
    api.get(`/leads/${leadId}/followups`)
      .then(res => { if (res.data.success) setFollowups(res.data.data); })
      .catch(() => {});
  }, [leadId]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title || !form.due_at) { toast.error('Title and due date required'); return; }
    try {
      const res = await api.post(`/leads/${leadId}/followups`, form);
      if (res.data.success) {
        setFollowups(prev => [res.data.data, ...prev]);
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
    if (await confirm('Are you sure you want to permanently delete this scheduled follow-up?')) {
      try {
        await api.delete(`/leads/${leadId}/followups/${id}`);
        setFollowups(prev => prev.filter(x => x.id !== id));
        toast.success('Follow-up deleted');
      } catch { toast.error('Failed to delete'); }
    }
  };

  const now = new Date();

  // Date helper for calendar block
  const getCalendarParts = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return {
        month: format(d, 'MMM'),
        day: format(d, 'd'),
        time: format(d, 'p')
      };
    } catch (e) {
      return { month: '---', day: '--', time: '--:--' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Follow-ups</h3>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            if (editingFollowupId) setEditingFollowupId(null);
          }}
          variant="outline"
          size="sm"
        >
          {showForm ? 'Cancel' : '+ Add Follow-up'}
        </Button>
      </div>

      {/* New Follow-up Form */}
      {showForm && (
        <form onSubmit={create} className="bg-gray-50 p-4 rounded-xl border space-y-3">
          <Input 
            label="Task Title"
            placeholder="e.g. Call client to discuss draft layout" 
            value={form.title} 
            onChange={e => setForm({...form, title: e.target.value})} 
            required 
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Date & Time *</label>
            <div className="relative">
              <DatePicker
                selected={form.due_at ? new Date(form.due_at) : null}
                onChange={(date) => {
                  if (date) {
                    const tzoffset = date.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
                    setForm({...form, due_at: localISOTime});
                  } else {
                    setForm({...form, due_at: ''});
                  }
                }}
                showTimeSelect
                timeFormat="p"
                timeIntervals={15}
                timeCaption="Time"
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText="Select Date & Time"
                className="w-full text-sm rounded-lg p-2 pr-10 border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none bg-white transition-all cursor-pointer"
                wrapperClassName="w-full"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
          </div>

          <Textarea 
            label="Notes"
            placeholder="Add key talking points, reminder details..." 
            value={form.notes} 
            rows={3}
            onChange={e => setForm({...form, notes: e.target.value})} 
          />

          <Button type="submit">Save Follow-up</Button>
        </form>
      )}

      {/* Editing Follow-up Form */}
      {editingFollowupId && (
        <form onSubmit={update} className="bg-gray-50 p-4 rounded-xl border space-y-3">
          <Input 
            label="Task Title"
            placeholder="e.g. Call client to discuss draft layout" 
            value={editForm.title} 
            onChange={e => setEditForm({...editForm, title: e.target.value})} 
            required 
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Date & Time *</label>
            <div className="relative">
              <DatePicker
                selected={editForm.due_at ? new Date(editForm.due_at) : null}
                onChange={(date) => {
                  if (date) {
                    const tzoffset = date.getTimezoneOffset() * 60000;
                    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
                    setEditForm({...editForm, due_at: localISOTime});
                  } else {
                    setEditForm({...editForm, due_at: ''});
                  }
                }}
                showTimeSelect
                timeFormat="p"
                timeIntervals={15}
                timeCaption="Time"
                dateFormat="MMMM d, yyyy h:mm aa"
                placeholderText="Select Date & Time"
                className="w-full text-sm rounded-lg p-2 pr-10 border border-gray-200 focus:ring-2 focus:ring-blue-200 outline-none bg-white transition-all cursor-pointer"
                wrapperClassName="w-full"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>
          </div>

          <Textarea 
            label="Notes"
            placeholder="Add key talking points, reminder details..." 
            value={editForm.notes} 
            rows={3}
            onChange={e => setEditForm({...editForm, notes: e.target.value})} 
          />

          <div className="flex gap-2">
             <Button type="submit">Update</Button>
             <Button type="button" variant="outline" onClick={() => setEditingFollowupId(null)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Follow-ups List */}
      {followups.length === 0 && !showForm ? (
        <EmptyState
          icon={<span className="text-4xl">📅</span>}
          title="No follow-ups scheduled"
          description="Plan a callback or site visit to make sure this lead gets the attention it needs."
          action={{
            label: 'Schedule Follow-up',
            onClick: () => setShowForm(true)
          }}
        />
      ) : (
        <div className="space-y-3">
          {followups.map(f => {
            const due = new Date(f.due_at);
            const isOverdue = !f.is_done && due < now;
            const { month, day, time } = getCalendarParts(f.due_at);

            return (
              <div 
                key={f.id} 
                className={`border p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative flex items-center gap-4 ${
                  isOverdue ? 'border-red-200 bg-red-50/5' : ''
                }`}
              >
                {/* Checkbox wrapper */}
                <div className="flex items-center shrink-0">
                  <input 
                    type="checkbox" 
                    checked={f.is_done} 
                    onChange={() => toggle(f)} 
                    className="w-4 h-4 text-blue-650 rounded border-gray-305 cursor-pointer" 
                  />
                </div>

                {/* Calendar square badge block */}
                <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border shrink-0 select-none ${
                  f.is_done
                    ? 'bg-gray-100 text-gray-400 border-gray-200'
                    : isOverdue
                      ? 'bg-red-50 text-red-700 border-red-150'
                      : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                  <span className="text-[9px] font-bold uppercase tracking-wider">{month}</span>
                  <span className="text-sm font-extrabold -mt-0.5">{day}</span>
                </div>

                {/* Text Description body */}
                <div className="flex-1 min-w-0 font-sans pr-12">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${f.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {f.title}
                    </p>
                    
                    {/* Status badges using system component */}
                    {f.is_done ? (
                      <Badge variant="success">Completed</Badge>
                    ) : isOverdue ? (
                      <Badge variant="danger">Overdue</Badge>
                    ) : (
                      <Badge variant="info">Pending</Badge>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 font-medium">
                    <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {time}
                  </p>
                  
                  {f.notes && (
                    <p className="text-xs text-gray-505 mt-2 bg-gray-50 p-2 rounded-lg italic">
                      "{f.notes}"
                    </p>
                  )}
                </div>

                {/* Edit/Delete Actions */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => handleEditClick(f)}
                    className="text-gray-405 hover:text-blue-500 focus:outline-none"
                    title="Edit Follow-up"
                  >
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => remove(f.id)} 
                    className="text-gray-405 hover:text-red-500 focus:outline-none"
                    title="Delete Follow-up"
                  >
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
