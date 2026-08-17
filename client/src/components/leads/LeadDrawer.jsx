/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../store/toastContext';
import { Button, Badge, Select, Modal } from '../ui';
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
import MarkLostModal from './MarkLostModal';
import { getLead, changeLeadStage, deleteLead, updateActivity, logActivity, getActivities, deleteActivity, restoreLead, permanentlyDeleteLead } from '../../api/leads';
import api from '../../api/axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { useConfirm } from '../../store/confirmContext';

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

const getMeetingCountdown = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  
  if (diffMs < 0) {
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    if (Math.abs(diffMs) < twoHoursInMs) {
      return '⏱️ In Progress';
    }
    return '📅 Past Meeting';
  }
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `⏱️ Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
  if (diffHours > 0) {
    return `⏱️ Starts in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
  if (diffMins > 0) {
    return `⏱️ Starts in ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
  return '⏱️ Starting now';
};

export default function LeadDrawer({ leadId, isOpen, onClose, onLeadUpdated, stages = [] }) {
  const { confirm } = useConfirm();

  const navigate = useNavigate();
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, tasks, followups, files
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isPresentModalOpen, setIsPresentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMarkLostModalOpen, setIsMarkLostModalOpen] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);

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
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState(null);
  const [concludeMode, setConcludeMode] = useState('ai'); // 'ai' or 'manual'
  const [meetingTranscript, setMeetingTranscript] = useState('');
  const [aiSummarizing, setAiSummarizing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiCoachFeedback, setAiCoachFeedback] = useState(null);
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

  const tabsRef = useRef(null);

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
  const [activityRefresh, setActivityRefresh] = useState(0);

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

  // Scroll active tab into view when activeTab changes
  useEffect(() => {
    if (tabsRef.current) {
      const activeElement = tabsRef.current.querySelector('.bg-blue-50');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

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

  const fetchMeetingsList = async () => {
    if (!leadId) return;
    setMeetingsLoading(true);
    try {
      const res = await getActivities(leadId, { type: 'meeting', limit: 100 });
      if (res.success) {
        setMeetings(res.data);
      } else if (Array.isArray(res)) {
        setMeetings(res);
      } else {
        setMeetings(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setMeetingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'meeting-schedule' && leadId) {
      fetchMeetingsList();
    }
  }, [activeTab, leadId]);

  const handleRestore = () => {
    setIsRestoreConfirmOpen(true);
  };

  const executeRestore = async () => {
    setActionSubmitting(true);
    try {
      await restoreLead(leadId);
      toast.success('Lead restored successfully');
      setIsRestoreConfirmOpen(false);
      fetchLead();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore lead');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePermanentDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const executePermanentDelete = async () => {
    setActionSubmitting(true);
    try {
      await permanentlyDeleteLead(leadId);
      toast.success('Lead permanently deleted');
      setIsDeleteConfirmOpen(false);
      onClose();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      console.error(err);
      toast.error('Failed to permanently delete lead');
    } finally {
      setActionSubmitting(false);
    }
  };

  const fetchLead = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await getLead(leadId);
      if (res.success) {
        setLead(res.data);
        return res.data;
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load lead details');
    } finally {
      if (showLoading) setLoading(false);
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
        scheduledAt: scheduledAt,
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
      const freshLead = await fetchLead();
      fetchMeetingsList();
      
      // Only call onLeadUpdated if we actually got a lead back, and explicitly pass the object
      if (onLeadUpdated && freshLead && freshLead.id) {
        onLeadUpdated(freshLead);
      } else if (onLeadUpdated && lead && lead.id) {
        onLeadUpdated(lead);
      }
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to save meeting details');
    } finally {
      setMeetingSubmitting(false);
    }
  };


  const handleDeleteMeeting = (meetingId) => {
    setMeetingToDelete(meetingId);
  };

  const handleDeleteMeetingConfirm = async () => {
    if (!meetingToDelete) return;
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deleting this meeting');
      return;
    }
    setMeetingSubmitting(true);
    try {
      await deleteActivity(leadId, meetingToDelete, { reason: deleteReason.trim() });
      toast.success('Meeting deleted successfully');
      setMeetingToDelete(null);
      setDeleteReason('');
      const freshLead = await fetchLead();
      fetchMeetingsList();
      if (onLeadUpdated) onLeadUpdated(freshLead || lead);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete meeting');
    } finally {
      setMeetingSubmitting(false);
    }
  };


  const handleAiSummarize = async (e) => {
    if (e) e.preventDefault();
    if (!meetingTranscript.trim()) {
      toast.error('Please enter meeting notes or transcript for AI analysis');
      return;
    }
    setAiSummarizing(true);
    setAiResult(null);
    setAiCoachFeedback(null);
    try {
      const res = await api.post(`/leads/${leadId}/meeting-summary`, {
        transcript: meetingTranscript,
        meetingId: lead.next_meeting_id
      });
      if (res.data.success) {
        const data = res.data.data;
        setAiResult(data);
        if (data.sales_coach) {
          setAiCoachFeedback(data.sales_coach);
        }
        toast.success('Meeting concluded and tasks generated via Gemini AI!');
        
        // Refresh local listings
        const freshLead = await fetchLead();
        fetchMeetingsList();
        if (onLeadUpdated) onLeadUpdated(freshLead || lead);
      } else {
        toast.error('Failed to parse summary');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze notes with AI');
    } finally {
      setAiSummarizing(false);
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
      const freshLead = await fetchLead();
      fetchMeetingsList();
      if (onLeadUpdated) onLeadUpdated(freshLead || lead);
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
    if (lead?.deleted_at) return;
    setLead(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = async (field, value) => {
    if (lead?.deleted_at) return;
    setSaveStatus('saving');
    try {
      const res = await api.patch(`/leads/${leadId}`, { [field]: value, updated_at: lead.updated_at });
      if (res.data?.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
        setLead(prev => ({ ...prev, updated_at: res.data.data.updated_at }));
        onLeadUpdated?.(res.data.data);
        if (field === 'score') setLead(prev => ({ ...prev, score: value }));
        
        try {
          const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const notesText = field === 'lifestyle_preferences' 
            ? 'Updated lifestyle & design preferences' 
            : `Changed ${fieldName} to "${value}"`;
          await logActivity(leadId, {
            type: 'note',
            title: `Lead Updated: ${fieldName}`,
            notes: notesText
          });
          setActivityRefresh(prev => prev + 1);
        } catch (e) {
          console.error('Failed to log field update activity', e);
        }
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
    if (lead?.deleted_at) return;
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
        
        try {
          const stageName = stages.find(s => s.id === newStageId)?.name || newStageId;
          await logActivity(leadId, {
            type: 'note',
            title: `Stage Changed`,
            notes: `Lead moved to stage: ${stageName}`
          });
          setActivityRefresh(prev => prev + 1);
        } catch (e) {
          console.error('Failed to log stage change activity', e);
        }
      }
    } catch (e) {
      setLead(prev => ({ ...prev, stage_id: oldStageId }));
      toast.error('Failed to update stage. Reverted.');
    }
  };

  const handleArchiveToggle = async () => {
    if (lead?.deleted_at) return;
    const newStatus = lead.status === 'archived' ? 'active' : 'archived';
    try {
      const res = await api.patch(`/leads/${leadId}`, { status: newStatus, updated_at: lead.updated_at });
      if (res.data?.success) {
        toast.success(`Lead ${newStatus === 'archived' ? 'archived' : 'unarchived'} successfully`);
        setLead(prev => ({ ...prev, status: newStatus, updated_at: res.data.data.updated_at }));
        onLeadUpdated?.(res.data.data);
        
        try {
          await logActivity(leadId, {
            type: 'note',
            title: `Lead ${newStatus === 'archived' ? 'Archived' : 'Unarchived'}`,
            notes: `Lead status changed to ${newStatus}`
          });
          setActivityRefresh(prev => prev + 1);
        } catch (e) {
          console.error('Failed to log archive activity', e);
        }
      }
    } catch (e) {
      if (e.response?.data?.error?.code === 'OPTIMISTIC_LOCK_FAILED') {
        toast.error('This lead was modified by someone else. Please refresh to see the latest changes.');
      } else {
        toast.error(`Failed to ${newStatus === 'archived' ? 'archive' : 'unarchive'} lead`);
      }
    }
  };

  const handleDelete = () => {
    setIsMarkLostModalOpen(true);
  };

  const executeMarkLost = async (reason) => {
    setActionSubmitting(true);
    try {
      await api.patch(`/leads/${leadId}`, { lost_reason: reason, updated_at: lead.updated_at });
      await deleteLead(leadId);
      toast.success('Lead marked as lost successfully');
      setIsMarkLostModalOpen(false);
      onClose();
      if (onLeadUpdated) onLeadUpdated(null);
      else window.location.reload();
    } catch (e) {
      toast.error('Failed to mark lead as lost.');
    } finally {
      setActionSubmitting(false);
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

  const renderDeletedLeadView = () => {
    const assigneeName = lead.assignee_name || (lead.assignee_id ? users.find(u => u.id === lead.assignee_id)?.name : null);
    const displayName = assigneeName || 'Unassigned';

    return (
      <div className="flex flex-col h-full bg-transparent overflow-hidden w-full">
        {/* BANNER */}
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-start justify-between text-sm shrink-0 shadow-sm z-20">
          <div className="flex items-start gap-4 text-red-700 font-semibold">
            <div className="mt-0.5 bg-red-100 p-2 rounded-full text-red-600 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <div>
              <p className="text-base font-bold text-red-800">This lead has been deleted</p>
              {lead.lost_reason && (
                <div className="mt-3 bg-white border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl font-medium shadow-sm max-w-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                  <span className="font-bold text-red-500 uppercase text-[10px] tracking-widest block mb-1">Reason for loss</span>
                  <p className="leading-relaxed">{lead.lost_reason}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestore}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
            >
              Restore Lead
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handlePermanentDelete}
            >
              Permanently Delete
            </Button>
          </div>
        </div>

        {/* HEADER */}
        <div className="border-b border-gray-200 px-6 pt-4 pb-3 shrink-0 shadow-sm relative z-10" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <button 
              onClick={onClose} 
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors shrink-0 flex items-center justify-center"
              title="Back to leads list"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between mb-2 gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-800 pb-0.5">{lead.name}</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-gray-600 font-mono text-xs">{lead.lead_number || `LD-${String(lead.id).substring(0,4).toUpperCase()}`}</Badge>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wide">DELETED</span>
            <ScoreBadge score={lead.score} />
            {lead.win_probability != null && (
              <Badge variant="outline" className={`font-semibold ${lead.win_probability > 70 ? 'text-green-700 bg-green-100 border-green-200' : lead.win_probability > 30 ? 'text-yellow-700 bg-yellow-100 border-yellow-200' : 'text-gray-700 bg-gray-100 border-gray-200'}`}>
                {lead.win_probability}% Win Probability
              </Badge>
            )}
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1 text-xs font-medium text-gray-700 opacity-65">
              {lead.assignee_avatar ? (
                <img src={lead.assignee_avatar} alt="" className="w-4 h-4 rounded-full" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold" style={{fontSize: '8px'}}>
                  {displayName[0].toUpperCase()}
                </div>
              )}
              {displayName}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Contact Details */}
            <div className="p-6 rounded-2xl shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
              <h3 className="text-sm font-bold text-gray-650 uppercase tracking-wider mb-4 border-b border-gray-200/60 pb-2">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-28">Phone</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.phone || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-28">Email</span>
                  <span className="flex-1 text-base font-semibold text-gray-850 px-3">{lead.email || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-28">Source</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.source || '—'}</span>
                </div>
              </div>
            </div>

            {/* Property Details */}
            <div className="p-6 rounded-2xl shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
              <h3 className="text-sm font-bold text-gray-650 uppercase tracking-wider mb-4 border-b border-gray-200/60 pb-2">Property Details</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-32">Property Type</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.property_type || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-32">Address</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.locality || '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-32">Budget Max</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.budget_max ? `₹${Number(lead.budget_max).toLocaleString()}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-base text-gray-500 w-32">Carpet Area</span>
                  <span className="flex-1 text-base font-semibold text-gray-800 px-3">{lead.carpet_area_sqft ? `${lead.carpet_area_sqft} sq.ft` : '—'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Notes & Extra Info */}
          <div className="p-6 rounded-2xl shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
            <h3 className="text-sm font-bold text-gray-650 uppercase tracking-wider mb-3 border-b border-gray-200/60 pb-2">Notes</h3>
            <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed px-1">{lead.notes || 'No notes available for this lead.'}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden relative">
      {loading || !lead ? (
        <div className="p-6 flex items-center justify-center text-gray-500 h-full">Loading lead details...</div>
      ) : lead.deleted_at ? (
        renderDeletedLeadView()
      ) : (
        <div className="flex flex-col h-full transition-all bg-white">
          {lead?.deleted_at && (
            <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-sm shrink-0">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span>This lead has been deleted.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRestore}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  Restore Lead
                </button>
                <button
                  onClick={handlePermanentDelete}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          )}

          {/* HEADER */}
          <div className="border-b border-gray-200 px-6 pt-4 pb-3 shrink-0 shadow-sm relative z-10" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
              <button 
                onClick={onClose} 
                className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors shrink-0 flex items-center justify-center"
                title="Back to leads list"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between mb-2 gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={lead.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  onBlur={(e) => handleFieldBlur('name', e.target.value)}
                  disabled={!!lead.deleted_at}
                  className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full pb-0.5 transition-colors"
                  style={{ color: 'var(--color-text, inherit)' }}
                  placeholder="Lead Name"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-2">
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
                  <button type="button" onClick={async () => setEditingScore(false)} className="text-xs text-gray-500">&#x2715;</button>
                </form>
              ) : (
                <div className="relative group flex items-center">
                  <span onClick={async () => setEditingScore(true)} className="cursor-pointer">
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
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-48">
                  <select
                    value={lead.stage_id}
                    onChange={handleStageSelect}
                    disabled={!!lead.deleted_at}
                    className="block w-full pl-3 pr-10 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                  >
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                  {(() => {
                    const assigneeName = lead.assignee_name || (lead.assignee_id ? users.find(u => u.id === lead.assignee_id)?.name : null);
                    const displayName = assigneeName || 'Unassigned';
                    
                    return (
                      <div 
                        className={`flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1 text-xs font-medium text-gray-700 ${!lead.deleted_at ? 'cursor-pointer hover:bg-gray-200' : 'opacity-65'}`} 
                        title={!lead.deleted_at ? "Reassign" : ""}
                        onClick={() => { if (!lead.deleted_at) setIsAssignModalOpen(true); }}
                      >
                        {lead.assignee_avatar ? (
                          <img src={lead.assignee_avatar} alt="" className="w-4 h-4 rounded-full" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-bold" style={{fontSize: '8px'}}>
                            {displayName[0].toUpperCase()}
                          </div>
                        )}
                        {displayName}
                      </div>
                    );
                  })()}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500 font-medium">
                  {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
                  {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Saved</span>}
                  {saveStatus === 'error' && <span className="text-red-600">Save failed</span>}
                </div>
                {lead.status === 'converted' && lead.converted_to_project_id ? (
                  <Button variant="outline" size="sm" onClick={async () => navigate(`/projects/${lead.converted_to_project_id}`)}>View Project</Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={async () => setIsConvertModalOpen(true)}>Convert to Project</Button>
                )}
              </div>
            </div>
            {errorMsg && <div className="mt-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">{errorMsg}</div>}
          </div>

          {/* TABS NAVIGATION */}
          <div className="px-6 shrink-0 mt-4" style={{ background: 'transparent' }}>
            <nav 
              ref={tabsRef}
              className="flex gap-4 overflow-x-auto custom-scrollbar p-2 bg-white border border-gray-200 rounded-xl shadow-sm"
            >
              {['overview', 'activity', 'communications', 'tasks', 'followups', 'meeting-schedule', 'stakeholders', 'preferences', 'inspirations', 'estimates', 'negotiation', 'files', 'ai-copilot', 'knowledge-base', 'twin', 'automations'].map(tab => (
                <button
                  key={tab}
                  onClick={(e) => {
                    setActiveTab(tab);
                  }}
                  className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-base transition-all ${
                    activeTab === tab
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {tab === 'knowledge-base' ? 'AI Knowledge Base' : tab === 'automations' ? 'Automation History' : tab === 'meeting-schedule' ? 'Meeting Schedule' : tab.replace('-', ' ')}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB CONTENT (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* COLUMN 1: Data Entry & Details */}
                <div className="space-y-8 flex flex-col">
                  {/* Contact Info */}
                  <div className="relative overflow-hidden p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-[var(--color-border)] bg-[var(--color-surface)] group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10 flex justify-between items-center mb-5">
                      <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                        Contact Info
                      </h4>
                      <button onClick={async () => setIsLeadFormOpen(true)} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    <div className="space-y-4 relative z-10">
                      <div className="flex items-center group/field">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mr-4">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                        </div>
                        <div className="flex-1 border border-transparent group-hover/field:border-[var(--color-border)] rounded-xl bg-gray-50/50 group-hover/field:bg-[var(--color-surface)] transition-all">
                          <input
                            type="text" value={lead.phone || ''}
                            onChange={e => handleFieldChange('phone', e.target.value)}
                            onBlur={e => handleFieldBlur('phone', e.target.value)}
                            className="w-full text-base font-semibold text-[var(--color-text)] bg-transparent border-none focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 placeholder-gray-400 outline-none"
                            placeholder="Add phone number"
                          />
                        </div>
                      </div>
                      <div className="flex items-center group/field">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mr-4">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        </div>
                        <div className="flex-1 border border-transparent group-hover/field:border-[var(--color-border)] rounded-xl bg-gray-50/50 group-hover/field:bg-[var(--color-surface)] transition-all">
                          <input
                            type="email" value={lead.email || ''}
                            onChange={e => handleFieldChange('email', e.target.value)}
                            onBlur={e => handleFieldBlur('email', e.target.value)}
                            className="w-full text-base font-semibold text-[var(--color-text)] bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 placeholder-gray-400 outline-none"
                            placeholder="Add email address"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Property Details */}
                  <div className="relative overflow-hidden p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-[var(--color-border)] bg-[var(--color-surface)] group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10 flex justify-between items-center mb-5">
                      <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                        Property Details
                      </h4>
                      <button onClick={async () => setIsLeadFormOpen(true)} className="text-sm text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-5 gap-y-6 relative z-10">
                      {/* Property Type */}
                      <div className="group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                          Type of property
                        </label>
                        <select
                          value={lead.property_type || ''}
                          onChange={e => handleFieldChange('property_type', e.target.value)}
                          onBlur={e => handleFieldBlur('property_type', e.target.value)}
                          className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        >
                          <option value="">Select...</option>
                          <option value="1bhk">1 BHK</option>
                          <option value="2bhk">2 BHK</option>
                          <option value="3bhk">3 BHK</option>
                          <option value="4bhk">4 BHK</option>
                          <option value="5bhk">5 BHK</option>
                        </select>
                      </div>

                      {/* Segment */}
                      <div className="group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                          Segment
                        </label>
                        <select
                          value={lead.segment || ''}
                          onChange={e => handleFieldChange('segment', e.target.value)}
                          onBlur={e => handleFieldBlur('segment', e.target.value)}
                          className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        >
                          <option value="">Select...</option>
                          <option value="residential">Residential</option>
                          <option value="commercial">Commercial</option>
                          <option value="hospitality">Hospitality</option>
                          <option value="retail">Retail</option>
                        </select>
                      </div>

                      {/* Scope */}
                      <div className="col-span-2 group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                          Product Scope
                        </label>
                        <div className="text-sm font-semibold shadow-sm">
                          <Select
                            multi
                            options={[
                              { value: 'kitchen', label: 'Kitchen' },
                              { value: 'bedroom', label: 'Bedroom' },
                              { value: 'wardrobe', label: 'Wardrobe' },
                              { value: 'fullhouse', label: 'Full House' },
                              { value: 'living_room', label: 'Living Room' },
                              { value: 'bathroom', label: 'Bathroom' },
                              { value: 'office', label: 'Office / Study' },
                              { value: 'false_ceiling', label: 'False Ceiling' },
                              { value: 'flooring', label: 'Flooring' },
                              { value: 'painting', label: 'Painting' },
                              { value: 'custom_furniture', label: 'Custom Furniture' }
                            ]}
                            value={typeof lead.scope === 'string' && lead.scope ? lead.scope.split(',') : (Array.isArray(lead.scope) ? lead.scope : [])}
                            onChange={selectedArray => {
                              const newValue = selectedArray.join(',');
                              handleFieldChange('scope', newValue);
                              handleFieldBlur('scope', newValue);
                            }}
                            placeholder="Select products..."
                          />
                        </div>
                      </div>

                      {/* Property Name */}
                      <div className="col-span-2 group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          Property Name / Complex
                        </label>
                        <input
                          type="text" value={lead.property_name || ''}
                          onChange={e => handleFieldChange('property_name', e.target.value)}
                          onBlur={e => handleFieldBlur('property_name', e.target.value)}
                          className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all"
                          placeholder="e.g. Prestige Shantiniketan"
                        />
                      </div>

                      {/* Address */}
                      <div className="col-span-2 group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>
                          Locality / Address
                        </label>
                        <input
                          type="text" value={lead.locality || ''}
                          onChange={e => handleFieldChange('locality', e.target.value)}
                          onBlur={e => handleFieldBlur('locality', e.target.value)}
                          className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                          placeholder="e.g. Indiranagar, Bangalore"
                        />
                      </div>

                      {/* Carpet Area */}
                      <div className="group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                          Carpet Area
                        </label>
                        <div className="relative">
                          <input
                            type="number" value={lead.carpet_area_sqft || ''}
                            onChange={e => handleFieldChange('carpet_area_sqft', e.target.value)}
                            onBlur={e => handleFieldBlur('carpet_area_sqft', e.target.value)}
                            className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 pr-12 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            placeholder="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none uppercase">sq.ft</span>
                        </div>
                      </div>

                      {/* Budget */}
                      <div className="group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Budget Max
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold pointer-events-none">&#8377;</span>
                          <input
                            type="number" value={lead.budget_max || ''}
                            onChange={e => handleFieldChange('budget_max', e.target.value)}
                            onBlur={e => handleFieldBlur('budget_max', e.target.value)}
                            className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 pl-7 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                            placeholder="1500000"
                          />
                        </div>
                      </div>

                      {/* Possession Date */}
                      <div className="col-span-2 group/input">
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                            <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Possession Date
                          </label>
                          <button 
                            type="button" 
                            onClick={async () => setIsPossessionManual(!isPossessionManual)} 
                            className="text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors"
                          >
                            {isPossessionManual ? 'Use Calendar' : 'Manual Entry'}
                          </button>
                        </div>
                        {isPossessionManual ? (
                          <input
                            type="text" value={lead.possession_month || ''}
                            onChange={e => handleFieldChange('possession_month', e.target.value)}
                            onBlur={e => handleFieldBlur('possession_month', e.target.value)}
                            className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                            placeholder="e.g. Q4 2026, Next year"
                          />
                        ) : (
                          <div className="relative">
                            <DatePicker
                              selected={lead.possession_month ? new Date(lead.possession_month) : null}
                              onChange={(date) => {
                                if (date) {
                                  const tzoffset = date.getTimezoneOffset() * 60000;
                                  const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 10);
                                  handleFieldChange('possession_month', localISOTime);
                                  handleFieldBlur('possession_month', localISOTime);
                                } else {
                                  handleFieldChange('possession_month', '');
                                  handleFieldBlur('possession_month', '');
                                }
                              }}
                              dateFormat="MMMM d, yyyy"
                              placeholderText="Select Date"
                              className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 pr-10 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all cursor-pointer shadow-sm"
                              wrapperClassName="w-full"
                              popperPlacement="bottom-start"
                              calendarClassName="shadow-2xl rounded-2xl border-none font-sans text-sm p-2"
                              popperProps={{ strategy: "fixed" }}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-rose-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preferences & Tracking */}
                  <div className="relative overflow-hidden p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-[var(--color-border)] bg-[var(--color-surface)] group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="relative z-10 flex justify-between items-center mb-5">
                      <h4 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                        Preferences
                      </h4>
                      <button onClick={async () => setIsLeadFormOpen(true)} className="text-sm text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        Edit
                      </button>
                    </div>
                    
                    <div className="space-y-4 relative z-10">
                      {/* DNC Toggle */}
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-red-50/50 transition-colors border border-transparent hover:border-red-100 cursor-pointer group/toggle">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lead.dnc_flag ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 group-hover/toggle:text-gray-600'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                          </div>
                          <div>
                            <span className="text-sm font-bold text-[var(--color-text)] block">Do Not Contact (DNC)</span>
                            <span className="text-xs text-[var(--color-text-secondary)]">Opt-out of all communications</span>
                          </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${lead.dnc_flag ? 'bg-red-500' : 'bg-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={lead.dnc_flag || false}
                            onChange={e => {
                              handleFieldChange('dnc_flag', e.target.checked);
                              handleFieldBlur('dnc_flag', e.target.checked);
                            }}
                            className="sr-only peer"
                          />
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${lead.dnc_flag ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                      </label>

                      {/* Consent Toggle */}
                      <label className="flex items-center justify-between p-3 rounded-xl hover:bg-green-50/50 transition-colors border border-transparent hover:border-green-100 cursor-pointer group/toggle">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${lead.consent_whatsapp ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 group-hover/toggle:text-gray-600'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                          </div>
                          <div>
                            <span className="text-sm font-bold text-[var(--color-text)] block">WhatsApp Consent</span>
                            <span className="text-xs text-[var(--color-text-secondary)]">Opt-in for WhatsApp messages</span>
                          </div>
                        </div>
                        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${lead.consent_whatsapp ? 'bg-green-500' : 'bg-gray-200'}`}>
                          <input
                            type="checkbox"
                            checked={lead.consent_whatsapp || false}
                            onChange={e => {
                              handleFieldChange('consent_whatsapp', e.target.checked);
                              handleFieldBlur('consent_whatsapp', e.target.checked);
                            }}
                            className="sr-only peer"
                          />
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${lead.consent_whatsapp ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                      </label>

                      {/* Competitor */}
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)] group/input">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wide">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          Competitor Mentioned
                        </label>
                        <input
                          type="text" value={lead.competitor_mentioned || ''}
                          onChange={e => handleFieldChange('competitor_mentioned', e.target.value)}
                          onBlur={e => handleFieldBlur('competitor_mentioned', e.target.value)}
                          className="w-full text-sm font-semibold border border-[var(--color-border)] rounded-xl p-2.5 bg-gray-50/50 group-hover/input:bg-[var(--color-surface)] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                          placeholder="e.g. Livspace, HomeLane"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* COLUMN 2: AI & Insights */}
                <div className="space-y-6 flex flex-col md:border-l md:border-gray-100 md:pl-6 xl:border-l-0 xl:pl-0">
                  <LeadQualificationScore lead={lead} />
                  
                  {/* Upcoming Meeting */}
                  {lead.next_meeting_schedule && (
                    <div className="p-6 rounded-2xl shadow-sm transition-all" style={{ background: 'rgba(255, 165, 0, 0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 165, 0, 0.3)' }}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          Upcoming Meeting
                        </h4>
                        <span className="text-xs font-bold text-orange-700 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded uppercase tracking-wide">
                          Scheduled
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="text-base font-semibold text-gray-800">
                          {lead.next_meeting_title || 'Lead Consultation Meeting'}
                        </div>
                        <div className="flex flex-col gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">📅</span>
                            <span className="font-medium text-gray-700">{formatMeetingSchedule(lead.next_meeting_schedule)}</span>
                            {lead.next_meeting_duration && (
                              <span className="text-gray-400">({lead.next_meeting_duration} mins)</span>
                            )}
                          </div>
                          {lead.next_meeting_type && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">📍</span>
                              <span className="font-medium text-gray-700">{lead.next_meeting_type}</span>
                            </div>
                          )}
                          {lead.next_meeting_host && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">👤</span>
                              <span className="font-medium text-gray-700">Host: {lead.next_meeting_host}</span>
                            </div>
                          )}
                        </div>
                        
                        {lead.next_meeting_link && (
                          <div className="pt-3 border-t border-orange-100 mt-3">
                            <a
                              href={lead.next_meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              Join Call / Open Link
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* AI Insights Section */}
                  {(lead.win_probability !== undefined || lead.ai_score_breakdown) && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          AI Insights
                        </h4>
                        {lead.win_probability !== undefined && (
                          <Badge variant="outline" className={`font-semibold text-xs px-2.5 py-1 ${lead.win_probability > 70 ? 'text-green-700 bg-green-100 border-green-200' : lead.win_probability > 30 ? 'text-yellow-700 bg-yellow-100 border-yellow-200' : 'text-gray-700 bg-gray-100 border-gray-200'}`}>
                            {lead.win_probability}% Win Probability
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-5">
                        <div className="p-3 rounded-lg shadow-sm border transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Next Action</div>
                          <div className="text-base font-semibold text-gray-800">{lead.ai_recommendation || 'Follow up'}</div>
                        </div>
                        <div className="p-3 rounded-lg shadow-sm border transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Budget Confidence</div>
                          <div className="text-base font-semibold text-gray-800">{lead.budget_confidence || 'High'}</div>
                        </div>
                        <div className="p-3 rounded-lg shadow-sm border transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Decision Maker</div>
                          <div className="text-base font-semibold text-gray-800">{lead.decision_maker || 'Spouse'}</div>
                        </div>
                        <div className="p-3 rounded-lg shadow-sm border transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Risk Level</div>
                          <div className="text-base font-semibold text-gray-800">{lead.risk_level || 'Low'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* BUYING INTENT WIDGET */}
                  <div className="bg-orange-50/50 p-6 rounded-2xl shadow-sm border border-orange-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        Buying Intent Engine
                      </h4>
                      <Button variant="outline" size="sm" onClick={fetchBuyingIntent} disabled={intentLoading} className="text-xs py-1.5 h-8">
                        {intentLoading ? 'Analyzing...' : 'Analyze Intent'}
                      </Button>
                    </div>
                    {buyingIntent ? (
                      <div className="p-4 rounded-lg border flex items-center justify-between shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                        <div>
                          <div className="text-sm text-gray-500 uppercase font-bold mb-1">Predicted Intent</div>
                          <div className={`text-xl font-bold flex items-center gap-2 ${
                            buyingIntent.intent === 'Hot' ? 'text-red-600' : 
                            buyingIntent.intent === 'Warm' ? 'text-orange-500' : 'text-blue-500'
                          }`}>
                            {buyingIntent.intent === 'Hot' && '🔥 '}
                            {buyingIntent.intent === 'Warm' && '☀️ '}
                            {buyingIntent.intent === 'Cold' && '❄️ '}
                            {buyingIntent.intent} ({buyingIntent.confidence}%)
                          </div>
                          <div className="text-sm text-gray-700 mt-2">{buyingIntent.reason}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-orange-600/70 italic text-center py-4 bg-white/40 rounded-lg">
                        Click analyze to run the AI intent prediction model.
                      </div>
                    )}
                  </div>

                  {/* REFERRAL NETWORK WIDGET */}
                  <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-2xl">🤝</span>
                      <h3 className="text-base font-bold text-indigo-900 uppercase tracking-wider">Referral Network</h3>
                    </div>
                    {lead.referrals && lead.referrals.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-indigo-200 pb-3 mb-4">
                          <div className="text-sm text-indigo-600 font-bold uppercase">Total Referrals: {lead.referrals.length}</div>
                          <div className="text-sm text-indigo-600 font-bold uppercase">
                            Value: ₹{(lead.referrals.reduce((sum, r) => sum + (parseFloat(r.budget_max) || 0), 0)).toLocaleString()}
                          </div>
                        </div>
                        {lead.referrals.map(ref => (
                          <div key={ref.id} className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-indigo-50">
                            <div>
                              <div className="font-semibold text-gray-900 text-base">{ref.name}</div>
                              <div className="text-sm text-gray-500 mt-1">{ref.stage_name} • {new Date(ref.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="text-base font-bold text-gray-700">
                              {ref.budget_max ? `₹${Number(ref.budget_max).toLocaleString()}` : 'TBD'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-base text-indigo-400 text-center py-6 bg-white/50 rounded-lg border border-dashed border-indigo-200">
                        No referrals recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMN 3: Timeline & Checklist */}
                <div className="space-y-6 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-gray-100 xl:pl-8">
                  <DiscoveryCallChecklist lead={lead} onUpdate={fetchLead} />
                </div>
              </div>
            )}
            
            {activeTab === 'negotiation' && (
              <NegotiationDesk leadId={leadId} lead={lead} onUpdate={fetchLead} />
            )}

            {activeTab === 'ai-copilot' && (
              <AICopilotTab leadId={leadId} onRefresh={fetchLead} />
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
              <div className="space-y-6">
                {/* MOOD TRACKER WIDGET */}
                <div className="bg-pink-50/50 p-6 rounded-2xl shadow-sm border border-pink-100 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-pink-800 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      AI Mood Tracker
                    </h4>
                    <Button variant="outline" size="sm" onClick={fetchMood} disabled={moodLoading} className="text-xs py-1.5 h-8">
                      {moodLoading ? 'Analyzing...' : 'Analyze Mood'}
                    </Button>
                  </div>
                  {mood ? (
                    <div className="p-4 rounded-lg border shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-4xl">{mood.emoji}</div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Current Mood</div>
                          <div className="text-xl font-bold text-gray-900">{mood.mood}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 bg-pink-50 p-3 rounded-md border border-pink-100 italic">
                        <span className="font-semibold text-pink-800 not-italic mr-1">Coach Tip:</span>
                        {mood.tip}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-pink-600/70 italic text-center py-4 bg-white/40 rounded-lg">
                      Click analyze to assess the prospect's emotional state based on recent activities.
                    </div>
                  )}
                </div>

                <ActivityTimeline 
                  leadId={leadId} 
                  refreshTrigger={activityRefresh} 
                  onActivityLogged={async () => {
                    const freshLead = await fetchLead();
                    fetchMeetingsList();
                    if (onLeadUpdated) onLeadUpdated(freshLead || lead);
                  }}
                />
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
              <div className="space-y-6 animate-fadeIn">
                
                {/* 1. MAIN MEETING CONTROL CENTER */}
                <div className="p-6 rounded-2xl shadow-sm transition-all" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
                  
                  {/* HEADER */}
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span>📅</span> Meetings Hub
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Schedule client consultations, log summaries, and get AI Sales Coaching.</p>
                    </div>
                    {!isEditingMeeting && !isConcludingMeeting && (
                      <button
                        onClick={async () => setIsEditingMeeting(true)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>+</span> Schedule Meeting
                      </button>
                    )}
                  </div>

                  {/* WORKSPACES */}
                  {isEditingMeeting ? (
                    <form onSubmit={handleMeetingSubmit} className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Meeting Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Initial Consultation, BOQ Review"
                            value={meetingForm.title}
                            onChange={e => setMeetingForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Meeting Type</label>
                          <select
                            value={meetingForm.meeting_type}
                            onChange={e => setMeetingForm(prev => ({ ...prev, meeting_type: e.target.value }))}
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Google Meet">Google Meet</option>
                            <option value="In-Person Site Visit">In-Person Site Visit</option>
                            <option value="Phone Call">Phone Call</option>
                            <option value="WhatsApp Call">WhatsApp Call</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date *</label>
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
                              className="w-full text-base border border-gray-300 rounded-lg p-2 pr-10 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-blue-400 shadow-sm transition-colors"
                              wrapperClassName="w-full"
                              popperPlacement="bottom-start"
                              calendarClassName="shadow-xl rounded-xl border-gray-200 font-sans text-base"
                              popperProps={{ strategy: "fixed" }}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-blue-500">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Time *</label>
                          <DatePicker
                            selected={meetingForm.time ? new Date(`2000-01-01T${meetingForm.time}`) : null}
                            onChange={(date) => {
                              if (date) {
                                const hours = date.getHours().toString().padStart(2, '0');
                                const minutes = date.getMinutes().toString().padStart(2, '0');
                                setMeetingForm(prev => ({ ...prev, time: `${hours}:${minutes}` }));
                              } else {
                                setMeetingForm(prev => ({ ...prev, time: '' }));
                              }
                            }}
                            showTimeSelect
                            showTimeSelectOnly
                            timeIntervals={15}
                            timeCaption="Time"
                            dateFormat="h:mm aa"
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholderText="Select time"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Duration</label>
                          <select
                            value={meetingForm.duration}
                            onChange={e => setMeetingForm(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
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
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Host Assignee</label>
                          <select
                            value={meetingForm.meeting_host}
                            onChange={e => setMeetingForm(prev => ({ ...prev, meeting_host: e.target.value }))}
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="">Select Host / Assignee</option>
                            {users.map(u => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {meetingForm.meeting_type === 'Google Meet' && (
                          <div className="col-span-2">
                            <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Video Call Link</label>
                            <input
                              type="url"
                              placeholder="https://meet.google.com/..."
                              value={meetingForm.meeting_link}
                              onChange={e => setMeetingForm(prev => ({ ...prev, meeting_link: e.target.value }))}
                              className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">Leave empty to auto-generate a Google Meet link when selected as the type.</p>
                          </div>
                        )}

                        <div className="col-span-2">
                          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Agenda / Description</label>
                          <textarea
                            rows={3}
                            placeholder="Describe meeting agenda, files to bring, or client requirements..."
                            value={meetingForm.notes}
                            onChange={e => setMeetingForm(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full text-base border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={meetingForm.reminders}
                              onChange={e => setMeetingForm(prev => ({ ...prev, reminders: e.target.checked }))}
                              className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                            />
                            <span className="text-sm font-semibold text-gray-700">Send WhatsApp &amp; Email reminders to the client</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
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
                    <div className="space-y-5 pt-2">
                      <div className="bg-green-50/50 p-5 rounded-xl border border-green-200">
                        <h4 className="text-base font-bold text-green-800 flex items-center gap-1.5">
                          <span>✅</span> Conclude "{lead.next_meeting_title || 'Lead Consultation Meeting'}"
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Select the conclusion method. The AI Summarizer automatically extracts tasks and logs feedback.
                        </p>
                      </div>

                      {/* WORKSPACE TOGGLES */}
                      <div className="flex bg-gray-100 p-1 rounded-lg max-w-sm">
                        <button
                          type="button"
                          onClick={() => setConcludeMode('ai')}
                          className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition-all ${concludeMode === 'ai' ? 'bg-white shadow-sm text-blue-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                          🤖 AI Summarizer & Coach
                        </button>
                        <button
                          type="button"
                          onClick={() => setConcludeMode('manual')}
                          className={`flex-1 text-center py-2 text-xs font-bold rounded-md transition-all ${concludeMode === 'manual' ? 'bg-white shadow-sm text-blue-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'}`}
                        >
                          📝 Manual Notes
                        </button>
                      </div>

                      {concludeMode === 'ai' ? (
                        <div className="space-y-4">
                          {!aiResult ? (
                            <form onSubmit={handleAiSummarize} className="space-y-4">
                              <div>
                                <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Paste Meeting Transcript or Raw Notes</label>
                                <textarea
                                  required
                                  rows={8}
                                  placeholder="Paste the transcription text, voice notes transcript, or a detailed brain dump of the meeting. E.g., 'Client wants a 3BHK design. Budget is tight under 15L. Kitchen must have an island. Sarah will send 3D quotes. Client mentioned they are also talking to Livspace...'"
                                  value={meetingTranscript}
                                  onChange={e => setMeetingTranscript(e.target.value)}
                                  className="w-full text-base border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                  disabled={aiSummarizing}
                                />
                              </div>

                              <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setIsConcludingMeeting(false);
                                    setMeetingTranscript('');
                                  }}
                                  disabled={aiSummarizing}
                                >
                                  Cancel
                                </Button>
                                <button
                                  type="submit"
                                  disabled={aiSummarizing || !meetingTranscript.trim()}
                                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {aiSummarizing ? '🤖 AI is analyzing...' : '✨ Generate AI Summary & Conclude'}
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                              <div className="flex items-center justify-between border-b pb-3">
                                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                                  <span>🤖</span> Gemini AI Analysis Complete
                                </h4>
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1 border border-green-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span> Concluded & Saved
                                </span>
                              </div>

                              {/* SENTIMENT */}
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Sentiment:</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                  aiResult.customer_sentiment === 'Positive' ? 'bg-green-50 text-green-700 border border-green-200' :
                                  aiResult.customer_sentiment === 'Negative' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  'bg-gray-50 text-gray-700 border border-gray-200'
                                }`}>
                                  <span>{aiResult.customer_sentiment === 'Positive' ? '🙂' : aiResult.customer_sentiment === 'Negative' ? '😞' : '😐'}</span>
                                  {aiResult.customer_sentiment}
                                </span>
                              </div>

                              {/* SUMMARY */}
                              <div>
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Summary</h5>
                                <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm leading-relaxed whitespace-pre-line">
                                  {aiResult.summary}
                                </p>
                              </div>

                              {/* TASKS CREATED */}
                              <div>
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Auto-Generated Tasks ({aiResult.tasks_created || 0})</h5>
                                {aiResult.action_items && aiResult.action_items.length > 0 ? (
                                  <div className="space-y-2">
                                    {aiResult.action_items.map((item, idx) => (
                                      <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100/50 text-sm animate-fadeIn">
                                        <span className="text-indigo-600 font-bold mt-0.5">✓</span>
                                        <div>
                                          <p className="font-semibold text-gray-800">{typeof item === 'string' ? item : item.title}</p>
                                          <p className="text-xs text-gray-500 mt-0.5">Due in {typeof item === 'object' && item.due_in_days ? item.due_in_days : 1} day(s)</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No tasks needed for this transcript.</p>
                                )}
                              </div>

                              {/* SALES COACH FEEDBACK */}
                              {aiCoachFeedback && (
                                <div className="mt-4 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-orange-100 animate-fadeIn">
                                  <h5 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                                    <span>🧠</span> AI Sales Coach Feedback
                                  </h5>
                                  <p className="text-sm text-gray-700 italic mb-4 leading-relaxed">
                                    "{aiCoachFeedback.feedback}"
                                  </p>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {aiCoachFeedback.strengths && aiCoachFeedback.strengths.length > 0 && (
                                      <div>
                                        <h6 className="text-xs font-bold text-green-700 uppercase mb-2">Strengths</h6>
                                        <ul className="space-y-1.5 text-xs text-gray-600">
                                          {aiCoachFeedback.strengths.map((str, sIdx) => (
                                            <li key={sIdx} className="flex items-start gap-1">
                                              <span className="text-green-600 font-bold">•</span>
                                              <span>{str}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {aiCoachFeedback.missed_questions && aiCoachFeedback.missed_questions.length > 0 && (
                                      <div>
                                        <h6 className="text-xs font-bold text-red-700 uppercase mb-2">Missed Opportunities</h6>
                                        <ul className="space-y-1.5 text-xs text-gray-600">
                                          {aiCoachFeedback.missed_questions.map((q, qIdx) => (
                                            <li key={qIdx} className="flex items-start gap-1">
                                              <span className="text-red-500 font-bold">•</span>
                                              <span>{q}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-end pt-4 border-t">
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    setIsConcludingMeeting(false);
                                    setAiResult(null);
                                    setAiCoachFeedback(null);
                                    setMeetingTranscript('');
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  Done & Close
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <form onSubmit={handleConcludeMeeting} className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Meeting Summary &amp; Key Decisions *</label>
                            <textarea
                              required
                              rows={6}
                              placeholder="Type meeting outcomes, notes, key choices the client made, next steps, and specific design requests..."
                              value={meetingSummary}
                              onChange={e => setMeetingSummary(e.target.value)}
                              className="w-full text-base border border-gray-300 rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500"
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
                      )}
                    </div>
                  ) : lead.next_meeting_schedule ? (
                    <div className="relative overflow-hidden p-6 rounded-2xl border shadow-sm transition-all" style={{ background: 'rgba(255, 165, 0, 0.06)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 165, 0, 0.18)' }}>
                      
                      {/* Decorative glowing gradient blur */}
                      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-orange-400 opacity-10 blur-3xl"></div>
                      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-400 opacity-10 blur-3xl"></div>

                      <div className="relative flex flex-col md:flex-row gap-6 justify-between items-start md:items-center border-b border-orange-100 pb-5 mb-5">
                        <div className="space-y-1">
                          <span className="px-2.5 py-1 bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-extrabold uppercase tracking-widest rounded-md">
                            Next Consultation
                          </span>
                          <h4 className="text-2xl font-extrabold tracking-tight mt-1 text-gray-900">{lead.next_meeting_title || 'Lead Consultation Meeting'}</h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-orange-600 text-white text-xs font-extrabold rounded-lg shadow-sm uppercase tracking-wider">
                            {getMeetingCountdown(lead.next_meeting_schedule)}
                          </span>
                        </div>
                      </div>

                      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                          {lead.next_meeting_notes && (
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Agenda / Description</span>
                              <p className="text-sm text-gray-700 mt-1.5 bg-white/70 p-4 rounded-xl border border-gray-200 whitespace-pre-line leading-relaxed shadow-sm">
                                {lead.next_meeting_notes}
                              </p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-white/70 p-3 rounded-xl border border-gray-250 shadow-sm">
                              <span className="text-2xl">👤</span>
                              <div>
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Host</span>
                                <span className="text-sm font-semibold text-gray-700">{lead.next_meeting_host || lead.assignee_name || 'Unassigned'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/70 p-3 rounded-xl border border-gray-250 shadow-sm">
                              <span className="text-2xl">🔔</span>
                              <div>
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Reminders</span>
                                <span className="text-sm font-semibold text-gray-700">WhatsApp &amp; Email</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/60 p-5 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-4 shadow-sm">
                          <div className="space-y-3.5">
                            <div>
                              <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Date &amp; Time</span>
                              <div className="text-sm font-bold text-gray-800 mt-1 flex items-center gap-2">
                                <span>📅</span>
                                {formatMeetingSchedule(lead.next_meeting_schedule)}
                              </div>
                            </div>
                            {lead.next_meeting_duration && (
                              <div>
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Duration</span>
                                <div className="text-sm font-semibold text-gray-700 mt-1 flex items-center gap-2">
                                  <span>⏱️</span>
                                  {lead.next_meeting_duration} minutes
                                </div>
                              </div>
                            )}
                            {lead.next_meeting_type && (
                              <div>
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Meeting Type</span>
                                <div className="text-sm font-semibold text-gray-700 mt-1 flex items-center gap-2">
                                  <span>📍</span>
                                  {lead.next_meeting_type}
                                </div>
                              </div>
                            )}
                          </div>

                          {lead.next_meeting_link && (
                            <a
                              href={lead.next_meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              Join Meeting
                            </a>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS TOOLBAR */}
                      <div className="flex flex-wrap items-center justify-end border-t border-orange-100 pt-4 mt-6 gap-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const activeMeetingId = lead.next_meeting_id || meetings.find(a => a.type === 'meeting' && !['concluded', 'completed', 'cancelled', 'deleted'].includes(a.outcome))?.id;
                              if (activeMeetingId) {
                                handleDeleteMeeting(activeMeetingId);
                              } else {
                                toast.error('No active meeting found to delete.');
                              }
                            }}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg border border-red-600 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Delete Meeting
                          </button>
                          <button
                            type="button"
                            onClick={async () => setIsEditingMeeting(true)}
                            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAiResult(null);
                              setAiCoachFeedback(null);
                              setMeetingTranscript('');
                              setMeetingSummary('');
                              setConcludeMode('ai');
                              setIsConcludingMeeting(true);
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold rounded-lg shadow-sm border border-green-600 hover:border-green-750 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Conclude Meeting
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 rounded-2xl border border-dashed border-gray-300 bg-white/30 backdrop-blur-sm">
                      <span className="text-5xl block mb-3 animate-bounce">📅</span>
                      <h4 className="text-lg font-bold text-gray-800">No Meetings Scheduled</h4>
                      <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">Build momentum by scheduling a design consultation.</p>
                      <button
                        onClick={async () => setIsEditingMeeting(true)}
                        className="mt-5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow transition-all hover:scale-105 cursor-pointer"
                      >
                        Schedule Now
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. MEETING HISTORY & TIMELINE */}
                <div className="p-6 rounded-2xl shadow-sm transition-all bg-white border border-gray-100">
                  <div className="border-b pb-3 mb-5">
                    <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                      <span>📜</span> Meeting History &amp; Logs
                    </h4>
                  </div>

                  {meetingsLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map(n => (
                        <div key={n} className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                      ))}
                    </div>
                  ) : meetings.filter(a => a.id !== lead.next_meeting_id).length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-6">No historical meetings recorded yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {meetings
                        .filter(a => a.id !== lead.next_meeting_id)
                        .map((act) => {
                          const isConcluded = act.outcome === 'concluded' || act.outcome === 'completed';
                          const isCancelled = act.outcome === 'cancelled';
                          const isExpanded = expandedMeetingId === act.id;
                          
                          // Safe access to AI metadata
                          const meta = act.metadata || {};
                          const sentiment = meta.customer_sentiment || null;
                          const actionItems = meta.action_items || [];
                          const coach = meta.sales_coach || null;

                          return (
                            <div key={act.id} className="border border-gray-150 rounded-xl overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-all">
                              
                              {/* HEADER */}
                              <div className="p-4 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2.5">
                                    <h5 className="font-bold text-gray-900 text-sm">{act.title || 'Meeting Log'}</h5>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                      isConcluded ? 'bg-green-100 text-green-700 border border-green-200' :
                                      isCancelled ? 'bg-red-100 text-red-700 border border-red-200' :
                                      act.outcome === 'deleted' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                                      'bg-gray-100 text-gray-650 border border-gray-200'
                                    }`}>
                                      {act.outcome || (new Date(act.scheduled_at) < new Date() ? 'completed' : 'scheduled')}
                                    </span>
                                    {act.outcome === 'deleted' && meta.delete_reason && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gray-50 text-gray-600 border border-gray-200" title={`Reason: ${meta.delete_reason}`}>
                                        Reason: {meta.delete_reason.length > 25 ? meta.delete_reason.substring(0, 25) + '...' : meta.delete_reason}
                                      </span>
                                    )}
                                    {sentiment && (
                                      <span className="text-xs" title={`Customer Sentiment: ${sentiment}`}>
                                        {sentiment === 'Positive' ? '🟢 Positive' : sentiment === 'Negative' ? '🔴 Negative' : '🟡 Neutral'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                                    <span>📅 {formatMeetingSchedule(act.scheduled_at || act.created_at)}</span>
                                    <span>👤 Host: {meta.meeting_host || act.user_name || 'Coordinator'}</span>
                                    {meta.duration && <span>⏱️ {meta.duration} mins</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isConcluded && (
                                    <button
                                      onClick={() => setExpandedMeetingId(isExpanded ? null : act.id)}
                                      className="px-3 py-1.5 hover:bg-gray-100 text-blue-600 hover:text-blue-800 text-xs font-bold rounded-lg border border-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      {isExpanded ? 'Hide Details ▲' : 'View AI Summary ▾'}
                                    </button>
                                  )}
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleDeleteMeeting(act.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                    title="Delete Meeting"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                  </button>
                                </div>
                              </div>

                              {/* ACCORDION CONTENT */}
                              {isExpanded && isConcluded && (
                                <div className="p-5 border-t border-gray-100 space-y-4 bg-slate-50/50 animate-fadeIn">
                                  
                                  {/* NOTES SUMMARY */}
                                  <div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">AI Notes Summary</span>
                                    <p className="text-sm text-gray-700 leading-relaxed bg-white p-3 rounded-lg border border-gray-100 whitespace-pre-line">
                                      {act.notes}
                                    </p>
                                  </div>

                                  {/* ACTION ITEMS CHECKLIST */}
                                  {actionItems && actionItems.length > 0 && (
                                    <div>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Extracted Tasks</span>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {actionItems.map((item, idx) => (
                                          <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-gray-100 text-xs shadow-sm">
                                            <span className="text-indigo-650 font-bold">✓</span>
                                            <div>
                                              <p className="font-semibold text-gray-800">{typeof item === 'string' ? item : item.title}</p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">Due in {typeof item === 'object' && item.due_in_days ? item.due_in_days : 1} days</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* SALES COACH FEEDBACK */}
                                  {coach && (
                                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-orange-100">
                                      <span className="text-[10px] text-orange-850 font-bold uppercase tracking-wider block mb-2">Sales Coach Feedback</span>
                                      <p className="text-xs text-gray-700 italic mb-3">"{coach.feedback}"</p>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-orange-200/40">
                                        {coach.strengths && coach.strengths.length > 0 && (
                                          <div>
                                            <span className="text-[10px] text-green-700 font-bold uppercase block mb-1.5">Strengths</span>
                                            <ul className="space-y-1 text-xs text-gray-600">
                                              {coach.strengths.map((str, sIdx) => (
                                                <li key={sIdx} className="flex items-start gap-1">
                                                  <span className="text-green-600">•</span>
                                                  <span>{str}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {coach.missed_questions && coach.missed_questions.length > 0 && (
                                          <div>
                                            <span className="text-[10px] text-red-700 font-bold uppercase block mb-1.5">Missed Questions</span>
                                            <ul className="space-y-1 text-xs text-gray-600">
                                              {coach.missed_questions.map((q, qIdx) => (
                                                <li key={qIdx} className="flex items-start gap-1">
                                                  <span className="text-red-500">•</span>
                                                  <span>{q}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* NON-EXPANDED SIMPLE NOTE */}
                              {!isConcluded && act.notes && (
                                <div className="p-4 border-t border-gray-100 text-sm text-gray-600">
                                  {act.notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={async () => document.getElementById(`file-input-${leadId}`).click()}
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
                <div className="rounded-xl overflow-hidden shadow-sm border transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
                  <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700 transition-all" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(5px)' }}>Uploaded Files</div>
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
                              onClick={async () => handleParseFile(f.id)} 
                              className="text-xs text-primary hover:text-primary-dark font-medium mr-2"
                              title="Extract properties with AI"
                            >
                              ✨ Extract
                            </button>
                          )}
                          <button onClick={async () => deleteFile(f.id)} className="text-gray-400 hover:text-red-500 shrink-0 text-lg leading-none">&times;</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {activeTab === 'estimates' && (
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Quotes & Estimates</h3>
                  <div className="flex gap-3">
                    <Button variant="outline" size="md" onClick={syncEstimates} title="Refresh estimates">
                      &#8635; Sync
                    </Button>
                    <Button variant="outline" size="md" onClick={handleCreateEstimate}>
                      Generate Estimate
                    </Button>
                  </div>
                </div>
                {syncError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-base">
                    <strong>Sync Failed:</strong> {syncError}
                  </div>
                )}
                {estimates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 rounded-xl border border-dashed border-gray-300 transition-all" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)' }}>
                    <p className="text-base font-semibold">No estimates generated yet.</p>
                    <p className="text-sm mt-2">Click "Generate Estimate" to create a new BOQ.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {estimates.map(est => (
                      <div key={est.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-base font-bold text-gray-900">Estimate {est.estimator_reference_id}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant={est.status === 'accepted' ? 'success' : est.status === 'sent' ? 'primary' : 'secondary'}>
                              {est.status}
                            </Badge>
                            <span className="text-sm text-gray-500">Created: {new Date(est.created_at).toLocaleDateString()}</span>
                            <span className="text-sm text-gray-400">&bull;</span>
                            <span className="text-sm text-blue-600 font-medium">Last Synced: {new Date(est.updated_at || est.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">₹{est.total_amount ? Number(est.total_amount).toLocaleString() : '0'}</p>
                          {est.pdf_url && (
                            <a href={est.pdf_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline mt-1.5 block">View PDF</a>
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
          <div className="border-t border-gray-200 p-5 shrink-0 flex items-center justify-between relative z-10" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)' }}>
            <div className="flex gap-3">
              <Button variant="outline" size="md" onClick={async () => setIsAssignModalOpen(true)}>Reassign</Button>
              <Button variant="outline" size="md" onClick={async () => {
                try {
                  const newStatus = lead.status === 'parked' ? 'new' : 'parked';
                  await api.patch(`/leads/${lead.id}`, { status: newStatus });
                  toast.success(`Lead ${newStatus === 'parked' ? 'parked' : 'unparked'} successfully`);
                  if (onClose) onClose(true);
                } catch (e) {
                  toast.error('Failed to update lead status');
                }
              }}>
                {lead.status === 'parked' ? 'Unpark Lead' : 'Park Lead'}
              </Button>
              <Button variant="outline" size="md" onClick={async () => setIsPresentModalOpen(true)}>Log Presentation</Button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="md" onClick={handleArchiveToggle} className="text-gray-700 hover:bg-gray-50">
                {lead.status === 'archived' ? 'Unarchive' : 'Archive'}
              </Button>
              <Button variant="outline" size="md" onClick={handleDelete} className="text-gray-700 hover:bg-gray-50">Mark Lost</Button>

              {/* Show Convert button if logic matches a won or late stage */}
              {(lead.stage_id === 'won' || lead.stage_name === 'Won' || lead.stage_name === 'Booking' || lead.stage_id === 'booking') && (
                <Button variant="primary" size="md" onClick={async () => setIsConvertModalOpen(true)}>Convert to Project</Button>
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
                setActivityRefresh(prev => prev + 1);
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

          {meetingToDelete && (
            <Modal
              isOpen={!!meetingToDelete}
              onClose={() => setMeetingToDelete(null)}
              size="sm"
              hideHeader={true}
            >
              <div className="relative p-7 overflow-hidden text-center bg-white rounded-xl">
                {/* Decorative background glow */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500 opacity-10 rounded-full blur-3xl"></div>
                
                {/* Close Button overlay */}
                <button 
                  onClick={() => {
                    setMeetingToDelete(null);
                    setDeleteReason('');
                  }}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-20 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className="relative z-10 space-y-5">
                  <div className="w-20 h-20 bg-red-50 border-8 border-red-50/50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Delete Meeting?</h3>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed px-2">
                      You are about to permanently delete this scheduled meeting. This action cannot be undone.
                    </p>
                  </div>

                  <div className="text-left mt-6">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Reason for Deletion <span className="text-red-500">*</span></label>
                    <textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="e.g., Client requested cancellation..."
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-red-500/10 focus:border-red-500 focus:bg-white transition-all resize-none shadow-inner"
                      rows="3"
                    />
                  </div>
                  
                  <div className="flex gap-3 justify-center pt-3 w-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMeetingToDelete(null);
                        setDeleteReason('');
                      }}
                      disabled={meetingSubmitting}
                      className="flex-1 py-2.5 font-bold text-gray-600 hover:bg-gray-50 border-gray-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold border-red-600 hover:border-red-700 shadow-md shadow-red-500/20"
                      onClick={async () => {
                        await handleDeleteMeetingConfirm();
                      }}
                      disabled={meetingSubmitting}
                    >
                      {meetingSubmitting ? 'Deleting...' : 'Yes, Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            </Modal>
          )}


        </div>
      )}

      {isRestoreConfirmOpen && (
        <Modal
          isOpen={isRestoreConfirmOpen}
          onClose={() => setIsRestoreConfirmOpen(false)}
          size="sm"
        >
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              🔄
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Restore Lead?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to restore this lead? This will move it back to active leads list.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRestoreConfirmOpen(false)}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={executeRestore}
                disabled={actionSubmitting}
              >
                {actionSubmitting ? 'Restoring...' : 'Yes, Restore'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isMarkLostModalOpen && (
        <MarkLostModal
          isOpen={isMarkLostModalOpen}
          onClose={() => setIsMarkLostModalOpen(false)}
          onConfirm={executeMarkLost}
          isSubmitting={actionSubmitting}
        />
      )}

      {isDeleteConfirmOpen && (
        <Modal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          size="sm"
        >
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Permanently Delete Lead?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to permanently delete this lead? This action is irreversible and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={actionSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={executePermanentDelete}
                disabled={actionSubmitting}
              >
                {actionSubmitting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
