/* eslint-disable no-unused-vars */
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
      style={{
        ...style,
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text)'
      }} 
      {...attributes} 
      {...listeners}
      onClick={() => { if (lead.id && onAction) onAction('view', lead); }}
      className={`p-4 rounded-lg shadow-sm border mb-3 cursor-grab hover:shadow-md transition-shadow relative ${isDragging ? 'ring-2 ring-primary cursor-grabbing' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold line-clamp-1" title={lead.name}>{lead.name}</h4>
        <div className="flex gap-2 items-center">
          {lead.win_probability !== undefined && (
            <div 
              className="text-xs px-2 py-1 rounded-full font-medium" 
              style={{
                background: lead.win_probability > 70 ? 'var(--color-success-bg)' : lead.win_probability > 30 ? 'var(--color-warning-bg)' : 'var(--color-surface-2)',
                color: lead.win_probability > 70 ? 'var(--color-success)' : lead.win_probability > 30 ? 'var(--color-warning)' : 'var(--color-text-secondary)'
              }}
              title="Win Probability"
            >
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

      <div className="text-sm font-medium mb-1">
        {lead.revenue_potential ? `₹${lead.revenue_potential}` : '₹—'}
      </div>

      <div className="text-xs mb-3 space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="flex flex-col gap-1">
          {aiRec ? (
            <div className="flex items-start gap-1 p-1.5 rounded" style={{ background: 'var(--color-info-bg)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
              <span style={{ color: 'var(--color-info)' }} className="mt-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-info)' }}>AI Suggested Next Step</span>
                <span style={{ color: 'var(--color-text)' }}>
                  {aiRec.recommendedAction} {lead.next_action_date ? `(${lead.next_action_date})` : ''}
                </span>
                {aiRec.reason && (
                  <span className="text-[10px] italic leading-tight mt-0.5" style={{ color: 'var(--color-info)' }}>{aiRec.reason}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>Next:</span>
              <span>{lead.ai_recommendation || 'Follow up'}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>•</span>
              <span>{lead.next_action_date || 'Tomorrow'}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>Last Contact:</span>
          <span>{lead.last_contact_date || 'Yesterday'}</span>
          {staleBadge && <span className="ml-1">{staleBadge}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span>Builder: {lead.builder_name || 'Unknown'}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>•</span>
          <span>Apt: {lead.locality || 'Unknown'}</span>
        </div>
        
        {aiRec?.objections && aiRec.objections.length > 0 && (
          <div className="mt-2 inline-flex flex-col gap-1 text-xs px-2 py-1.5 rounded-md border w-full" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            <span className="font-bold flex items-center gap-1"><span style={{ color: 'var(--color-danger)' }}>⚠</span> Active Objections</span>
            <ul className="list-disc pl-4 text-[10px] space-y-0.5">
              {aiRec.objections.map((obj, i) => <li key={i}>{obj}</li>)}
            </ul>
          </div>
        )}
        
        {lead.budget_concern && !aiRec?.objections && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border" style={{ background: 'var(--color-danger-bg)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
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
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }} title={lead.assignee_name}>
              {(lead.assignee_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          
          <div className="flex items-center gap-1 border-l pl-2 relative" style={{ borderColor: 'var(--color-border)' }}>
             <button title="Call" className="p-1 rounded transition-colors text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
             </button>
             <button title="WhatsApp" className="p-1 rounded transition-colors text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
             </button>
             <button title="Schedule" className="p-1 rounded transition-colors text-xs" style={{ color: 'var(--color-text-secondary)' }}>📅</button>
             
             <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
             </button>

             {showMenu && (
                <div className="absolute right-0 bottom-full mb-1 w-32 border shadow-lg rounded-md overflow-hidden z-10 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                   <button className="w-full text-left px-3 py-2" onClick={(e) => handleAction(e, 'reassign')}>Reassign</button>
                   <button className="w-full text-left px-3 py-2" onClick={(e) => handleAction(e, 'park')}>Park Lead</button>
                   <button className="w-full text-left px-3 py-2" style={{ color: 'var(--color-danger)' }} onClick={(e) => handleAction(e, 'lost')}>Mark Lost</button>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
