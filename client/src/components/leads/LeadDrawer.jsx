import React, { useState, useEffect } from 'react';
import { getLead, changeLeadStage } from '../../api/leads';
import ActivityTimeline from './ActivityTimeline';
import Avatar from '../ui/Avatar';

export default function LeadDrawer({ leadId, isOpen, onClose, onLeadUpdated }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLead();
    }
  }, [isOpen, leadId]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getLead(leadId);
      if (res.success) {
        setLead(res.data);
      }
    } catch (err) {
      setError('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (e) => {
    const newStageId = e.target.value;
    try {
      const res = await changeLeadStage(leadId, newStageId);
      if (res.success) {
        setLead(res.data);
        onLeadUpdated && onLeadUpdated(res.data);
      }
    } catch (err) {
      alert('Failed to change stage');
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target.id === 'drawer-backdrop') {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        id="drawer-backdrop"
        onClick={handleBackdropClick}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 truncate max-w-[200px] cursor-text hover:bg-gray-200 px-1 rounded transition-colors" title="Click to edit name">
              {loading ? 'Loading...' : (lead ? lead.name : 'Lead Details')}
            </h2>
            {lead && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="flex gap-2 mb-6">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="h-24 bg-gray-100 rounded w-full"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-4/6"></div>
              </div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">{error}</div>
          ) : lead ? (
            <div className="space-y-8">
              
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {['Call', 'Note', 'Email', 'Schedule Visit', 'Convert to Project'].map(action => (
                  <button key={action} className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded shadow-sm border border-gray-300 transition-colors">
                    {action}
                  </button>
                ))}
              </div>

              {/* Status and Assignment */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 space-y-4 shadow-sm">
                <div>
                  <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1">Stage</label>
                  <select 
                    value={lead.stage_id || ''} 
                    onChange={handleStageChange}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none shadow-sm cursor-pointer"
                  >
                    <option value={lead.stage_id}>{lead.stage_name || 'Current Stage'}</option>
                    {/* In a complete app, we'd map all stages from context here */}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1">Assignee</label>
                  <div className="w-full bg-white border border-gray-300 rounded-md p-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors shadow-sm">
                    <div className="flex items-center gap-2">
                      <Avatar name={lead.assignee_name || 'Unassigned'} imageUrl={lead.assignee_avatar} size="sm" />
                      <span className="text-sm font-medium text-gray-700">{lead.assignee_name || 'Unassigned'}</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Core Fields */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Contact Information</h3>
                <div className="space-y-1">
                  <div className="flex flex-col py-2 border-b border-gray-50 group relative">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Phone</span>
                    <span className="text-sm font-medium text-gray-900">{lead.phone || '-'}</span>
                    <button className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                  </div>
                  <div className="flex flex-col py-2 border-b border-gray-50 group relative">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Email</span>
                    <span className="text-sm font-medium text-gray-900">{lead.email || '-'}</span>
                    <button className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                  </div>
                  <div className="flex flex-col py-2 group relative">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">Source</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{lead.source || '-'}</span>
                    <button className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Additional Details</h3>
                  <div className="space-y-1">
                    {Object.entries(lead.custom_fields).map(([key, val]) => (
                      <div key={key} className="flex flex-col py-2 border-b border-gray-50 group relative">
                        <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{val?.toString() || '-'}</span>
                        <button className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">Activity Timeline</h3>
                <ActivityTimeline leadId={leadId} />
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
