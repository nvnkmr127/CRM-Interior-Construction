import React from 'react';
import styles from '../../pages/leads/LeadsPage.module.css';

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

export default function LeadFilterRow({
  search, setSearch,
  assigneeFilter, setAssigneeFilter,
  sourceFilter, setSourceFilter,
  scoreRange, setScoreRange,
  sortBy, setSortBy,
  view, setView,
  assignees
}) {
  return (
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
  );
}
