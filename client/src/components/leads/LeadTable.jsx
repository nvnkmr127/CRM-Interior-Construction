/* eslint-disable no-useless-assignment */
import React from 'react';
import { Pagination, EmptyState, ContentLoader, Button } from '../../components/ui';
import { syncCommunications } from '../../api/leads';
import { useConfirm } from '../../store/confirmContext';
import styles from '../../pages/leads/LeadsPage.module.css';
import LeadsBulkActionsModal from './LeadsBulkActionsModal';
import SingleLeadActionModal from './SingleLeadActionModal';

function scoreClass(score) {
  if (score >= 61) return styles.scoreHigh;
  if (score >= 31) return styles.scoreMid;
  return styles.scoreLow;
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = safeParseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = (import.meta.env.DEV && new Date().getTime() >= 1786536584000) ? new Date(1786536584000) : new Date();
  const diffMs = now - d;
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatMeetingSchedule(dateStr) {
  if (!dateStr) return null;
  const d = safeParseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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

function getAgingBadge(lastActivityAt, createdAt) {
  const date = safeParseDate(lastActivityAt || createdAt);
  if (isNaN(date.getTime())) return null;
  const now = (import.meta.env.DEV && new Date().getTime() >= 1786536584000) ? new Date(1786536584000) : new Date();
  const daysOld = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (daysOld >= 7) return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">Stale {daysOld}d</span>;
  if (daysOld <= 1) return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Fresh</span>;
  return null;
}

export default function LeadTable({
  filteredLeads, loading, page, limit, total, setPage,
  setSelectedLeadId, stageMenuLeadId, setStageMenuLeadId,
  stages, handleMoveStage, bulkChangeStage, bulkDelete, clearFilters,
  refetch, search, users = []
}) {
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [showBulkStageMenu, setShowBulkStageMenu] = React.useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = React.useState(false);
  const [showSingleActionModal, setShowSingleActionModal] = React.useState(false);
  const [syncingLeadIds, setSyncingLeadIds] = React.useState(new Set());
  const { confirm } = useConfirm();

  const handleSyncWhatsApp = async (e, leadId) => {
    e.stopPropagation();
    const newSyncing = new Set(syncingLeadIds);
    newSyncing.add(leadId);
    setSyncingLeadIds(newSyncing);
    try {
      await syncCommunications(leadId);
      if (refetch) await refetch();
    } catch (err) {
      console.error('Failed to sync WhatsApp status:', err);
    } finally {
      setSyncingLeadIds(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const renderWhatsAppStatus = (lead) => {
    const status = lead.last_whatsapp_status;
    const direction = lead.last_whatsapp_direction;
    const reaction = lead.last_whatsapp_reaction;
    const isSyncing = syncingLeadIds.has(lead.id);

    if (!status) return <span className="text-gray-400">—</span>;

    let icon = null;
    let statusText = '';
    let colorClass = '';

    if (direction === 'inbound') {
      icon = '📥';
      statusText = 'Received';
      colorClass = 'text-green-700 border-green-200 bg-green-500/10 backdrop-blur-md';
    } else {
      switch (status) {
        case 'sent':
          icon = '✓';
          statusText = 'Sent';
          colorClass = 'text-gray-700 border-gray-200 bg-white/40 backdrop-blur-md';
          break;
        case 'delivered':
          icon = '✓✓';
          statusText = 'Delivered';
          colorClass = 'text-gray-600 border-gray-300 bg-white/40 backdrop-blur-md';
          break;
        case 'read':
        case 'seen':
          icon = '✓✓';
          statusText = 'Seen';
          colorClass = 'text-blue-700 border-blue-200 bg-blue-500/10 backdrop-blur-md';
          break;
        case 'reacted':
          icon = reaction || '❤️';
          statusText = 'Reacted';
          colorClass = 'text-purple-700 border-purple-200 bg-purple-500/10 backdrop-blur-md';
          break;
        case 'replied':
          icon = '💬';
          statusText = 'Replied';
          colorClass = 'text-indigo-700 border-indigo-200 bg-indigo-500/10 backdrop-blur-md';
          break;
        case 'failed':
          icon = '⚠️';
          statusText = 'Failed';
          colorClass = 'text-red-700 border-red-200 bg-red-500/10 backdrop-blur-md';
          break;
        default:
          icon = '✓';
          statusText = status;
          colorClass = 'text-gray-700 border-gray-200 bg-white/40 backdrop-blur-md';
      }
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
        <span className={`px-2 py-0.5 rounded border text-xs font-semibold flex items-center gap-1 ${colorClass}`}>
          <span style={{ fontSize: '10px' }}>{icon}</span> {statusText}
        </span>
        {lead.phone && (
          <button
            onClick={(e) => handleSyncWhatsApp(e, lead.id)}
            disabled={isSyncing}
            className={`${styles.actionIconBtn} p-0.5 hover:bg-white/40 rounded transition-colors`}
            title="Sync WhatsApp chat status"
            style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isSyncing ? (
              <svg className="animate-spin h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const selected = new Set(filteredLeads.map(l => l.id));
      setSelectedIds(selected);
      if (selected.size === 1) {
        setShowSingleActionModal(true);
        setShowBulkActionsModal(false);
      } else if (selected.size > 1) {
        setShowBulkActionsModal(true);
        setShowSingleActionModal(false);
      }
    } else {
      setSelectedIds(new Set());
      setShowSingleActionModal(false);
      setShowBulkActionsModal(false);
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);

    if (newSet.size === 1) {
      setShowSingleActionModal(true);
      setShowBulkActionsModal(false);
    } else if (newSet.size > 1) {
      setShowBulkActionsModal(true);
      setShowSingleActionModal(false);
    } else {
      setShowSingleActionModal(false);
      setShowBulkActionsModal(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowBulkStageMenu(false);
  };
  
  const handleBulkMove = async (stageId) => {
    try {
      await bulkChangeStage(Array.from(selectedIds), stageId);
      clearSelection();
    } catch (err) {
      console.error('Failed to bulk move leads', err);
      const apiErr = err.response?.data?.error;
      if (apiErr?.code === 'STAGE_GATE_FAILED' && apiErr?.missing?.length > 0) {
        alert(`Missing Required Fields: ${apiErr.missing.join(', ')} required to move these leads.`);
      } else {
        alert(apiErr?.message || 'Failed to bulk move leads');
      }
    }
  };

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Delete Leads',
      message: `Are you sure you want to delete the selected ${selectedIds.size} lead(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDanger: true
    });
    if (!isConfirmed) return;

    try {
      await bulkDelete(Array.from(selectedIds));
      clearSelection();
    } catch (err) {
      console.error('Failed to bulk delete leads', err);
      alert('Failed to bulk delete leads');
    }
  };
  if (loading) {
    return (
      <div className={styles.listWrapper} style={{ padding: '20px' }}>
        <ContentLoader type="table" rows={5} />
      </div>
    );
  }

  return (
    <div className={styles.listWrapper}>
      <div className="overflow-x-auto">
        <table className={styles.listTable}>
        <thead>
          <tr>
            <th className={styles.listTh} style={{ width: '40px' }}>
              <input 
                type="checkbox" 
                checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                onChange={handleSelectAll}
              />
            </th>
            <th className={styles.listTh} style={{ width: '50px' }}>#</th>
            <th className={styles.listTh}>Name</th>
            <th className={styles.listTh}>Phone</th>
            <th className={styles.listTh}>Source</th>
            <th className={styles.listTh}>Stage</th>
            <th className={styles.listTh}>Score</th>
            <th className={styles.listTh}>Intent</th>
            <th className={styles.listTh}>AI Recommendation</th>
            <th className={styles.listTh}>Assignee</th>
            <th className={styles.listTh}>Communication</th>
            <th className={styles.listTh}>Meeting Schedule</th>
            <th className={styles.listTh}>Last Activity</th>
            <th className={styles.listTh} style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredLeads.length === 0 ? (
            <tr>
              <td colSpan={13} style={{ padding: '40px 0' }}>
                <EmptyState 
                  icon="🔍"
                  title={search ? `No leads found matching "${search}"` : "No leads found"}
                  description="Try adjusting your search or filters to find what you're looking for."
                  action={{ label: 'Clear Filters', onClick: clearFilters }}
                />
              </td>
            </tr>
          ) : (
            filteredLeads.map((lead, idx) => (
              <tr
                key={lead.id}
                className={styles.listTr}
                onClick={() => setSelectedLeadId(lead.id)}
                tabIndex="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedLeadId(lead.id);
                  }
                }}
              >
                <td className={styles.listTd} onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => handleSelectRow(e, lead.id)}
                  />
                </td>
                <td className={styles.listTd}>
                  <span className="text-gray-500 font-medium">
                    {total ? total - ((page - 1) * limit + idx) : (page - 1) * limit + idx + 1}
                  </span>
                </td>
                <td className={styles.listTd}>
                  <div className={styles.leadName}>
                    <div className={styles.avatar}>{getInitials(lead.name)}</div>
                    <span>{lead.name || '—'}</span>
                  </div>
                </td>
                <td className={styles.listTd}>
                  <span className={styles.phoneText}>{lead.phone || '—'}</span>
                </td>
                <td className={styles.listTd}>
                  <span className={styles.sourceTag}>{lead.source || '—'}</span>
                </td>
                <td className={styles.listTd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span title={`${lead.days_in_stage || 0}d in stage. SLA: ${lead.max_days_in_stage || 3}d`} style={{ fontSize: '10px' }}>
                      {lead.days_in_stage > (lead.max_days_in_stage || 3) ? '🔴' : lead.days_in_stage >= (lead.max_days_in_stage || 3) - 1 ? '🟡' : '🟢'}
                    </span>
                    <span className={styles.stageTag}>{lead.stage_name || '—'}</span>
                  </div>
                </td>
                <td className={styles.listTd}>
                  {lead.score != null ? (
                    <span 
                      className={`${styles.scoreChip} ${scoreClass(Number(lead.score))}`}
                      title={lead.custom_fields?.score_breakdown?.length 
                        ? lead.custom_fields.score_breakdown.map(i => `${i.rule_name}: ${i.points > 0 ? '+' : ''}${i.points}`).join('\n') 
                        : 'Click lead to view score breakdown'
                      }
                    >
                      {lead.score}
                    </span>
                  ) : (
                    <span className={styles.noScore}>—</span>
                  )}
                </td>
                <td className={styles.listTd}>
                  {lead.buying_intent ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      lead.buying_intent === 'Hot' ? 'bg-red-500/10 backdrop-blur-md text-red-700 border border-red-200' :
                      lead.buying_intent === 'Warm' ? 'bg-orange-500/10 backdrop-blur-md text-orange-700 border border-orange-200' :
                      lead.buying_intent === 'Cold' ? 'bg-blue-500/10 backdrop-blur-md text-blue-700 border border-blue-200' :
                      'bg-white/40 backdrop-blur-md text-gray-700 border border-gray-200'
                    }`}>
                      {lead.buying_intent === 'Hot' && '🔥 '}
                      {lead.buying_intent === 'Warm' && '☀️ '}
                      {lead.buying_intent === 'Cold' && '❄️ '}
                      {lead.buying_intent}
                    </span>
                  ) : (
                    <span className={styles.noScore}>—</span>
                  )}
                </td>
                <td className={styles.listTd}>
                  <span style={{ fontSize: '12px', background: 'var(--color-surface-2)', padding: '4px 8px', borderRadius: '4px', color: 'var(--color-text-secondary)' }}>
                    {lead.ai_recommendation || 'Follow up'}
                  </span>
                </td>
                <td className={styles.listTd}>
                  {lead.assignee_name ? (
                    <div className={styles.assigneeCell}>
                      <div className={styles.avatarSm}>{getInitials(lead.assignee_name)}</div>
                      <span>{lead.assignee_name}</span>
                    </div>
                  ) : (
                    <span className={styles.unassigned}>Unassigned</span>
                  )}
                </td>
                 <td className={styles.listTd}>
                  {renderWhatsAppStatus(lead)}
                </td>
                <td className={styles.listTd}>
                  {lead.next_meeting_schedule ? (
                    <span className="font-semibold text-xs text-orange-700 bg-orange-500/10 backdrop-blur-md border border-orange-200 px-2 py-0.5 rounded flex items-center gap-1 w-max">
                      📅 {formatMeetingSchedule(lead.next_meeting_schedule)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className={styles.listTd}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className={styles.lastActivity}>
                      {formatDate(getLatestActivityDate(lead))}
                    </span>
                    {getAgingBadge(getLatestActivityDate(lead))}
                  </div>
                </td>
                <td className={styles.listTd} onClick={e => e.stopPropagation()}>
                  <div className={styles.actionGroup}>
                    <button className={styles.actionIconBtn} title="Call" aria-label="Call">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </button>
                    <button className={styles.actionIconBtn} title="WhatsApp" aria-label="WhatsApp">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                    </button>
                    <button 
                      className={`${styles.actionIconBtn} ${!lead.email ? 'opacity-50 cursor-not-allowed' : ''}`} 
                      title={lead.email ? "Email" : "No email address"} 
                      aria-label="Email"
                      disabled={!lead.email}
                      onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </button>
                    <div className={styles.stageMenuWrap}>
                      <button
                        className={styles.actionIconBtn}
                        title="Move stage"
                        aria-label={`Move ${lead.name} to another stage`}
                        onClick={() => setStageMenuLeadId(stageMenuLeadId === lead.id ? null : lead.id)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="m12 16 4-4-4-4"/></svg>
                      </button>
                      {stageMenuLeadId === lead.id && (
                        <div className={styles.stageDropdown}>
                          {stages.map(s => (
                            <button
                              key={s.id}
                              className={styles.stageDropdownItem}
                              onClick={async () => {
                                try {
                                  await handleMoveStage(lead.id, s.id);
                                } catch (err) {
                                  const apiErr = err.response?.data?.error;
                                  if (apiErr?.code === 'STAGE_GATE_FAILED' && apiErr?.missing?.length > 0) {
                                    alert(`Missing Required Fields: ${apiErr.missing.join(', ')} required for this stage.`);
                                  } else {
                                    alert(apiErr?.message || 'Failed to move stage');
                                  }
                                }
                              }}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className={styles.actionIconBtn}
                      title="View lead"
                      aria-label={`View details for ${lead.name}`}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', marginLeft: '8px' }}>
          Showing <b>{filteredLeads.length}</b> leads {total > 0 && <span>(out of <b>{total}</b> matching records)</span>}
        </div>
        <Pagination 
          currentPage={page} 
          totalItems={total} 
          itemsPerPage={limit} 
          onPageChange={setPage} 
        />
      </div>

      {showBulkActionsModal && (
        <LeadsBulkActionsModal
          isOpen={showBulkActionsModal}
          onClose={() => {
            setShowBulkActionsModal(false);
            clearSelection();
          }}
          selectedLeadIds={Array.from(selectedIds)}
          filteredLeads={filteredLeads}
          users={users}
          stages={stages}
          onUpdateSuccess={() => {
            clearSelection();
            if (refetch) refetch();
          }}
        />
      )}

      {showSingleActionModal && selectedIds.size === 1 && (
        <SingleLeadActionModal
          isOpen={showSingleActionModal}
          onClose={() => {
            setShowSingleActionModal(false);
            clearSelection();
          }}
          leadId={Array.from(selectedIds)[0]}
          filteredLeads={filteredLeads}
          users={users}
          stages={stages}
          onUpdateSuccess={() => {
            clearSelection();
            if (refetch) refetch();
          }}
        />
      )}

    </div>
  );
}
