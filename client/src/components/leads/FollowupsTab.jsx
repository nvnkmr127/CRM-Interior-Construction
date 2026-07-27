/* eslint-disable no-unused-vars */
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

  const update = async (id) => {
    if (!editForm.title || !editForm.due_at) {
      toast.error('Title and due date required');
      return;
    }
    try {
      const res = await api.patch(`/leads/${leadId}/followups/${id}`, editForm);
      if (res.data.success) {
        setFollowups(prev => prev.map(x => x.id === id ? res.data.data : x));
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
              <div className="flex-1 min-w-0 font-sans">
                <p className={`text-sm font-medium ${f.is_done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{f.title}</p>
                <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  {isOverdue ? '⚠️ Overdue · ' : ''}{due.toLocaleString()}
                </p>
                {f.notes && <p className="text-xs text-gray-500 mt-1">{f.notes}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => handleEditClick(f)}
                  className="text-gray-400 hover:text-blue-600 focus:outline-none"
                  title="Edit"
                >
                  <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button onClick={() => remove(f.id)} className="text-gray-300 hover:text-red-500 text-lg leading-none">&times;</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
