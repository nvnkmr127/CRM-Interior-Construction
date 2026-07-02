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
  intentFilter, setIntentFilter,
  sortBy, setSortBy,
  view, setView,
  assignees,
  createdFrom, setCreatedFrom,
  createdTo, setCreatedTo,
  onClearFilters
}) {
  const [savedFilters, setSavedFilters] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_lead_saved_filters') || '[]');
    } catch {
      return [];
    }
  });

  const handleSaveFilter = () => {
    const name = window.prompt('Enter a name for this filter preset:');
    if (!name) return;
    
    const newFilter = {
      id: Date.now().toString(),
      name,
      config: {
        search, assigneeFilter, sourceFilter, scoreRange, intentFilter, sortBy, createdFrom, createdTo
      }
    };
    
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('crm_lead_saved_filters', JSON.stringify(updated));
  };

  const applySavedFilter = (id) => {
    if (!id) {
      onClearFilters();
      return;
    }
    const filter = savedFilters.find(f => f.id === id);
    if (!filter) return;
    
    setSearch(filter.config.search || '');
    setAssigneeFilter(filter.config.assigneeFilter || '');
    setSourceFilter(filter.config.sourceFilter || 'All Sources');
    setScoreRange(filter.config.scoreRange || 'all');
    if (typeof setIntentFilter === 'function') setIntentFilter(filter.config.intentFilter || 'all');
    setSortBy(filter.config.sortBy || 'latest');
    setCreatedFrom(filter.config.createdFrom || '');
    setCreatedTo(filter.config.createdTo || '');
  };

  const deleteSavedFilter = (id, e) => {
    e.stopPropagation();
    const updated = savedFilters.filter(f => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('crm_lead_saved_filters', JSON.stringify(updated));
  };

  return (
    <div className={styles.filterRow}>
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
        value={intentFilter || 'all'}
        onChange={e => {
          if (typeof setIntentFilter === 'function') setIntentFilter(e.target.value);
        }}
      >
        <option value="all">All Intents</option>
        <option value="Hot">Hot Intent</option>
        <option value="Warm">Warm Intent</option>
        <option value="Cold">Cold Intent</option>
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

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
        <select
          className={styles.filterSelect}
          onChange={e => applySavedFilter(e.target.value)}
          value=""
          style={{ width: '130px' }}
        >
          <option value="">Presets...</option>
          {savedFilters.map(sf => (
            <option key={sf.id} value={sf.id}>{sf.name}</option>
          ))}
        </select>
        <button 
          className={styles.clearBtn} 
          onClick={handleSaveFilter} 
          style={{ color: 'var(--color-primary, #3b82f6)' }}
          title="Save current filters"
        >
          Save
        </button>

        {(search || assigneeFilter || sourceFilter !== 'All Sources' || scoreRange !== 'all' || (intentFilter && intentFilter !== 'all') || createdFrom || createdTo) && (
          <button className={styles.clearBtn} onClick={onClearFilters}>✕ Clear</button>
        )}
      </div>

    </div>
  );
}
