import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '../ui'; // Assuming standard UI
import ScoreBadge from './ScoreBadge';

export default function KanbanLeadCard({ lead, onAction }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { ...lead } });

  const [showMenu, setShowMenu] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const slaLimit = lead.max_days_in_stage || 3;
  const isSlaBreached = lead.days_in_stage > slaLimit;
  const isOverdue = lead.follow_up_overdue_days > 0;

  const handleAction = (e, actionType) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onAction) onAction(actionType, lead);
  };

  const getAgingStatus = () => {
    if (isSlaBreached) return { label: 'At Risk', color: 'bg-red-100 text-red-700 font-medium', dot: '🔴' };
    if (lead.days_in_stage >= slaLimit - 1) return { label: 'Needs Attention', color: 'bg-yellow-100 text-yellow-700 font-medium', dot: '🟡' };
    return { label: 'Healthy', color: 'bg-green-100 text-green-700 font-medium', dot: '🟢' };
  };

  const aging = getAgingStatus();
  const aiRec = lead.custom_fields?.ai_recommendation || lead.metadata?.ai_recommendation;

  const getStalenessBadge = () => {
    const date = new Date(lead.last_activity_at || lead.created_at);
    if (isNaN(date)) return null;
    const daysOld = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (daysOld >= 7) return <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 font-bold rounded uppercase">Stale {daysOld}d</span>;
    if (daysOld <= 1) return <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 font-bold rounded uppercase">Fresh</span>;
    return null;
  };

  const staleBadge = getStalenessBadge();

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      onClick={() => { if (lead.id && onAction) onAction('view', lead); }}
      className={`bg-white p-4 rounded-lg shadow-sm border mb-3 cursor-grab hover:shadow-md transition-shadow relative ${isDragging ? 'ring-2 ring-primary cursor-grabbing' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-800 line-clamp-1" title={lead.name}>{lead.name}</h4>
        <div className="flex gap-2 items-center">
          {lead.win_probability !== undefined && (
            <div className={`text-xs px-2 py-1 rounded-full font-medium ${lead.win_probability > 70 ? 'bg-green-100 text-green-700' : lead.win_probability > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`} title="Win Probability">
              {lead.win_probability}% Win
            </div>
          )}
          <ScoreBadge score={lead.score} />
        </div>
      </div>

      {(lead.custom_fields?.ai_recommendation?.intent || lead.custom_fields?.ai_recommendation?.sentiment) && (
        <div className="flex gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider">
          {lead.custom_fields.ai_recommendation.intent && (
            <span className={`px-1.5 py-0.5 rounded border ${lead.custom_fields.ai_recommendation.intent === 'high' ? 'bg-green-50 text-green-700 border-green-200' : lead.custom_fields.ai_recommendation.intent === 'low' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              Intent: {lead.custom_fields.ai_recommendation.intent}
            </span>
          )}
          {lead.custom_fields.ai_recommendation.sentiment && (
            <span className={`px-1.5 py-0.5 rounded border ${lead.custom_fields.ai_recommendation.sentiment === 'Positive' ? 'bg-blue-50 text-blue-700 border-blue-200' : lead.custom_fields.ai_recommendation.sentiment === 'Negative' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              Sentiment: {lead.custom_fields.ai_recommendation.sentiment}
            </span>
          )}
        </div>
      )}

      <div className="text-sm font-medium text-gray-800 mb-1">
        {lead.revenue_potential ? `₹${lead.revenue_potential}` : '₹—'}
      </div>

      <div className="text-xs text-gray-500 mb-3 space-y-1">
        <div className="flex flex-col gap-1">
          {aiRec ? (
            <div className="flex items-start gap-1 bg-blue-50 border border-blue-100 p-1.5 rounded text-blue-800">
              <span className="text-blue-500 mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-[10px] uppercase tracking-wider">AI Suggested Next Step</span>
                <span>
                  {aiRec.recommendedAction} {lead.next_action_date ? `(${lead.next_action_date})` : ''}
                </span>
                {aiRec.reason && (
                  <span className="text-[10px] text-blue-600 italic leading-tight mt-0.5">{aiRec.reason}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-medium text-gray-700">Next:</span>
              <span>{lead.ai_recommendation || 'Follow up'}</span>
              <span className="text-gray-400">•</span>
              <span>{lead.next_action_date || 'Tomorrow'}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span className="font-medium text-gray-700">Last Contact:</span>
          <span>{lead.last_contact_date || 'Yesterday'}</span>
          {staleBadge && <span className="ml-1">{staleBadge}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span>Builder: {lead.builder_name || 'Unknown'}</span>
          <span className="text-gray-400">•</span>
          <span>Apt: {lead.locality || 'Unknown'}</span>
        </div>
        
        {aiRec?.objections && aiRec.objections.length > 0 && (
          <div className="mt-2 inline-flex flex-col gap-1 text-xs px-2 py-1.5 bg-red-50 text-red-800 rounded-md border border-red-200 w-full">
            <span className="font-bold flex items-center gap-1"><span className="text-red-500">⚠</span> Active Objections</span>
            <ul className="list-disc pl-4 text-[10px] space-y-0.5">
              {aiRec.objections.map((obj, i) => <li key={i}>{obj}</li>)}
            </ul>
          </div>
        )}
        
        {lead.budget_concern && !aiRec?.objections && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-700 rounded-md border border-red-100">
            ⚠ Budget Concern
          </div>
        )}
      </div>

      <div className="flex justify-between items-end mt-4">
        <div className="flex flex-col gap-1">
          <div className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 w-max ${aging.color}`} title={`${lead.days_in_stage || 0}d in stage. SLA: ${slaLimit}d`}>
            <span>{aging.dot}</span> {aging.label} ({lead.days_in_stage || 0}d)
          </div>
          {isOverdue && (
            <div className="text-[10px] px-2 py-0.5 rounded text-red-600 bg-red-50 border border-red-200 font-bold flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Overdue {lead.follow_up_overdue_days}d
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {lead.assignee_avatar ? (
            <img src={lead.assignee_avatar} alt="avatar" className="w-6 h-6 rounded-full" title={lead.assignee_name} />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold" title={lead.assignee_name}>
              {(lead.assignee_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          
          <div className="flex items-center gap-1 border-l pl-2 relative">
             <button title="Call" className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary transition-colors text-xs">📞</button>
             <button title="WhatsApp" className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600 transition-colors text-xs">💬</button>
             <button title="Schedule" className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary transition-colors text-xs">📅</button>
             
             <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
             </button>

             {showMenu && (
                <div className="absolute right-0 bottom-full mb-1 w-32 bg-white border shadow-lg rounded-md overflow-hidden z-10 text-sm">
                   <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={(e) => handleAction(e, 'reassign')}>Reassign</button>
                   <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={(e) => handleAction(e, 'park')}>Park Lead</button>
                   <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600" onClick={(e) => handleAction(e, 'lost')}>Mark Lost</button>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
