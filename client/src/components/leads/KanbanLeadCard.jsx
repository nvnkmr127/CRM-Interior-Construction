/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ScoreBadge from './ScoreBadge';
import styles from './LeadKanbanBoard.module.css';

function safeParseDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'number') return new Date(dateStr);
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    const hasTimezone = trimmed.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed);
    if (!hasTimezone && trimmed.includes(':')) {
      return new Date(trimmed.endsWith('Z') ? trimmed : `${trimmed.replace(' ', 'T')}Z`);
    }
  }
  return new Date(dateStr);
}

function getLatestActivityDate(lead) {
  if (!lead) return null;
  const dates = [
    safeParseDate(lead.last_activity_at),
    safeParseDate(lead.updated_at),
    safeParseDate(lead.created_at)
  ].filter(d => d && !isNaN(d.getTime()));
  
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

const KanbanLeadCard = React.memo(function KanbanLeadCard({ lead, users = [], onAction, isDraggingOverlay = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { ...lead } });

  const [showMenu, setShowMenu] = useState(false);
  const [showReassignDropdown, setShowReassignDropdown] = useState(false);

  const dragStyles = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const slaLimit = lead.max_days_in_stage || 3;
  const isSlaBreached = lead.days_in_stage > slaLimit;
  const isOverdue = lead.follow_up_overdue_days > 0;

  const handleAction = (e, actionType) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onAction) onAction(actionType);
  };

  const getAgingStatus = () => {
    if (isSlaBreached) return { label: 'At Risk', color: 'rgba(239, 68, 68, 0.1)', textColor: 'var(--color-danger, #ef4444)', dot: '🔴' };
    if (lead.days_in_stage >= slaLimit - 1) return { label: 'Needs Attention', color: 'rgba(245, 158, 11, 0.1)', textColor: 'var(--color-warning, #f59e0b)', dot: '🟡' };
    return { label: 'Healthy', color: 'rgba(16, 185, 129, 0.1)', textColor: 'var(--color-success, #10b981)', dot: '🟢' };
  };

  const aging = getAgingStatus();
  const aiRec = lead.custom_fields?.ai_recommendation || lead.metadata?.ai_recommendation;

  const getStalenessBadge = () => {
    const date = getLatestActivityDate(lead);
    if (!date || isNaN(date.getTime())) return null;
    const daysOld = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (daysOld >= 7) return <span style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', fontWeight: 'bold', borderRadius: '4px' }}>Stale {daysOld}d</span>;
    if (daysOld <= 1) return <span style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', fontWeight: 'bold', borderRadius: '4px' }}>Fresh</span>;
    return null;
  };

  const staleBadge = getStalenessBadge();

  const handleCallClick = (e) => {
    e.stopPropagation();
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, '_self');
    }
  };

  const handleWhatsAppClick = (e) => {
    e.stopPropagation();
    if (lead.phone) {
      const sanitizedPhone = lead.phone.replace(/[^0-9]/g, '');
      // Add country code if missing
      const phoneWithCode = sanitizedPhone.length === 10 ? `91${sanitizedPhone}` : sanitizedPhone;
      const text = encodeURIComponent(`Hello ${lead.name || 'there'}, this is regarding your interior construction request.`);
      window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
    }
  };

  const handleScheduleClick = (e) => {
    e.stopPropagation();
    if (onAction) onAction('view');
  };

  const handleReassignSelect = (e) => {
    e.stopPropagation();
    const newRepId = e.target.value;
    if (onAction) onAction('reassign', newRepId);
    setShowReassignDropdown(false);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={dragStyles} 
      {...attributes} 
      {...listeners}
      onClick={() => { if (lead.id && onAction) onAction('view'); }}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ''}`}
    >
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle} title={lead.name}>{lead.name}</h4>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {lead.win_probability !== undefined && (
            <div 
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: '600',
                background: lead.win_probability > 70 ? 'var(--color-success-bg)' : lead.win_probability > 30 ? 'var(--color-warning-bg)' : 'var(--color-surface-2)',
                color: lead.win_probability > 70 ? 'var(--color-success)' : lead.win_probability > 30 ? 'var(--color-warning)' : 'var(--color-text-secondary)'
              }}
              title="Win Probability"
            >
              {lead.win_probability}%
            </div>
          )}
          <ScoreBadge score={lead.score} />
        </div>
      </div>

      {(lead.custom_fields?.ai_recommendation?.intent || lead.custom_fields?.ai_recommendation?.sentiment) && (
        <div className={styles.cardSubRow}>
          {lead.custom_fields.ai_recommendation.intent && (
            <span 
              className={styles.badgeTag}
              style={{
                background: lead.custom_fields.ai_recommendation.intent === 'high' ? 'rgba(16,185,129,0.1)' : lead.custom_fields.ai_recommendation.intent === 'low' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                color: lead.custom_fields.ai_recommendation.intent === 'high' ? 'var(--color-success)' : lead.custom_fields.ai_recommendation.intent === 'low' ? 'var(--color-danger)' : 'var(--color-warning)',
              }}
            >
              Intent: {lead.custom_fields.ai_recommendation.intent}
            </span>
          )}
          {lead.custom_fields.ai_recommendation.sentiment && (
            <span 
              className={styles.badgeTag}
              style={{
                background: 'rgba(255, 255, 255, 0.4)',
                border: '1px solid rgba(0,0,0,0.05)',
                color: 'var(--color-text-secondary)'
              }}
            >
              {lead.custom_fields.ai_recommendation.sentiment}
            </span>
          )}
        </div>
      )}

      <div className={styles.cardValue}>
        {lead.budget_max ? `₹${Number(lead.budget_max).toLocaleString('en-IN')}` : lead.revenue_potential ? `₹${Number(lead.revenue_potential).toLocaleString('en-IN')}` : '₹—'}
      </div>

      <div className={styles.cardDetails}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {aiRec ? (
            <div className={styles.aiStepContainer}>
              <span style={{ color: 'var(--color-info)' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI Next Step</span>
                <span style={{ color: 'var(--color-text)', fontWeight: '500', fontSize: '11px' }}>
                  {aiRec.recommendedAction}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              <span style={{ fontWeight: '600' }}>Next Action:</span>
              <span>{lead.ai_recommendation || 'Follow up'}</span>
              {lead.next_action_date && <span style={{ color: 'var(--color-text-muted)' }}>({lead.next_action_date})</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
          <span style={{ fontWeight: '500' }}>Locality:</span>
          <span>{lead.locality || 'Unknown'}</span>
          {staleBadge && <span style={{ marginLeft: 'auto' }}>{staleBadge}</span>}
        </div>
      </div>

      {showReassignDropdown && (
        <div onClick={(e) => e.stopPropagation()}>
          <select 
            className={styles.reassignSelect} 
            onChange={handleReassignSelect}
            defaultValue=""
          >
            <option value="" disabled>Select Rep...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.cardFooterLeft}>
          <div 
            className={styles.agingTag}
            style={{ background: aging.color, color: aging.textColor }}
            title={`${lead.days_in_stage || 0}d in stage. SLA: ${slaLimit}d`}
          >
            <span>{aging.dot}</span> {lead.days_in_stage || 0}d
          </div>
          {isOverdue && (
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--color-danger)', marginTop: '2px' }}>
              ⚠️ Overdue {lead.follow_up_overdue_days}d
            </div>
          )}
        </div>
        
        <div className={styles.actionButtonList}>
          {lead.assignee_avatar ? (
            <img src={lead.assignee_avatar} alt="avatar" style={{ width: '22px', height: '22px', borderRadius: '50%' }} title={lead.assignee_name} />
          ) : (
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(170, 59, 255, 0.12)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifySpace: 'center', fontSize: '9px', fontWeight: 'bold', justifyContent: 'center' }} title={lead.assignee_name || 'Unassigned'}>
              {(lead.assignee_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', borderLeft: '1px solid var(--color-border)', paddingLeft: '6px' }}>
             <button title="Call" onClick={handleCallClick} className={styles.actionIconBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
             </button>
             <button title="WhatsApp" onClick={handleWhatsAppClick} className={styles.actionIconBtn}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
             </button>
             <button title="Schedule" onClick={handleScheduleClick} className={styles.actionIconBtn}>📅</button>
             
             <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className={styles.actionIconBtn}
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
             </button>

             {showMenu && (
                <div className={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
                   <button className={styles.dropdownItem} onClick={(e) => { e.stopPropagation(); setShowReassignDropdown(true); setShowMenu(false); }}>Reassign</button>
                   <button className={styles.dropdownItem} onClick={(e) => handleAction(e, 'park')}>Park Lead</button>
                   <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={(e) => handleAction(e, 'lost')}>Mark Lost</button>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default KanbanLeadCard;
