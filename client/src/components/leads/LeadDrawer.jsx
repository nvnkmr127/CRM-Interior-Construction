import React, { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import { Drawer, Button, Badge } from '../ui';
import ScoreBadge from './ScoreBadge';
import ActivityTimeline from './ActivityTimeline';
import TaskWidget from './TaskWidget';
import ConvertToProjectModal from './ConvertToProjectModal';
import FollowupsTab from './FollowupsTab';
import CommunicationsTab from './CommunicationsTab';
import PreferencesTab from './PreferencesTab';
import StakeholdersTab from './StakeholdersTab';
import InspirationBoard from './InspirationBoard';
import AICopilotTab from './AICopilotTab';
import AIKnowledgeAssistantTab from './AIKnowledgeAssistantTab';
import AITwinTab from './AITwinTab';
import AutomationHistoryTab from './AutomationHistoryTab';
import LeadQualificationScore from './LeadQualificationScore';
import DiscoveryCallChecklist from './DiscoveryCallChecklist';
import LeadForm from './LeadForm';

import NegotiationDesk from './NegotiationDesk';
import DesignPresentationModal from './DesignPresentationModal';
import EstimatorBuilder from './EstimatorBuilder';
import AssignDesignerModal from './AssignDesignerModal';
import { getLead, changeLeadStage, deleteLead, updateActivity, logActivity } from '../../api/leads';
import api from '../../api/axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const formatDatetimeLocal = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  } catch {
    return dateStr;
  }
};

const formatMeetingSchedule = (dateStr) => {
  if (!dateStr) return null;
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

export default function LeadDrawer({ leadId, isOpen, onClose, onLeadUpdated, stages = [] }) {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, tasks, followups, files
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isPresentModalOpen, setIsPresentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);

  // Auto-saving state
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error', ''

  // Stage change states
  const [pendingStage, setPendingStage] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  // Score override
  const [editingScore, setEditingScore] = useState(false);

  // Possession entry mode
  const [isPossessionManual, setIsPossessionManual] = useState(false);

  // Meeting Schedule form states
  const [isEditingMeeting, setIsEditingMeeting] = useState(false);
  const [isConcludingMeeting, setIsConcludingMeeting] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meeting_type: 'Google Meet',
    date: '',
    time: '',
    duration: '30',
    meeting_link: '',
    meeting_host: '',
    reminders: false,
    notes: ''
  });

  useEffect(() => {
    if (lead) {
      if (lead.next_meeting_schedule) {
        const localDT = formatDatetimeLocal(lead.next_meeting_schedule);
        const [dPart, tPart] = localDT.split('T');
        setMeetingForm({
          title: lead.next_meeting_title || '',
          meeting_type: lead.next_meeting_type || 'Google Meet',
          date: dPart || '',
          time: tPart || '',
          duration: lead.next_meeting_duration || '30',
          meeting_link: lead.next_meeting_link || '',
          meeting_host: lead.next_meeting_host || '',
          reminders: true,
          notes: lead.next_meeting_notes || ''
        });
      } else {
        setMeetingForm({
          title: '',
          meeting_type: 'Google Meet',
          date: '',
          time: '',
          duration: '30',
          meeting_link: '',
          meeting_host: '',
          reminders: false,
          notes: ''
        });
      }
    }
  }, [lead, isEditingMeeting]);

  // Files state
  const [files, setFiles] = useState([]);
  
  // Estimates state
  const [estimates, setEstimates] = useState([]);
  const [syncError, setSyncError] = useState(null);
  const [isBuildingEstimate, setIsBuildingEstimate] = useState(false);
  
  // Buying intent state
  const [buyingIntent, setBuyingIntent] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);

  // Mood state
  const [mood, setMood] = useState(null);
  const [moodLoading, setMoodLoading] = useState(false);

  // Team users list state
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLead();
      setActiveTab('overview');
      setBuyingIntent(null);
      setMood(null);
      api.get('/users?limit=50')
        .then(res => { if (res.data.success) setUsers(res.data.data); })
        .catch(err => console.error('Failed to load users list:', err));
    }
  }, [isOpen, leadId]);

  // Load files when tab is activated
  useEffect(() => {
    if (activeTab === 'files' && leadId) {
      api.get(`/leads/${leadId}/files`)
        .then(res => { if (res.data.success) setFiles(res.data.data); })
        .catch(() => {});
    }
  }, [activeTab, leadId]);

  // Load estimates when tab is activated
  useEffect(() => {
    if (activeTab === 'estimates' && leadId) {
      api.get(`/leads/${leadId}/estimates`)
        .then(res => { if (res.data.success) setEstimates(res.data.data); })
        .catch(() => {});
    }
  }, [activeTab, leadId]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const res = await getLead(leadId);
      if (res.success) setLead(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.date || !meetingForm.time) {
      toast.error('Title, Date and Time are required');
      return;
    }
    setMeetingSubmitting(true);
    try {
      const scheduledAt = new Date(`${meetingForm.date}T${meetingForm.time}`).toISOString();
      const payload = {
        title: meetingForm.title,
        notes: meetingForm.notes || `Scheduled meeting: ${meetingForm.title}`,
        scheduledAt,
        metadata: {
          meeting_type: meetingForm.meeting_type,
          meeting_link: meetingForm.meeting_link || (meetingForm.meeting_type === 'Google Meet' ? `https://meet.google.com/${Math.random().toString(36).substr(2, 3)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 3)}` : ''),
          meeting_host: meetingForm.meeting_host || null,
          duration: parseInt(meetingForm.duration || '30', 10),
          reminders_enabled: !!meetingForm.reminders
        }
      };

      if (lead.next_meeting_id) {
        // Update existing meeting
        await updateActivity(leadId, lead.next_meeting_id, payload);
        toast.success('Meeting updated successfully');
      } else {
        // Create new meeting
        await logActivity(leadId, {
          type: 'meeting',
          ...payload
        });
        toast.success('Meeting scheduled successfully');
      }
      setIsEditingMeeting(false);
      fetchLead();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save meeting details');
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const handleConcludeMeeting = async (e) => {
    e.preventDefault();
    if (!meetingSummary.trim()) {
      toast.error('Meeting summary is required');
      return;
    }
    setMeetingSubmitting(true);
    try {
      const payload = {
        outcome: 'concluded',
        notes: meetingSummary
      };
      await updateActivity(leadId, lead.next_meeting_id, payload);
      
      toast.success('Meeting marked as concluded and saved to AI Knowledge Base');
      setIsConcludingMeeting(false);
      setMeetingSummary('');
      fetchLead();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to conclude meeting');
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const fetchBuyingIntent = async () => {
    setIntentLoading(true);
    try {
      const res = await api.post(`/leads/${leadId}/buying-intent`);
      if (res.data.success) {
        setBuyingIntent(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to analyze buying intent');
    } finally {
      setIntentLoading(false);
    }
  };

  const fetchMood = async () => {
    setMoodLoading(true);
    try {
      const res = await api.post(`/leads/${leadId}/sentiment`);
      if (res.data.success) {
        setMood(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to analyze mood');
    } finally {
      setMoodLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setLead(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = async (field, value) => {
    setSaveStatus('saving');
    try {
      const res = await api.patch(`/leads/${leadId}`, { [field]: value, updated_at: lead.updated_at });
      if (res.data?.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
        setLead(prev => ({ ...prev, updated_at: res.data.data.updated_at }));
        onLeadUpdated?.(res.data.data);
        if (field === 'score') setLead(prev => ({ ...prev, score: value }));
      }
    } catch (e) {
      setSaveStatus('error');
      if (e.response?.data?.error?.code === 'OPTIMISTIC_LOCK_FAILED') {
        toast.error('This lead was modified by someone else. Please refresh to see the latest changes.');
      } else {
        toast.error(`Failed to save ${field}`);
      }
    }
  };

  const handleStageSelect = (e) => {
    const newStageId = e.target.value;
    const stageInfo = stages.find(s => s.id === newStageId);
    if (!stageInfo) return;

    const missing = [];
    if (stageInfo.mandatory_fields) {
      stageInfo.mandatory_fields.forEach(f => {
        if (!lead[f] && (!lead.custom_fields || !lead.custom_fields[f])) {
          missing.push(f);
        }
      });
    }

    if (missing.length > 0) {
      setMissingFields(missing);
      setPendingStage(stageInfo);
      setErrorMsg(`Stage gate: ${missing.join(', ')} required to move to ${stageInfo.name}.`);
    } else {
      setMissingFields([]);
      setPendingStage(null);
      setErrorMsg(null);
      executeStageChange(newStageId);
    }
  };

  const executeStageChange = async (newStageId) => {
    const oldStageId = lead.stage_id;
    setLead(prev => ({ ...prev, stage_id: newStageId }));
    try {
      const res = await changeLeadStage(leadId, newStageId);
      if (res.success) {
        setLead(res.data);
        onLeadUpdated?.(res.data);
        toast.success(`Stage updated successfully.`);
      }
    } catch (e) {
      setLead(prev => ({ ...prev, stage_id: oldStageId }));
      toast.error('Failed to update stage. Reverted.');
    }
  };

  const handleArchiveToggle = async () => {
    const newStatus = lead.status === 'archived' ? 'active' : 'archived';
    try {
      const res = await api.patch(`/leads/${leadId}`, { status: newStatus, updated_at: lead.updated_at });
      if (res.data?.success) {
        toast.success(`Lead ${newStatus === 'archived' ? 'archived' : 'unarchived'} successfully`);
        setLead(prev => ({ ...prev, status: newStatus, updated_at: res.data.data.updated_at }));
        onLeadUpdated?.(res.data.data);
      }
    } catch (e) {
      if (e.response?.data?.error?.code === 'OPTIMISTIC_LOCK_FAILED') {
        toast.error('This lead was modified by someone else. Please refresh to see the latest changes.');
      } else {
        toast.error(`Failed to ${newStatus === 'archived' ? 'archive' : 'unarchive'} lead`);
      }
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to PERMANENTLY delete this lead?')) {
      try {
        await deleteLead(leadId);
        toast.success('Lead deleted successfully');
        onClose();
        if (onLeadUpdated) onLeadUpdated(null);
        else window.location.reload();
      } catch (e) {
        toast.error('Failed to delete lead.');
      }
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post(`/leads/${leadId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        const filesRes = await api.get(`/leads/${leadId}/files`);
        if (filesRes.data.success) setFiles(filesRes.data.data);
        toast.success('File uploaded');
      }
    } catch {
      toast.error('Upload failed');
    }
  };

  const deleteFile = async (fileId) => {
    try {
      await api.delete(`/leads/${leadId}/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      toast.error('Failed to delete file');
    }
  };

  const fetchEstimates = async () => {
    const estRes = await api.get(`/leads/${leadId}/estimates`);
    if (estRes.data.success) setEstimates(estRes.data.data);
  };

  const syncEstimates = async () => {
    toast.info('Syncing estimates with external system...');
    setSyncError(null);
    try {
      const estRes = await api.post(`/leads/${leadId}/estimates/sync`);
      if (estRes.data.success) {
        setEstimates(estRes.data.data);
        toast.success('Estimates synced');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to sync estimates';
      setSyncError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCreateEstimate = () => {
    setIsBuildingEstimate(true);
  };

  const handleParseFile = async (fileId) => {
    toast.info('Extracting data from file...');
    try {
      const res = await api.post(`/leads/${leadId}/files/${fileId}/parse`);
      if (res.data.success) {
        const { carpet_area, room_count, property_type, extracted_scope } = res.data.data;
        // Optionally update the lead
        const updates = {};
        if (extracted_scope) updates.scope = (lead.scope ? lead.scope + '\n\n' : '') + extracted_scope;
        if (property_type) updates.project_type = property_type;
        // We could store carpet_area and room_count in lifestyle_preferences or directly if fields exist.
        
        // Update local state and backend
        if (Object.keys(updates).length > 0) {
          await api.patch(`/leads/${leadId}`, updates);
          setLead(prev => ({ ...prev, ...updates }));
          toast.success('Lead updated from document');
        } else {
          toast.success('Parsing completed, but no relevant updates found');
        }
      }
    } catch (err) {
      toast.error('Failed to parse file');
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="1295px" closeOnBackdrop={false} hideHeader noPadding>
      {loading || !lead ? (
        <div className="p-6 flex items-center justify-center text-gray-500">Loading lead details...</div>
      ) : (
        <div className="flex flex-col h-full bg-gray-50">

          {/* HEADER */}
          <div className="bg-white border-b border-gray-200 px-6 pt-6 pb-4 shrink-0 shadow-sm relative z-10">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  value={lead.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  onBlur={(e) => handleFieldBlur('name', e.target.value)}
                  className="text-xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full pb-1 transition-colors"
                  placeholder="Lead Name"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-1 text-gray-800 hover:text-black">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="outline" className="text-gray-600 font-mono text-xs">{lead.lead_number || `LD-${String(lead.id).substring(0,4).toUpperCase()}`}</Badge>
              {editingScore ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const val = parseInt(e.target.score.value, 10);
                  if (isNaN(val) || val < 0 || val > 100) return;
                  await handleFieldBlur('score', val);
                  setEditingScore(false);
                }} className="flex items-center gap-1">
                  <input name="score" type="number" min="0" max="100" defaultValue={lead.score}
                    className="w-16 text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500" autoFocus />
                  <button type="submit" className="text-xs text-blue-600 font-medium">Save</button>
                  <button type="button" onClick={() => setEditingScore(false)} className="text-xs text-gray-500">&#x2715;</button>
                </form>
              ) : (
                <div className="relative group flex items-center">
                  <span onClick={() => setEditingScore(true)} className="cursor-pointer">
                    <ScoreBadge score={lead.score} />
                  </span>
                  {lead.custom_fields?.score_breakdown && lead.custom_fields.score_breakdown.length > 0 && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200 shadow-lg rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <h5 className="text-xs font-bold text-gray-700 uppercase mb-2 border-b pb-1">Score Breakdown</h5>
                      <ul className="space-y-1">
                        {lead.custom_fields.score_breakdown.map((item, idx) => (
                          <li key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 truncate mr-2" title={item.rule_name}>{item.rule_name}</span>
                            <span className={`font-semibold ${item.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.points > 0 ? '+' : ''}{item.points}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 text-[10px] text-gray-400 italic text-center">Click badge to override score</div>
                    </div>
                  )}
                </div>
              )}
              {lead.win_probability != null && (
                <Badge variant="outline" className={`font-semibold ${lead.win_probability > 70 ? 'text-green-700 bg-green-100 border-green-200' : lead.win_probability > 30 ? 'text-yellow-700 bg-yellow-100 border-yellow-200' : 'text-gray-700 bg-gray-100 border-gray-200'}`} title="AI-calculated probability of winning this lead">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                  {lead.win_probability}% Win Probability
                </Badge>
              )}
              {lead.assignee_name && (
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1 text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-200" title="Reassign">
                  {lead.assignee_avatar ? (
                    <img src={lead.assignee_avatar} alt="" className="w-4 h-4 rounded-full" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center" style={{fontSize: '8px'}}>{lead.assignee_name[0]}</div>
                  )}
                  {lead.assignee_name}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="relative w-48">
                <select
                  value={lead.stage_id}
                  onChange={handleStageSelect}
                  className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                >
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500 font-medium">
                  {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
                  {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Saved</span>}
                  {saveStatus === 'error' && <span className="text-red-600">Save failed</span>}
                </div>
                <Button variant="primary" size="sm" onClick={() => setIsConvertModalOpen(true)}>Convert to Project</Button>
              </div>
            </div>
            {errorMsg && <div className="mt-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">{errorMsg}</div>}
          </div>

          {/* TABS NAVIGATION */}
          <div className="bg-white px-6 border-b border-gray-200 shrink-0">
            <nav className="flex -mb-px px-6 gap-6 overflow-x-auto">
              {['overview', 'negotiation', 'ai-copilot', 'knowledge-base', 'stakeholders', 'communications', 'preferences', 'activity', 'tasks', 'followups', 'meeting-schedule', 'files', 'estimates', 'inspirations', 'twin', 'automations'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap pb-3 pt-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'knowledge-base' ? 'AI Knowledge Base' : tab === 'automations' ? 'Automation History' : tab === 'meeting-schedule' ? 'Meeting Schedule' : tab}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB CONTENT (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT PANEL: Details */}
                <div className="space-y-6 flex flex-col">
                  {/* Upcoming Meeting */}
                  {lead.next_meeting_schedule && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-lg shadow-sm border border-orange-200">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1">
                          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          Upcoming Meeting
                        </h4>
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded uppercase tracking-wide">
                          Scheduled
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        <div className="text-sm font-semibold text-gray-800">
                          {lead.next_meeting_title || 'Lead Consultation Meeting'}
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">📅</span>
                            <span className="font-medium text-gray-700">{formatMeetingSchedule(lead.next_meeting_schedule)}</span>
                            {lead.next_meeting_duration && (
                              <span className="text-gray-400">({lead.next_meeting_duration} mins)</span>
                            )}
                          </div>
                          {lead.next_meeting_type && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400">📍</span>
                              <span className="font-medium text-gray-700">{lead.next_meeting_type}</span>
                            </div>
                          )}
                          {lead.next_meeting_host && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400">👤</span>
                              <span className="font-medium text-gray-700">Host: {lead.next_meeting_host}</span>
                            </div>
                          )}
                        </div>
                        
                        {lead.next_meeting_link && (
                          <div className="pt-2 border-t border-orange-100 mt-2">
                            <a
                              href={lead.next_meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              Join Call / Open Link
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</h4>
                      <button onClick={() => setIsLeadFormOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between group">
                        <span className="text-sm text-gray-500 w-24">Phone</span>
                        <input
                          type="text" value={lead.phone || ''}
                          onChange={e => handleFieldChange('phone', e.target.value)}
                          onBlur={e => handleFieldBlur('phone', e.target.value)}
                          className="flex-1 text-sm font-medium border-transparent focus:border-gray-300 focus:ring-0 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                          placeholder="Add phone..."
                        />
                      </div>
                      <div className="flex items-center justify-between group">
                        <span className="text-sm text-gray-500 w-24">Email</span>
                        <input
                          type="email" value={lead.email || ''}
                          onChange={e => handleFieldChange('email', e.target.value)}
                          onBlur={e => handleFieldBlur('email', e.target.value)}
                          className="flex-1 text-sm font-medium border-transparent focus:border-gray-300 focus:ring-0 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                          placeholder="Add email..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Property & Scope */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Details</h4>
                      <button onClick={() => setIsLeadFormOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Type of property</label>
                        <select
                          value={lead.property_type || ''}
                          onChange={e => handleFieldChange('property_type', e.target.value)}
                          onBlur={e => handleFieldBlur('property_type', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          <option value="1bhk">1 BHK</option>
                          <option value="2bhk">2 BHK</option>
                          <option value="3bhk">3 BHK</option>
                          <option value="4bhk">4 BHK</option>
                          <option value="5bhk">5 BHK</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Product</label>
                        <select
                          value={lead.scope || ''}
                          onChange={e => handleFieldChange('scope', e.target.value)}
                          onBlur={e => handleFieldBlur('scope', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          <option value="kitchen">Kitchen</option>
                          <option value="bedroom">Bedroom</option>
                          <option value="wardrobe">Wardrobe</option>
                          <option value="fullhouse">Full House</option>
                          <option value="living_room">Living Room</option>
                          <option value="bathroom">Bathroom</option>
                          <option value="office">Office / Study</option>
                          <option value="false_ceiling">False Ceiling</option>
                          <option value="flooring">Flooring</option>
                          <option value="painting">Painting</option>
                          <option value="custom_furniture">Custom Furniture</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Address</label>
                        <input
                          type="text" value={lead.locality || ''}
                          onChange={e => handleFieldChange('locality', e.target.value)}
                          onBlur={e => handleFieldBlur('locality', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. Indiranagar, Bangalore"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Budget Max (&#8377;)</label>
                        <input
                          type="number" value={lead.budget_max || ''}
                          onChange={e => handleFieldChange('budget_max', e.target.value)}
                          onBlur={e => handleFieldBlur('budget_max', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. 1500000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Carpet Area</label>
                        <input
                          type="number" value={lead.carpet_area_sqft || ''}
                          onChange={e => handleFieldChange('carpet_area_sqft', e.target.value)}
                          onBlur={e => handleFieldBlur('carpet_area_sqft', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Sq. ft"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Segment</label>
                        <select
                          value={lead.segment || ''}
                          onChange={e => handleFieldChange('segment', e.target.value)}
                          onBlur={e => handleFieldBlur('segment', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select...</option>
                          <option value="residential">Residential</option>
                          <option value="commercial">Commercial</option>
                          <option value="hospitality">Hospitality</option>
                          <option value="retail">Retail</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Property Name</label>
                        <input
                          type="text" value={lead.property_name || ''}
                          onChange={e => handleFieldChange('property_name', e.target.value)}
                          onBlur={e => handleFieldBlur('property_name', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. Prestige Shantiniketan"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs text-gray-500">Possession Date & Time</label>
                          <button 
                            type="button" 
                            onClick={() => setIsPossessionManual(!isPossessionManual)} 
                            className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                          >
                            {isPossessionManual ? 'Use Calendar' : 'Manual Entry'}
                          </button>
                        </div>
                        {isPossessionManual ? (
                          <input
                            type="text" value={lead.possession_month || ''}
                            onChange={e => handleFieldChange('possession_month', e.target.value)}
                            onBlur={e => handleFieldBlur('possession_month', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. Q4 2026, Next year"
                          />
                        ) : (
                        <div className="relative">
                          <DatePicker
                            selected={lead.possession_month ? new Date(lead.possession_month) : null}
                            onChange={(date) => {
                              if (date) {
                                const tzoffset = date.getTimezoneOffset() * 60000;
                                const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
                                handleFieldChange('possession_month', localISOTime);
                                handleFieldBlur('possession_month', localISOTime);
                              } else {
                                handleFieldChange('possession_month', '');
                                handleFieldBlur('possession_month', '');
                              }
                            }}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            dateFormat="MMMM d, yyyy h:mm aa"
                            placeholderText="Select Date and Time"
                            className="w-full text-sm border border-gray-300 rounded p-1.5 pr-10 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 shadow-sm transition-colors"
                            wrapperClassName="w-full"
                            popperPlacement="bottom-start"
                            calendarClassName="shadow-xl rounded-xl border-gray-200 font-sans text-sm"
                            popperProps={{ strategy: "fixed" }}
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-blue-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preferences & Tracking */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preferences</h4>
                      <button onClick={() => setIsLeadFormOpen(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Do Not Contact (DNC)</span>
                        <input
                          type="checkbox"
                          checked={lead.dnc_flag || false}
                          onChange={e => {
                            handleFieldChange('dnc_flag', e.target.checked);
                            handleFieldBlur('dnc_flag', e.target.checked);
                          }}
                          className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                        />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Consent given</span>
                        <input
                          type="checkbox"
                          checked={lead.consent_whatsapp || false}
                          onChange={e => {
                            handleFieldChange('consent_whatsapp', e.target.checked);
                            handleFieldBlur('consent_whatsapp', e.target.checked);
                          }}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                      </label>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Competitor Mentioned</label>
                        <input
                          type="text" value={lead.competitor_mentioned || ''}
                          onChange={e => handleFieldChange('competitor_mentioned', e.target.value)}
                          onBlur={e => handleFieldBlur('competitor_mentioned', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g. Livspace, HomeLane"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* END LEFT PANEL */}

                {/* CENTER PANEL: Timeline & Checklist */}
                <div className="space-y-4 border-l border-r border-gray-100 px-4">
                  <DiscoveryCallChecklist lead={lead} onUpdate={fetchLead} />
                  
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Activity Timeline</h4>
                  <ActivityTimeline leadId={leadId} />
                </div>
                {/* END CENTER PANEL */}

                {/* RIGHT PANEL: AI Insights & Score */}
                <div className="space-y-6">
                  <LeadQualificationScore lead={lead} />
                  
                  {/* AI Insights Section */}
                  {(lead.win_probability !== undefined || lead.ai_score_breakdown) && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow-sm border border-blue-100">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          AI Insights
                        </h4>
                        {lead.win_probability !== undefined && (
                          <Badge variant="outline" className={`font-semibold ${lead.win_probability > 70 ? 'text-green-700 bg-green-100 border-green-200' : lead.win_probability > 30 ? 'text-yellow-700 bg-yellow-100 border-yellow-200' : 'text-gray-700 bg-gray-100 border-gray-200'}`}>
                            {lead.win_probability}% Win Probability
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-white p-2 rounded shadow-sm border border-blue-50">
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Next Action</div>
                          <div className="text-sm font-medium text-gray-800">{lead.ai_recommendation || 'Follow up'}</div>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm border border-blue-50">
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Budget Confidence</div>
                          <div className="text-sm font-medium text-gray-800">{lead.budget_confidence || 'High'}</div>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm border border-blue-50">
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Decision Maker</div>
                          <div className="text-sm font-medium text-gray-800">{lead.decision_maker || 'Spouse'}</div>
                        </div>
                        <div className="bg-white p-2 rounded shadow-sm border border-blue-50">
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Risk Level</div>
                          <div className="text-sm font-medium text-gray-800">{lead.risk_level || 'Low'}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BUYING INTENT WIDGET */}
                  <div className="bg-orange-50/50 p-4 rounded-lg shadow-sm border border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        Buying Intent Engine
                      </h4>
                      <Button variant="outline" size="sm" onClick={fetchBuyingIntent} disabled={intentLoading} className="text-[10px] py-1 h-7">
                        {intentLoading ? 'Analyzing...' : 'Analyze Intent'}
                      </Button>
                    </div>
                    {buyingIntent ? (
                      <div className="bg-white p-3 rounded border border-orange-50 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-semibold">Predicted Intent</div>
                          <div className={`text-lg font-bold flex items-center gap-2 ${
                            buyingIntent.intent === 'Hot' ? 'text-red-600' : 
                            buyingIntent.intent === 'Warm' ? 'text-orange-500' : 'text-blue-500'
                          }`}>
                            {buyingIntent.intent === 'Hot' && '🔥 '}
                            {buyingIntent.intent === 'Warm' && '☀️ '}
                            {buyingIntent.intent === 'Cold' && '❄️ '}
                            {buyingIntent.intent} ({buyingIntent.confidence}%)
                          </div>
                          <div className="text-xs text-gray-700 mt-1">{buyingIntent.reason}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-orange-600/70 italic text-center py-2">
                        Click analyze to run the AI intent prediction model.
                      </div>
                    )}
                  </div>
                  
                  {/* REFERRAL NETWORK WIDGET */}
                  <div className="bg-indigo-50/50 rounded-lg p-5 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">🤝</span>
                      <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Referral Network</h3>
                    </div>
                    {lead.referrals && lead.referrals.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-end border-b border-indigo-200 pb-2 mb-3">
                          <div className="text-xs text-indigo-600 font-semibold uppercase">Total Referrals: {lead.referrals.length}</div>
                          <div className="text-xs text-indigo-600 font-semibold uppercase">
                            Value: ₹{(lead.referrals.reduce((sum, r) => sum + (parseFloat(r.budget_max) || 0), 0)).toLocaleString()}
                          </div>
                        </div>
                        {lead.referrals.map(ref => (
                          <div key={ref.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-indigo-50">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{ref.name}</div>
                              <div className="text-xs text-gray-500">{ref.stage_name} • {new Date(ref.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="text-sm font-semibold text-gray-700">
                              {ref.budget_max ? `₹${Number(ref.budget_max).toLocaleString()}` : 'TBD'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-indigo-400 text-center py-4 bg-white/50 rounded border border-dashed border-indigo-200">
                        No referrals recorded yet.
                      </div>
                    )}
                  </div>
                </div>
                {/* END RIGHT PANEL */}

              </div>
            )}



            {activeTab === 'negotiation' && (
              <NegotiationDesk leadId={leadId} lead={lead} onUpdate={fetchLead} />
            )}

            {activeTab === 'ai-copilot' && (
              <AICopilotTab leadId={leadId} />
            )}

            {activeTab === 'stakeholders' && (
              <StakeholdersTab leadId={leadId} />
            )}

            {activeTab === 'communications' && (
              <CommunicationsTab leadId={leadId} lead={lead} />
            )}

            {activeTab === 'preferences' && (
              <PreferencesTab 
                lead={lead} 
                handleFieldChange={handleFieldChange} 
                handleFieldBlur={handleFieldBlur} 
              />
            )}

            {activeTab === 'knowledge-base' && (
              <AIKnowledgeAssistantTab leadId={leadId} lead={lead} />
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                {/* MOOD TRACKER WIDGET */}
                <div className="bg-pink-50/50 p-4 rounded-lg shadow-sm border border-pink-100 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-pink-800 uppercase tracking-wider flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      AI Mood Tracker
                    </h4>
                    <Button variant="outline" size="sm" onClick={fetchMood} disabled={moodLoading} className="text-[10px] py-1 h-7">
                      {moodLoading ? 'Analyzing...' : 'Analyze Mood'}
                    </Button>
                  </div>
                  {mood ? (
                    <div className="bg-white p-3 rounded border border-pink-50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-3xl">{mood.emoji}</div>
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase font-semibold">Current Mood</div>
                          <div className="text-lg font-bold text-gray-900">{mood.mood}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-700 bg-pink-50 p-2 rounded border border-pink-100 italic">
                        <span className="font-semibold text-pink-800 not-italic mr-1">Coach Tip:</span>
                        {mood.tip}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-pink-600/70 italic text-center py-2">
                      Click analyze to assess the prospect's emotional state based on recent activities.
                    </div>
                  )}
                </div>

                <ActivityTimeline leadId={leadId} />
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <TaskWidget leadId={leadId} />
              </div>
            )}

            {activeTab === 'followups' && (
              <FollowupsTab leadId={leadId} />
            )}

            {activeTab === 'meeting-schedule' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Upcoming Meeting Schedule</h3>
                      <p className="text-xs text-gray-500 mt-1">Manage scheduled meetings and joining details for this lead.</p>
                    </div>
                    {lead.next_meeting_schedule && !isEditingMeeting && (
                      <span className="px-3 py-1 bg-orange-100 border border-orange-200 text-orange-700 text-xs font-semibold rounded-full uppercase tracking-wider">
                        📅 Scheduled
                      </span>
                    )}
                  </div>

                  {isEditingMeeting ? (
                    <form onSubmit={handleMeetingSubmit} className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meeting Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Initial Consultation, BOQ Review"
                            value={meetingForm.title}
                            onChange={e => setMeetingForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meeting Type</label>
                          <select
                            value={meetingForm.meeting_type}
                            onChange={e => setMeetingForm(prev => ({ ...prev, meeting_type: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Google Meet">Google Meet</option>
                            <option value="In-Person Site Visit">In-Person Site Visit</option>
                            <option value="Phone Call">Phone Call</option>
                            <option value="WhatsApp Call">WhatsApp Call</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date *</label>
                          <div className="relative">
                            <DatePicker
                              selected={meetingForm.date ? new Date(meetingForm.date) : null}
                              onChange={(date) => {
                                if (date) {
                                  const tzoffset = date.getTimezoneOffset() * 60000;
                                  const localDateStr = (new Date(date - tzoffset)).toISOString().slice(0, 10);
                                  setMeetingForm(prev => ({ ...prev, date: localDateStr }));
                                } else {
                                  setMeetingForm(prev => ({ ...prev, date: '' }));
                                }
                              }}
                              dateFormat="dd MMMM, yyyy"
                              placeholderText="Select Date"
                              className="w-full text-sm border border-gray-300 rounded-lg p-2 pr-10 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 shadow-sm transition-colors"
                              wrapperClassName="w-full"
                              popperPlacement="bottom-start"
                              calendarClassName="shadow-xl rounded-xl border-gray-200 font-sans text-sm"
                              popperProps={{ strategy: "fixed" }}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-blue-500">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time *</label>
                          <input
                            type="time"
                            required
                            value={meetingForm.time}
                            onChange={e => setMeetingForm(prev => ({ ...prev, time: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Duration</label>
                          <select
                            value={meetingForm.duration}
                            onChange={e => setMeetingForm(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">1 hour</option>
                            <option value="90">1.5 hours</option>
                            <option value="120">2 hours</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Host Assignee</label>
                          <select
                            value={meetingForm.meeting_host}
                            onChange={e => setMeetingForm(prev => ({ ...prev, meeting_host: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="">Select Host / Assignee</option>
                            {users.map(u => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Video Call Link</label>
                          <input
                            type="url"
                            placeholder="https://meet.google.com/..."
                            value={meetingForm.meeting_link}
                            onChange={e => setMeetingForm(prev => ({ ...prev, meeting_link: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Leave empty to auto-generate a Google Meet link when selected as the type.</p>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agenda / Description</label>
                          <textarea
                            rows={3}
                            placeholder="Describe meeting agenda, files to bring, or client requirements..."
                            value={meetingForm.notes}
                            onChange={e => setMeetingForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={meetingForm.reminders}
                              onChange={e => setMeetingForm(prev => ({ ...prev, reminders: e.target.checked }))}
                              className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                            />
                            <span className="text-xs font-semibold text-gray-700">Send WhatsApp &amp; Email reminders to the client</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditingMeeting(false);
                          }}
                          disabled={meetingSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={meetingSubmitting}
                          className="bg-orange-600 border-orange-600 hover:bg-orange-700 hover:border-orange-700 text-white"
                        >
                          {meetingSubmitting ? 'Saving...' : lead.next_meeting_schedule ? 'Update Meeting' : 'Schedule Meeting'}
                        </Button>
                      </div>
                    </form>
                  ) : isConcludingMeeting ? (
                    <form onSubmit={handleConcludeMeeting} className="space-y-4 pt-2">
                      <div className="bg-green-50/50 p-4 rounded-lg border border-green-200 mb-4">
                        <h4 className="text-sm font-semibold text-green-800">Conclude "{lead.next_meeting_title || 'Lead Consultation Meeting'}"</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Mark the meeting as completed and record the final summary/discussion details to be indexed in the AI Knowledge Base.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Meeting Summary &amp; Key Decisions *</label>
                        <textarea
                          required
                          rows={6}
                          placeholder="Type meeting outcomes, notes, key choices the client made, next steps, and specific design requests..."
                          value={meetingSummary}
                          onChange={e => setMeetingSummary(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsConcludingMeeting(false);
                            setMeetingSummary('');
                          }}
                          disabled={meetingSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={meetingSubmitting || !meetingSummary.trim()}
                          className="bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-700 text-white"
                        >
                          {meetingSubmitting ? 'Saving...' : 'Conclude & Save to Knowledge Base'}
                        </Button>
                      </div>
                    </form>
                  ) : lead.next_meeting_schedule ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Meeting Title</label>
                          <h4 className="text-lg font-bold text-gray-800 mt-1">
                            {lead.next_meeting_title || 'Lead Consultation Meeting'}
                          </h4>
                        </div>

                        {lead.next_meeting_notes && (
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Agenda / Notes</label>
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-line bg-gray-50 p-3 rounded-lg border border-gray-100">
                              {lead.next_meeting_notes}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Host</label>
                            <div className="text-sm font-semibold text-gray-700 mt-1 flex items-center gap-2">
                              <span className="text-base">👤</span>
                              {lead.next_meeting_host || lead.assignee_name || 'Unassigned'}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Reminders</label>
                            <div className="text-sm font-semibold text-gray-700 mt-1 flex items-center gap-1.5">
                              <span className="text-green-600">✓</span> WhatsApp &amp; Email Enabled
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 p-5 rounded-xl border border-orange-100 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] text-orange-800 uppercase font-bold tracking-wider">Date &amp; Time</label>
                            <div className="text-sm font-bold text-gray-800 mt-1 flex items-center gap-2">
                              <span>📅</span>
                              {formatMeetingSchedule(lead.next_meeting_schedule)}
                            </div>
                          </div>
                          {lead.next_meeting_duration && (
                            <div>
                              <label className="text-[10px] text-orange-800 uppercase font-bold tracking-wider">Duration</label>
                              <div className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-2">
                                <span>⏱️</span>
                                {lead.next_meeting_duration} minutes
                              </div>
                            </div>
                          )}
                          {lead.next_meeting_type && (
                            <div>
                              <label className="text-[10px] text-orange-800 uppercase font-bold tracking-wider">Type / Location</label>
                              <div className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-2">
                                <span>📍</span>
                                {lead.next_meeting_type}
                              </div>
                            </div>
                          )}
                        </div>

                        {lead.next_meeting_link && (
                          <div className="pt-2">
                            <a
                              href={lead.next_meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors hover:shadow-lg cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              Join Call
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingMeeting(true)}
                          className="flex items-center gap-1 text-xs"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          Edit Meeting Details
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => setIsConcludingMeeting(true)}
                          className="flex items-center gap-1 text-xs bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-700 text-white"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Conclude Meeting
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <span className="text-4xl block mb-3">📅</span>
                      <h4 className="text-base font-bold text-gray-700">No Meetings Scheduled</h4>
                      <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">There are no upcoming meetings scheduled for this lead at the moment.</p>
                      <button
                        onClick={() => setIsEditingMeeting(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Schedule a Meeting
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => document.getElementById(`file-input-${leadId}`).click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) await uploadFile(file);
                  }}
                >
                  <input
                    id={`file-input-${leadId}`}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      if (e.target.files[0]) await uploadFile(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">Drag &amp; drop or click to upload</p>
                  <p className="text-xs text-gray-500">Floor plans, reference images, or proposal PDFs. Max 10MB.</p>
                </div>
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700 bg-gray-50">Uploaded Files</div>
                  <ul className="divide-y divide-gray-200 text-sm">
                    {files.length === 0 ? (
                      <li className="p-4 text-center text-gray-500">No files uploaded yet.</li>
                    ) : files.map(f => (
                      <li key={f.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-400">&#128206;</span>
                          <a href={f.download_url || f.storage_key} download={f.file_name} className="text-blue-600 hover:underline truncate text-sm font-medium">{f.file_name}</a>
                          <span className="text-xs text-gray-400 shrink-0">{f.file_size ? `${(f.file_size/1024).toFixed(0)}KB` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {(f.mime_type?.includes('image') || f.mime_type?.includes('pdf')) && (
                            <button 
                              onClick={() => handleParseFile(f.id)} 
                              className="text-xs text-primary hover:text-primary-dark font-medium mr-2"
                              title="Extract properties with AI"
                            >
                              ✨ Extract
                            </button>
                          )}
                          <button onClick={() => deleteFile(f.id)} className="text-gray-400 hover:text-red-500 shrink-0 text-lg leading-none">&times;</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {activeTab === 'estimates' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Quotes & Estimates</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={syncEstimates} title="Refresh estimates">
                      &#8635; Sync
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCreateEstimate}>
                      Generate Estimate
                    </Button>
                  </div>
                </div>
                {syncError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                    <strong>Sync Failed:</strong> {syncError}
                  </div>
                )}
                {estimates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
                    <p className="text-sm">No estimates generated yet.</p>
                    <p className="text-xs mt-1">Click "Generate Estimate" to create a new BOQ.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {estimates.map(est => (
                      <div key={est.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Estimate {est.estimator_reference_id}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={est.status === 'accepted' ? 'success' : est.status === 'sent' ? 'primary' : 'secondary'}>
                              {est.status}
                            </Badge>
                            <span className="text-xs text-gray-500">Created: {new Date(est.created_at).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-400">&bull;</span>
                            <span className="text-xs text-blue-600 font-medium">Last Synced: {new Date(est.updated_at || est.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">₹{est.total_amount ? Number(est.total_amount).toLocaleString() : '0'}</p>
                          {est.pdf_url && (
                            <a href={est.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">View PDF</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'inspirations' && (
              <InspirationBoard leadId={leadId} />
            )}

            {activeTab === 'twin' && (
              <AITwinTab leadId={leadId} lead={lead} />
            )}

            {activeTab === 'automations' && (
              <AutomationHistoryTab leadId={leadId} />
            )}
          </div>

          {/* STICKY FOOTER */}
          <div className="bg-white border-t border-gray-200 p-4 shrink-0 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>Reassign</Button>
              <Button variant="outline" size="sm" onClick={() => {}}>Park</Button>
              <Button variant="outline" size="sm" onClick={() => setIsPresentModalOpen(true)}>Log Presentation</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleArchiveToggle} className="text-gray-700 hover:bg-gray-50">
                {lead.status === 'archived' ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">Mark Lost</Button>

              {/* Show Convert button if logic matches a won or late stage */}
              {(lead.stage_id === 'won' || lead.stage_name === 'Won' || lead.stage_name === 'Booking' || lead.stage_id === 'booking') && (
                <Button variant="primary" size="sm" onClick={() => setIsConvertModalOpen(true)}>Convert to Project</Button>
              )}
            </div>
          </div>

          {/* MODALS */}
          {isConvertModalOpen && (
            <ConvertToProjectModal
              lead={lead}
              isOpen={isConvertModalOpen}
              onClose={() => setIsConvertModalOpen(false)}
              onConverted={(projectId) => {
                 toast.success('Successfully converted!');
                 onLeadUpdated?.(lead);
                 setIsConvertModalOpen(false);
                 onClose();
              }}
            />
          )}

          {isPresentModalOpen && (
            <DesignPresentationModal
              leadId={leadId}
              isOpen={isPresentModalOpen}
              onClose={() => setIsPresentModalOpen(false)}
              onLogged={fetchLead}
            />
          )}

          {isBuildingEstimate && (
            <EstimatorBuilder
              leadId={leadId}
              onCancel={() => setIsBuildingEstimate(false)}
              onSaved={() => {
                setIsBuildingEstimate(false);
                fetchEstimates();
              }}
            />
          )}

          {isAssignModalOpen && (
            <AssignDesignerModal
              leadId={leadId}
              currentAssigneeId={lead.assignee_id}
              isOpen={isAssignModalOpen}
              onClose={() => setIsAssignModalOpen(false)}
              onAssigned={(updatedLead) => {
                setLead(prev => ({ ...prev, ...updatedLead }));
                onLeadUpdated?.(updatedLead);
              }}
            />
          )}

          {isLeadFormOpen && (
            <LeadForm
              lead={lead}
              onClose={() => setIsLeadFormOpen(false)}
              onSave={(updatedLead) => {
                setLead(prev => ({ ...prev, ...updatedLead }));
                onLeadUpdated?.(updatedLead);
                setIsLeadFormOpen(false);
                fetchLead();
              }}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
