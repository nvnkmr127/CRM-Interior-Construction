import React from 'react';
import { Pagination, EmptyState, ContentLoader, Button } from '../../components/ui';
import styles from '../../pages/leads/LeadsPage.module.css';

function scoreClass(score) {
  if (score >= 61) return styles.scoreHigh;
  if (score >= 31) return styles.scoreMid;
  return styles.scoreLow;
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function LeadTable({
  filteredLeads, loading, page, limit, total, setPage,
  setSelectedLeadId, stageMenuLeadId, setStageMenuLeadId,
  stages, handleMoveStage, clearFilters
}) {
  const [selectedIds, setSelectedIds] = React.useState(new Set());

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const clearSelection = () => setSelectedIds(new Set());
  if (loading) {
    return (
      <div className={styles.listWrapper} style={{ padding: '20px' }}>
        <ContentLoader type="table" rows={5} />
      </div>
    );
  }

  return (
    <div className={styles.listWrapper}>
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
            <th className={styles.listTh}>Name</th>
            <th className={styles.listTh}>Phone</th>
            <th className={styles.listTh}>Source</th>
            <th className={styles.listTh}>Stage</th>
            <th className={styles.listTh}>Score</th>
            <th className={styles.listTh}>Assignee</th>
            <th className={styles.listTh}>Last Activity</th>
            <th className={styles.listTh} style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredLeads.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ padding: '40px 0' }}>
                <EmptyState 
                  icon="🔍"
                  title="No leads found"
                  description="Try adjusting your search or filters to find what you're looking for."
                  action={{ label: 'Clear Filters', onClick: clearFilters }}
                />
              </td>
            </tr>
          ) : (
            filteredLeads.map(lead => (
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
                  <span className={styles.stageTag}>{lead.stage_name || '—'}</span>
                </td>
                <td className={styles.listTd}>
                  {lead.score != null ? (
                    <span className={`${styles.scoreChip} ${scoreClass(Number(lead.score))}`}>
                      {lead.score}
                    </span>
                  ) : (
                    <span className={styles.noScore}>—</span>
                  )}
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
                  <span className={styles.lastActivity}>
                    {formatDate(lead.last_activity_at || lead.updated_at)}
                  </span>
                </td>
                <td className={styles.listTd} onClick={e => e.stopPropagation()}>
                  <div className={styles.actionGroup}>
                    <div className={styles.stageMenuWrap}>
                      <button
                        className={styles.actionBtn}
                        title="Move stage"
                        aria-label={`Move ${lead.name} to another stage`}
                        onClick={() => setStageMenuLeadId(stageMenuLeadId === lead.id ? null : lead.id)}
                      >
                        ↗ Move
                      </button>
                      {stageMenuLeadId === lead.id && (
                        <div className={styles.stageDropdown}>
                          {stages.map(s => (
                            <button
                              key={s.id}
                              className={styles.stageDropdownItem}
                              onClick={() => handleMoveStage(lead.id, s.id)}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className={styles.actionBtn}
                      title="View lead"
                      aria-label={`View details for ${lead.name}`}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      ⋯
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      <Pagination 
        currentPage={page} 
        totalItems={total} 
        itemsPerPage={limit} 
        onPageChange={setPage} 
      />

      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-surface, #fff)', padding: '16px 24px',
          borderRadius: '8px', boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1))',
          display: 'flex', alignItems: 'center', gap: '24px', zIndex: 100, border: '1px solid var(--color-border)'
        }}>
          <div style={{ fontWeight: 500 }}>{selectedIds.size} selected</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={clearSelection}>Cancel</Button>
            <Button variant="primary" onClick={() => alert('Bulk move functionality pending backend support')}>Move Stage</Button>
          </div>
        </div>
      )}
    </div>
  );
}
