/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Button, Skeleton, Pagination } from '../../components/ui';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectForm from '../../components/projects/ProjectForm';
import styles from './ProjectsPage.module.css';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../../api/projects';

const SORT_OPTIONS = [
  { value: 'deadline_asc', label: 'Deadline ↑' },
  { value: 'value_asc', label: 'Value ↑' },
  { value: 'progress_asc', label: 'Progress ↑' },
  { value: 'phase', label: 'Phase' },
];

function formatValue(val) {
  if (!val) return '—';
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : val;
  if (isNaN(num)) return val;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function StatusBadge({ status }) {
  const map = {
    active: { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    on_hold: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    completed: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    overdue: { color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  };
  const s = status?.toLowerCase();
  const style = map[s] || { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 600,
      color: style.color, background: style.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.color, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function MiniProgressBar({ value }) {
  return (
    <div style={{ width: 80 }}>
      <div className={styles.miniProgress}>
        <div className={styles.miniProgressFill} style={{ width: `${Math.min(value || 0, 100)}%` }} />
      </div>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2, display: 'block' }}>
        {value || 0}%
      </span>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pmFilter, setPmFilter] = useState('all');
  const [sortBy, setSortBy] = useState('deadline_asc');
  
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadProjects = () => {
    setLoading(true);
    getProjects({ page, limit })
      .then(res => {
        const rawData = res.data?.data || res.data?.results || res.data;
        const arr = Array.isArray(rawData) ? rawData : [];
        setProjects(arr);
        
        if (res.data?.pagination) {
          setTotal(res.data.pagination.total || 0);
        } else if (res.data?.total !== undefined) {
          setTotal(res.data.total);
        } else {
          setTotal(arr.length);
        }
        setError(null);
      })
      .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load projects.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, [page, limit]);

  const counts = {
    active: projects.filter(p => p.status === 'active').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    completed: projects.filter(p => p.status === 'completed').length,
    overdue: projects.filter(p => p.overdue).length,
  };

  const pmOptions = ['all', ...Array.from(new Set(projects.map(p => p.pm_name || p.pmName).filter(Boolean)))];

  const filtered = projects
    .filter(p => {
      if (statusFilter === 'overdue') return !!p.overdue;
      if (statusFilter !== 'all') return p.status?.toLowerCase() === statusFilter;
      return true;
    })
    .filter(p => {
      if (pmFilter === 'all') return true;
      const name = p.pm_name || p.pmName || '';
      return name === pmFilter;
    })
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.client_name?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'deadline_asc') {
        return new Date(a.target_date || a.targetDate || 0) - new Date(b.target_date || b.targetDate || 0);
      }
      if (sortBy === 'value_asc') {
        const av = parseFloat(String(a.value || '0').replace(/[^\d.]/g, '')) || 0;
        const bv = parseFloat(String(b.value || '0').replace(/[^\d.]/g, '')) || 0;
        return av - bv;
      }
      if (sortBy === 'progress_asc') {
        return (a.progress || 0) - (b.progress || 0);
      }
      if (sortBy === 'phase') {
        return (a.phase || '').localeCompare(b.phase || '');
      }
      return 0;
    });

  const statChips = [
    { key: 'active', label: 'Active', count: counts.active, color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    { key: 'on_hold', label: 'On Hold', count: counts.on_hold, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    { key: 'completed', label: 'Completed', count: counts.completed, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    { key: 'overdue', label: 'Overdue', count: counts.overdue, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Project</Button>
      </div>

      {/* Stats Ribbon */}
      <div className={styles.statsRibbon}>
        {statChips.map(chip => {
          const isActive = statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              className={`${styles.statChip} ${isActive ? styles.statChipActive : ''}`}
              style={{
                '--chip-color': chip.color,
                '--chip-bg': chip.bg,
                background: isActive ? chip.bg : 'var(--color-surface)',
                borderColor: isActive ? chip.color : 'var(--color-border)',
              }}
              onClick={() => setStatusFilter(prev => prev === chip.key ? 'all' : chip.key)}
            >
              <span className={styles.statDot} style={{ background: chip.color }} />
              <span style={{ color: chip.color, fontVariantNumeric: 'tabular-nums' }}>{chip.count}</span>
              <span style={{ color: isActive ? chip.color : 'var(--color-text-secondary)' }}>{chip.label}</span>
            </button>
          );
        })}
        {statusFilter !== 'all' && (
          <button
            className={styles.statChip}
            onClick={() => setStatusFilter('all')}
            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', fontSize: 'var(--text-xs)' }}
          >
            Clear filter ×
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search projects or clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.filterSelect}
          value={pmFilter}
          onChange={e => setPmFilter(e.target.value)}
        >
          <option value="all">All PMs</option>
          {pmOptions.filter(o => o !== 'all').map(pm => (
            <option key={pm} value={pm}>{pm}</option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            Grid
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="2" width="14" height="2" rx="1" />
              <rect x="1" y="7" width="14" height="2" rx="1" />
              <rect x="1" y="12" width="14" height="2" rx="1" />
            </svg>
            List
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.grid}>
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} height="220px" />)}
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠</div>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>No projects found</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Try adjusting your search or filters.
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className={styles.grid}>
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/projects/${p.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.listWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th className={styles.listTh}>Project Name</th>
                <th className={styles.listTh}>Client</th>
                <th className={styles.listTh}>PM</th>
                <th className={styles.listTh}>Status</th>
                <th className={styles.listTh}>Phase</th>
                <th className={styles.listTh}>Progress</th>
                <th className={styles.listTh}>Value</th>
                <th className={styles.listTh}>Deadline</th>
                <th className={styles.listTh}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const deadline = p.target_date || p.targetDate;
                const isOverdue = !!p.overdue;
                return (
                  <tr
                    key={p.id}
                    className={styles.listTr}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <td className={styles.listTd}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</span>
                    </td>
                    <td className={styles.listTd} style={{ color: 'var(--color-text-secondary)' }}>
                      {p.client_name || p.clientName || '—'}
                    </td>
                    <td className={styles.listTd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className={styles.pmAvatarSm}>
                          {(p.pm_name || p.pmName || '?').charAt(0)}
                        </div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                          {p.pm_name || p.pmName || '—'}
                        </span>
                      </div>
                    </td>
                    <td className={styles.listTd}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className={styles.listTd}>
                      <span className={styles.phaseTag}>{p.phase || '—'}</span>
                    </td>
                    <td className={styles.listTd}>
                      <MiniProgressBar value={p.progress} />
                    </td>
                    <td className={styles.listTd} style={{ fontWeight: 600 }}>
                      {formatValue(p.value)}
                    </td>
                    <td className={`${styles.listTd} ${isOverdue ? styles.dangerText : ''}`}>
                      {deadline ? new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      {isOverdue && <span style={{ display: 'block', fontSize: 10, fontWeight: 600 }}>OVERDUE</span>}
                    </td>
                    <td className={styles.listTd} onClick={e => e.stopPropagation()}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination 
            currentPage={page} 
            totalItems={total} 
            itemsPerPage={limit} 
            onPageChange={setPage} 
          />
        </div>
      )}

      <ProjectForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={() => { setIsFormOpen(false); loadProjects(); }}
      />
    </div>
  );
}
