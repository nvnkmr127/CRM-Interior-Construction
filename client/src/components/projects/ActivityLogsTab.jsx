/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-empty */
import React, { useEffect, useState } from 'react';
import { getProjectActivities, logActivity } from '../../api/projects';
import api from '../../api/axios';
import { formatDistanceToNow, format } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AIMeetingModal from '../leads/AIMeetingModal';

const Icons = {
  note: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  email: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  site_visit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  meeting: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  task: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  system: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> // Bolt icon for system
};

const ExpandableText = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 150;
  
  if (!text) return null;
  if (text.length <= maxLength) return <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>;

  return (
    <div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {expanded ? text : `${text.substring(0, maxLength)}...`}
      </p>
      <button 
        className="text-xs text-blue-600 font-medium mt-1 hover:underline focus:outline-none"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Read less' : 'Read more'}
      </button>
    </div>
  );
};

export default function ActivityLogsTab({ projectId, onTaskAdded }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [activeForm, setActiveForm] = useState(null); // 'note', 'email', 'task', 'site_visit'
  const [filter, setFilter] = useState('all'); // 'all', 'note', 'email', 'site_visit', 'task', 'system'

  // Activity Edit State
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEditClick = (activity) => {
    setEditingActivityId(activity.id);
    setEditNotes(activity.notes || '');
    setEditTitle(activity.title || activity.type || '');
  };

  const handleUpdateActivity = async (e, activityId) => {
    e.preventDefault();
    if (!editNotes.trim()) return;
    setIsUpdating(true);
    try {
      const res = await api.patch(`/projects/${projectId}/activities/${activityId}`, {
        notes: editNotes,
        title: editTitle
      });
      if (res.data?.success || res.status === 200) {
        const updatedActivity = res.data?.data || res.data || { notes: editNotes, title: editTitle };
        setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updatedActivity } : a));
        setEditingActivityId(null);
      }
    } catch (err) {
      alert('Failed to update activity.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Generic form data
  const [formData, setFormData] = useState({
    notes: '',
    // Task specific
    title: '',
    due_date: '',
    assigned_to: '',
    priority: 'medium',
    // Site Visit specific
    site_address: '',
    client_feedback: '',
    measurements_taken: false,
    // Meeting specific
    meeting_title: '',
    meeting_type: 'Google Meet',
    meeting_date: '',
    meeting_time: '',
    meeting_duration: '30',
    meeting_link: '',
    meeting_host: '',
    meeting_reminders: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice to text
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = React.useRef(null);

  const toggleListening = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setFormData(prev => ({ ...prev, notes: prev.notes + finalTranscript }));
      }
    };
    
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  // You might want to fetch reps for task assignment
  const [reps, setReps] = useState([]);
  useEffect(() => {
    api.get('/users?role=sales_rep').then(res => setReps(res.data?.data || [])).catch(() => {});
  }, []);

  const fetchActivities = async (page = 1, append = false) => {
    if (!projectId) return;
    try {
      if (!append) setLoading(true);
      const queryParams = { page, limit: 20 };
      if (filter !== 'all') {
        queryParams.type = filter;
      }
      const res = await getProjectActivities(projectId, queryParams);
      if (res.success) {
        setActivities(prev => append ? [...prev, ...res.data] : res.data);
        setMeta({ total: res.total, page: res.page, limit: res.limit });
      }
    } catch (error) {
      console.error('Failed to load timeline events', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(1, false);
  }, [projectId, filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (activeForm === 'meeting') {
        if (!formData.meeting_title || !formData.meeting_date || !formData.meeting_time) return;
        const scheduledAt = new Date(`${formData.meeting_date}T${formData.meeting_time}`).toISOString();
        const metadata = {
          title: formData.meeting_title,
          meeting_type: formData.meeting_type,
          duration: parseInt(formData.meeting_duration || '30', 10),
          meeting_link: formData.meeting_link || (formData.meeting_type === 'Google Meet' ? `https://meet.google.com/${Math.random().toString(36).substr(2, 3)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 3)}` : ''),
          meeting_host: formData.meeting_host || null,
          reminders_enabled: !!formData.meeting_reminders
        };
        await logActivity(projectId, {
          type: 'meeting',
          notes: formData.notes || `Scheduled meeting: ${formData.meeting_title}`,
          title: formData.meeting_title,
          scheduledAt,
          metadata
        });
      } else if (activeForm === 'task') {
        if (!formData.title || !formData.due_date) return;
        await api.post('/tasks', {
          lead_id: projectId,
          title: formData.title,
          due_date: formData.due_date,
          assigned_to: formData.assigned_to,
          priority: formData.priority,
          status: 'open'
        });
        if (onTaskAdded) onTaskAdded();
        await logActivity(projectId, { type: 'note', notes: `Scheduled task: ${formData.title} due on ${formData.due_date}` });
      } else if (activeForm === 'site_visit') {
        if (!formData.notes.trim()) return;
        const metadata = {
          site_address: formData.site_address,
          client_feedback: formData.client_feedback,
          measurements_taken: formData.measurements_taken
        };
        await logActivity(projectId, { type: 'site_visit', notes: formData.notes, metadata });
      } else {
        if (!formData.notes.trim()) return;
        await logActivity(projectId, { type: activeForm, notes: formData.notes });
      }
      
      await fetchActivities(1, false);
      setFormData({
        notes: '', title: '', due_date: '', assigned_to: '', priority: 'medium',
        site_address: '', client_feedback: '', measurements_taken: false,
        meeting_title: '', meeting_type: 'Google Meet', meeting_date: '', meeting_time: '',
        meeting_duration: '30', meeting_link: '', meeting_host: '', meeting_reminders: false
      });
      setActiveForm(null);
    } catch (err) {
      alert('Failed to save.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeStyle = (type, isSystem) => {
    if (isSystem) return 'bg-gray-800 text-yellow-400 border-gray-900';
    switch (type) {
      case 'site_visit': return 'bg-green-100 text-green-600 border-green-200';
      case 'email': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'meeting': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'note':
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const hasMore = meta.total > meta.page * meta.limit;

  const systemActivityKeywords = ['automation', 'score_tier_change', 'sla_breach', 'duplicate', 'task_completed'];

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm transition-all">
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-b rounded-t-lg justify-between items-center">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveForm(activeForm === 'email' ? null : 'email')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'email' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
            >
              <Icons.email /> Log Email
            </button>
            <button 
              onClick={() => setActiveForm(activeForm === 'note' ? null : 'note')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'note' ? 'bg-gray-200 text-gray-800 border-gray-400' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
            >
              <Icons.note /> Add Note
            </button>
            <button 
              onClick={() => setActiveForm(activeForm === 'task' ? null : 'task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'task' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
            >
              <Icons.task /> Schedule Task
            </button>
            <button 
              onClick={() => setActiveForm(activeForm === 'site_visit' ? null : 'site_visit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'site_visit' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
            >
              <Icons.site_visit /> Site Visit
            </button>
            <button 
              onClick={() => setActiveForm(activeForm === 'meeting' ? null : 'meeting')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ${activeForm === 'meeting' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white border text-gray-700 hover:bg-gray-100'}`}
            >
              <Icons.meeting /> Schedule Meeting
            </button>
          </div>
          <div>
            <button
              onClick={() => setIsMeetingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200"
            >
              <span className="text-lg leading-none">🎙️</span> AI Summarize
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 p-2 px-3 border-b border-gray-100 bg-white overflow-x-auto">
          {['all', 'note', 'email', 'site_visit', 'task', 'system'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'site_visit' ? 'Site Visits' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {activeForm && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            
            {activeForm === 'meeting' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Meeting Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Design Proposal Review"
                      value={formData.meeting_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, meeting_title: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Meeting Type *</label>
                    <select
                      required
                      value={formData.meeting_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, meeting_type: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="Google Meet">📹 Google Meet</option>
                      <option value="WhatsApp Call">📞 WhatsApp Call</option>
                      <option value="In-Person Site Visit">🏢 In-Person Site Visit</option>
                      <option value="Phone Call">☎️ Phone Call</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.meeting_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Time *</label>
                    <DatePicker
                      selected={formData.meeting_time ? new Date(`2000-01-01T${formData.meeting_time}`) : null}
                      onChange={(date) => {
                        if (date) {
                          const hours = date.getHours().toString().padStart(2, '0');
                          const minutes = date.getMinutes().toString().padStart(2, '0');
                          setFormData(prev => ({ ...prev, meeting_time: `${hours}:${minutes}` }));
                        } else {
                          setFormData(prev => ({ ...prev, meeting_time: '' }));
                        }
                      }}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="h:mm aa"
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholderText="Select time"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Duration *</label>
                    <select
                      required
                      value={formData.meeting_duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, meeting_duration: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="15">15 mins</option>
                      <option value="30">30 mins</option>
                      <option value="45">45 mins</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {formData.meeting_type === 'Google Meet' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Video Call Link</label>
                      <input
                        type="text"
                        placeholder="e.g. Google Meet link"
                        value={formData.meeting_link}
                        onChange={(e) => setFormData(prev => ({ ...prev, meeting_link: e.target.value }))}
                        className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                      />
                    </div>
                  )}
                  <div className={`space-y-1 ${formData.meeting_type !== 'Google Meet' ? 'col-span-2' : ''}`}>
                    <label className="text-xs font-semibold text-gray-500">Meeting Host</label>
                    <select
                      value={formData.meeting_host}
                      onChange={(e) => setFormData(prev => ({ ...prev, meeting_host: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">Select Host</option>
                      {reps.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Description / Agenda</label>
                  <textarea
                    rows="2"
                    placeholder="Enter meeting agenda..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                  ></textarea>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={formData.meeting_reminders}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_reminders: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  Send Client Reminders (WhatsApp & Email)
                </label>
              </div>
            ) : activeForm === 'task' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">Assign to (optional)</option>
                    {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
            ) : activeForm === 'site_visit' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Site Address"
                  value={formData.site_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, site_address: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <div className="relative">
                  <textarea
                    required
                    rows="3"
                    placeholder="Detailed Visit Notes (AI will summarize this)"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-3 pr-10 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                  ></textarea>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute right-3 bottom-4 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                  </button>
                </div>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Client Feedback (e.g. 'Loved the living room plan')"
                    value={formData.client_feedback}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_feedback: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                    <input type="checkbox" checked={formData.measurements_taken} onChange={(e) => setFormData(prev => ({ ...prev, measurements_taken: e.target.checked }))} className="rounded" />
                    Measurements Taken
                  </label>
                </div>
              </div>
            ) : (
              <div className="relative">
                <textarea
                  required
                  rows="3"
                  placeholder={activeForm === 'email' ? "Enter email details..." : "Write a note... (Click mic to dictate)"}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-3 pr-10 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner"
                ></textarea>
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-3 bottom-4 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                  title={isListening ? "Stop listening" : "Start Voice Dictation"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setActiveForm(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (activeForm === 'task' ? !formData.title : !formData.notes.trim())}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="relative pl-4 sm:pl-6 border-l-2 border-gray-100 space-y-6 pb-4">
        {loading && activities.length === 0 ? (
          <div className="animate-pulse space-y-4 pt-2">
            <div className="h-24 bg-gray-100 rounded-lg w-full"></div>
            <div className="h-24 bg-gray-100 rounded-lg w-full"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 italic">No activities recorded yet.</div>
        ) : (
          <>
            {activities.map((activity) => {
              const isSystem = !activity.user_name || systemActivityKeywords.some(kw => activity.type?.includes(kw) || activity.title?.toLowerCase().includes(kw));
              const Icon = isSystem ? Icons.system : (Icons[activity.type] || Icons.note);
              const typeLabel = activity.title || activity.type?.replace('_', ' ') || 'Activity';
              let timeAgo = '';
              let exactDate = '';
              try {
                const d = new Date(activity.created_at);
                timeAgo = formatDistanceToNow(d, { addSuffix: true });
                exactDate = format(d, 'PPpp');
              } catch(e) {}

              return (
                <div key={activity.id} className="relative group">
                  <div className={`absolute -left-[27px] sm:-left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm ${getTypeStyle(activity.type, isSystem)}`}>
                    <Icon />
                  </div>
                  
                  <div className={`border rounded-lg p-3.5 shadow-sm hover:shadow transition-shadow group-hover:border-gray-300 ${isSystem ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <span className="font-bold capitalize text-gray-800">{typeLabel}</span>
                        {isSystem ? (
                          <span className="ml-2 bg-gray-800 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">System Log</span>
                        ) : (
                          <span className="text-gray-500"> by {activity.user_name}</span>
                        )}
                        <span className="text-gray-400 text-xs ml-1 font-medium cursor-help" title={exactDate}>· {timeAgo}</span>
                      </div>
                      {!isSystem && editingActivityId !== activity.id && (
                        <button
                          onClick={() => handleEditClick(activity)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors ml-2 shrink-0"
                          title="Edit Activity"
                        >
                          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {editingActivityId === activity.id ? (
                      <form onSubmit={(e) => handleUpdateActivity(e, activity.id)} className="space-y-3 mt-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Notes</label>
                          <textarea
                            required
                            rows="3"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full rounded-md border border-gray-300 p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                          ></textarea>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingActivityId(null)}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isUpdating || !editNotes.trim()}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {activity.notes && (
                          <ExpandableText text={activity.notes} />
                        )}

                        {activity.ai_summary && (
                          <div className="mt-3 bg-indigo-50 p-3 rounded border border-indigo-100 flex gap-2">
                            <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            <div className="text-sm text-indigo-900 leading-relaxed font-medium">
                              {activity.ai_summary}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {activity.metadata?.suggested_tasks && activity.metadata.suggested_tasks.length > 0 && (
                      <div className="mt-3 bg-blue-50 p-3 rounded border border-blue-100">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          AI Suggested Tasks
                        </h4>
                        <div className="space-y-2">
                          {activity.metadata.suggested_tasks.map((task, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 border border-blue-100 rounded">
                              <span className="text-gray-700">{task.title}</span>
                              <button 
                                onClick={async () => {
                                  const dueDate = new Date();
                                  dueDate.setDate(dueDate.getDate() + (task.due_in_days || 0));
                                  await api.post('/tasks', {
                                    lead_id: projectId,
                                    title: task.title,
                                    due_date: dueDate.toISOString().split('T')[0],
                                    priority: 'medium',
                                    status: 'open'
                                  });
                                  await logActivity(projectId, { type: 'note', notes: `Accepted AI Task: ${task.title}` });
                                  fetchActivities(1, false);
                                  if (onTaskAdded) onTaskAdded();
                                }}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors font-medium whitespace-nowrap ml-2"
                              >
                                Accept Task
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchActivities(meta.page + 1, true)}
                  disabled={loading}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors shadow-sm"
                >
                  {loading ? 'Loading...' : 'Load older activities'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isMeetingModalOpen && (
        <AIMeetingModal 
          isOpen={isMeetingModalOpen} 
          onClose={() => setIsMeetingModalOpen(false)} 
          projectId={projectId} 
          onSummarySaved={() => {
            fetchActivities(1, false);
            setIsMeetingModalOpen(false);
          }} 
        />
      )}
    </div>
  );
}
