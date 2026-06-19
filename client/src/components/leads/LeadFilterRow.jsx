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
  assignees,
  createdFrom, setCreatedFrom,
  createdTo, setCreatedTo,
  onClearFilters
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

      <input
        type="date"
        className={styles.filterSelect}
        value={createdFrom}
        onChange={e => setCreatedFrom(e.target.value)}
        title="Created from"
      />
      <input
        type="date"
        className={styles.filterSelect}
        value={createdTo}
        onChange={e => setCreatedTo(e.target.value)}
        title="Created to"
      />

      <select
        className={styles.filterSelect}
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {(search || assigneeFilter || sourceFilter !== 'All Sources' || scoreRange !== 'all' || createdFrom || createdTo) && (
        <button className={styles.clearBtn} onClick={onClearFilters}>✕ Clear</button>
      )}

      <div className="flex border border-gray-300 rounded-md overflow-hidden shrink-0 bg-white">
        <button
          onClick={() => setView('list')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-600 hover:bg-gray-50 border-r border-gray-300'}`}
        >
          &#9776; List
        </button>
        <button
          onClick={() => setView('kanban')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-600 hover:bg-gray-50 border-r border-gray-300'}`}
        >
          &#9638; Kanban
        </button>
        <button
          onClick={() => setView('map')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === 'map' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          &#128506; Map
        </button>
      </div>
    </div>
  );
}
