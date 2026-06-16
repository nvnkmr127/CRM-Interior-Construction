import React, { useState, useMemo } from 'react';
import { Button } from '../../components/ui';
import KanbanBoard from '../../components/leads/KanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import { useLeads } from '../../hooks/useLeads';
import styles from './LeadsPage.module.css';

const SOURCE_OPTIONS = ['All Sources', 'Facebook', 'IndiaMART', 'Referral', 'Website', 'Direct', 'Other'];
const SCORE_RANGES = [
  { label: 'All Scores', value: 'all' },
  { label: '0 – 30', value: '0-30' },
  { label: '31 – 60', value: '31-60' },
  { label: '61 – 100', value: '61-100' },
];
const SORT_OPTIONS = [
  { label: 'Latest', value: 'latest' },
  { label: 'Score', value: 'score' },
  { label: 'Name', value: 'name' },
];

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

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [view, setView] = useState('kanban');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);

  const filters = useMemo(() => {
    const f = {};
    if (search) f.search = search;
    if (sourceFilter && sourceFilter !== 'All Sources') f.source = sourceFilter;
    if (assigneeFilter) f.assigneeId = assigneeFilter;
    return f;
  }, [search, sourceFilter, assigneeFilter]);

  const { leads, stages, loading, optimisticStageChange } = useLeads(filters);

  // Derived stats
  const stats = useMemo(() => {
    const total = leads.length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonThisMonth = leads.filter(l => {
      const stageName = (l.stage_name || '').toLowerCase();
      if (!stageName.includes('won')) return false;
      const updated = new Date(l.updated_at || l.created_at);
      return !isNaN(updated) && updated >= startOfMonth;
    }).length;
    const scores = leads.map(l => Number(l.score || 0)).filter(s => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const wonLeads = leads.filter(l => (l.stage_name || '').toLowerCase().includes('won'));
    const convPct = total ? Math.round((wonLeads.length / total) * 100) : 0;
    return { total, wonThisMonth, avgScore, convPct };
  }, [leads]);

  // Unique assignees for dropdown
  const assignees = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      if (l.assignee_id && l.assignee_name) map[l.assignee_id] = l.assignee_name;
    });
    return Object.entries(map);
  }, [leads]);

  // Filtered + sorted leads for list view
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (scoreRange !== 'all') {
      const [lo, hi] = scoreRange.split('-').map(Number);
      result = result.filter(l => {
        const s = Number(l.score || 0);
        return s >= lo && s <= hi;
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'score') return (Number(b.score) || 0) - (Number(a.score) || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      // latest: most recently created/updated first
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return result;
  }, [leads, scoreRange, sortBy]);

  // Group for kanban
  const leadsByStage = useMemo(() => {
    const map = {};
    filteredLeads.forEach(l => {
      if (!map[l.stage_id]) map[l.stage_id] = [];
      map[l.stage_id].push(l);
    });
    return map;
  }, [filteredLeads]);

  const handleMoveStage = async (leadId, newStageId) => {
    try {
      await optimisticStageChange(leadId, newStageId);
    } catch {
      // error handling deferred to hook
    }
    setStageMenuLeadId(null);
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
      </div>

      {/* ── Stats Bar ── */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total Leads</span>
          <span className={styles.statValue}>{loading ? '—' : stats.total}</span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Won This Month</span>
          <span className={styles.statValue} style={{ color: 'var(--color-success)' }}>
            {loading ? '—' : stats.wonThisMonth}
          </span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Avg Conversion</span>
          <span className={styles.statValue} style={{ color: 'var(--color-accent)' }}>
            {loading ? '—' : `${stats.convPct}%`}
          </span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <span className={styles.statLabel}>Avg Score</span>
          <span className={styles.statValue}>{loading ? '—' : stats.avgScore}</span>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className={styles.filterRow}>
        <input
          className={styles.searchInput}
          placeholder="Search leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className={styles.filterSelect}
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
        >
          <option value="">All Assignees</option>
          {assignees.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
        >
          {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={scoreRange}
          onChange={e => setScoreRange(e.target.value)}
        >
          {SCORE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('kanban')}
            title="Kanban view"
          >
            ⊞ Kanban
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >
            ≡ List
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <span>Loading leads…</span>
          </div>
        ) : view === 'kanban' ? (
          <KanbanBoard
            stages={stages || []}
            leadsByStage={leadsByStage}
            onLeadClick={setSelectedLeadId}
          />
        ) : (
          <div className={styles.listWrapper}>
            <table className={styles.listTable}>
              <thead>
                <tr>
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
                    <td colSpan={8} className={styles.emptyRow}>
                      No leads match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr
                      key={lead.id}
                      className={styles.listTr}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
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
                              onClick={() =>
                                setStageMenuLeadId(stageMenuLeadId === lead.id ? null : lead.id)
                              }
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
          </div>
        )}
      </div>

      {/* ── Lead Drawer ── */}
      <LeadDrawer
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
      />

      {/* ── New Lead Form ── */}
      {isFormOpen && (
        <LeadForm onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  );
}
