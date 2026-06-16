import React, { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import { Drawer, Button, Badge } from '../ui';
import ScoreBadge from './ScoreBadge';
import ActivityTimeline from './ActivityTimeline';
import TaskWidget from './TaskWidget';
import ConvertToProjectModal from './ConvertToProjectModal';
import { getLead, changeLeadStage, deleteLead } from '../../api/leads';
import api from '../../api/axios';

export default function LeadDrawer({ leadId, isOpen, onClose, onLeadUpdated, stages = [] }) {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, activity, tasks, files
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Auto-saving state
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error', ''
  
  // Stage change states
  const [pendingStage, setPendingStage] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLead();
      setActiveTab('overview');
    }
  }, [isOpen, leadId]);

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

  const handleFieldChange = (field, value) => {
    setLead(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = async (field, value) => {
    setSaveStatus('saving');
    try {
      const res = await api.patch(`/leads/${leadId}`, { [field]: value });
      if (res.data?.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
        onLeadUpdated?.(res.data.data);
      }
    } catch (e) {
      setSaveStatus('error');
      toast.error(`Failed to save ${field}`);
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

  if (!isOpen) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="480px">
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
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-1 text-gray-400 hover:text-gray-700">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="outline" className="text-gray-600 font-mono text-xs">{lead.lead_number || `LD-${lead.id.substring(0,4).toUpperCase()}`}</Badge>
              <ScoreBadge score={lead.score} />
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
              <div className="text-xs text-gray-500 font-medium">
                {saveStatus === 'saving' && <span className="animate-pulse">Saving...</span>}
                {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> Saved</span>}
                {saveStatus === 'error' && <span className="text-red-600">Save failed</span>}
              </div>
            </div>
            {errorMsg && <div className="mt-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded border border-red-100">{errorMsg}</div>}
          </div>

          {/* TABS NAVIGATION */}
          <div className="bg-white px-6 border-b border-gray-200 shrink-0">
            <nav className="-mb-px flex space-x-6">
              {['overview', 'activity', 'tasks', 'files'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap pb-3 pt-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB CONTENT (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                
                {/* Contact Info */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Contact Info</h4>
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
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Property Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select 
                        value={lead.property_type || ''}
                        onChange={e => handleFieldChange('property_type', e.target.value)}
                        onBlur={e => handleFieldBlur('property_type', e.target.value)}
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select...</option>
                        <option value="flat">Flat</option>
                        <option value="villa">Villa</option>
                        <option value="commercial">Commercial</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Scope</label>
                      <select 
                        value={lead.scope || ''}
                        onChange={e => handleFieldChange('scope', e.target.value)}
                        onBlur={e => handleFieldBlur('scope', e.target.value)}
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select...</option>
                        <option value="full_home">Full Home</option>
                        <option value="modular_kitchen">Modular Kitchen</option>
                        <option value="partial">Partial</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Locality / City</label>
                      <input 
                        type="text" value={lead.locality || ''} 
                        onChange={e => handleFieldChange('locality', e.target.value)}
                        onBlur={e => handleFieldBlur('locality', e.target.value)}
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. Indiranagar, Bangalore"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Budget Max (₹)</label>
                      <input 
                        type="number" value={lead.budget_max || ''} 
                        onChange={e => handleFieldChange('budget_max', e.target.value)}
                        onBlur={e => handleFieldBlur('budget_max', e.target.value)}
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. 1500000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Carpet Area</label>
                      <input 
                        type="number" value={lead.carpet_area_sqft || ''} 
                        onChange={e => handleFieldChange('carpet_area_sqft', e.target.value)}
                        onBlur={e => handleFieldBlur('carpet_area_sqft', e.target.value)}
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Sq. ft"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferences & Tracking */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Preferences</h4>
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
                        className="w-full text-sm border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g. Livspace, HomeLane"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-4">
                <ActivityTimeline leadId={leadId} />
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <TaskWidget leadId={leadId} />
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <p className="mt-2 text-sm font-medium text-gray-900">Drag & drop files to upload</p>
                  <p className="text-xs text-gray-500">Floor plans, reference images, or proposal PDFs.</p>
                </div>
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700 bg-gray-50">Uploaded Files</div>
                  <ul className="divide-y divide-gray-200 text-sm">
                     <li className="p-4 text-center text-gray-500">No files uploaded yet.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* STICKY FOOTER */}
          <div className="bg-white border-t border-gray-200 p-4 shrink-0 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {}}>Reassign</Button>
              <Button variant="outline" size="sm" onClick={() => {}}>Park</Button>
            </div>
            <div className="flex gap-2">
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
                 onClose();
              }}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
