/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Button, Skeleton, Pagination, PermissionButton } from '../../components/ui';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectForm from '../../components/projects/ProjectForm';
import styles from './ProjectsPage.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { getProjects } from '../../api/projects';

const SORT_OPTIONS = [
  { value: 'deadline_asc', label: 'Deadline ↑' },
  { value: 'value_asc', label: 'Value ↑' },
  { value: 'progress_asc', label: 'Progress ↑' },
];

function formatValue(val) {
  if (!val) return '—';
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : val;
  if (isNaN(num)) return val;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function StatusBadge({ status, deleted }) {
  const map = {
    active: { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
    on_hold: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    completed: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    overdue: { color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
    pending_payment: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    deleted: { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' },
  };
  const s = deleted ? 'deleted' : status?.toLowerCase();
  const style = map[s] || { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' };
  
  const displayStatus = s === 'deleted' 
    ? 'Deleted' 
    : (status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown');

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 600,
      color: style.color, background: style.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.color, flexShrink: 0 }} />
      {displayStatus}
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
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  
  const [view, setView] = useState(queryParams.get('view') || 'grid');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(queryParams.get('status') || 'active');
  const [search, setSearch] = useState(queryParams.get('search') || '');
  const [pmFilter, setPmFilter] = useState(queryParams.get('pm') || 'all');
  const [extraFilter, setExtraFilter] = useState(queryParams.get('filter') || 'all');
  
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadProjects = () => {
    setLoading(true);
    getProjects({ 
      page, 
      limit, 
      includeDeleted: true
    })
      .then(res => {
        const rawData = res.data?.data || res.data?.results || res.data;
        const arr = Array.isArray(rawData) ? rawData : [];
        setProjects(arr);
        
        if (res.data?.meta?.total !== undefined) {
          setTotal(res.data.meta.total);
        } else if (res.data?.pagination) {
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

  useEffect(() => { loadProjects(); }, [page, limit, statusFilter, search, pmFilter]);

  useEffect(() => {
    const handleDbChange = () => {
      loadProjects();
    };
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, [page, limit, statusFilter, search, pmFilter]);

  // Sync state changes to URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;

    if (view !== 'grid') { params.set('view', view); changed = true; } 
    else if (params.has('view')) { params.delete('view'); changed = true; }

    if (statusFilter !== 'all') { params.set('status', statusFilter); changed = true; }
    else if (params.has('status')) { params.delete('status'); changed = true; }

    if (search) { params.set('search', search); changed = true; }
    else if (params.has('search')) { params.delete('search'); changed = true; }

    if (pmFilter !== 'all') { params.set('pm', pmFilter); changed = true; }
    else if (params.has('pm')) { params.delete('pm'); changed = true; }

    if (extraFilter !== 'all') { params.set('filter', extraFilter); changed = true; }
    else if (params.has('filter')) { params.delete('filter'); changed = true; }

    if (changed) {
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [view, statusFilter, search, pmFilter, navigate, location.search, extraFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setIsFormOpen(true);
      params.delete('new');
      navigate({ search: params.toString() }, { replace: true });
    }
  }, []);

  const isActiveStatus = (status) => {
    const s = status?.toLowerCase();
    return !s || s === 'active' || !['on_hold', 'completed', 'overdue', 'cancelled', 'deleted'].includes(s);
  };

  const pmOptions = ['all', ...Array.from(new Set(projects.map(p => p.pm_name || p.pmName).filter(Boolean)))];

  const preFiltered = projects
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
    });

  const counts = {
    all: preFiltered.length,
    active: preFiltered.filter(p => isActiveStatus(p.status) && !(p.deleted_at || p.deletedAt)).length,
    on_hold: preFiltered.filter(p => p.status?.toLowerCase() === 'on_hold' && !(p.deleted_at || p.deletedAt)).length,
    completed: preFiltered.filter(p => p.status?.toLowerCase() === 'completed' && !(p.deleted_at || p.deletedAt)).length,
    overdue: preFiltered.filter(p => p.overdue && !(p.deleted_at || p.deletedAt)).length,
    deleted: preFiltered.filter(p => (p.deleted_at || p.deletedAt)).length,
  };

  const filtered = preFiltered
    .filter(p => {
      if (statusFilter === 'all') {
        // "in all column it should display all projects irrespective of status"
        return true;
      }
      if (statusFilter === 'deleted') {
        return p.deleted_at || p.deletedAt;
      }
      if (statusFilter === 'overdue') {
        return p.overdue && !(p.deleted_at || p.deletedAt);
      }
      if (statusFilter === 'active') {
        return isActiveStatus(p.status) && !(p.deleted_at || p.deletedAt);
      }
      return p.status?.toLowerCase() === statusFilter && !(p.deleted_at || p.deletedAt);
    })
    .filter(p => {
      if (extraFilter === 'all') return true;
      
      const createdDate = new Date(p.created_at || p.createdAt || Date.now());
      const ageInDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
      
      if (extraFilter === 'new') return ageInDays < 30;
      if (extraFilter === 'old') return ageInDays >= 30;
      if (extraFilter === 'overdue') return p.overdue || (p.target_date && new Date(p.target_date) < new Date());
      if (extraFilter === 'pending_payment') return p.status?.toLowerCase() === 'pending_payment';
      if (extraFilter === 'scope_unlocked') return !p.is_scope_locked && !p.isScopeLocked;
      if (extraFilter === 'scope_locked') return p.is_scope_locked || p.isScopeLocked;
      
      const val = parseFloat(String(p.contract_value || p.value || '0').replace(/[^\d.]/g, '')) || 0;
      if (extraFilter === 'high_value') return val >= 500000;
      if (extraFilter === 'low_value') return val < 500000;
      
      if (extraFilter === 'no_pm') return !p.pm_id && !p.pmId;
      if (extraFilter === 'no_designer') return !p.designer_id && !p.designerId;
      
      if (extraFilter === 'phase_concept') return p.phase?.toLowerCase().includes('concept');
      if (extraFilter === 'phase_detailed') return p.phase?.toLowerCase().includes('detailed') || p.phase?.toLowerCase().includes('design');
      if (extraFilter === 'phase_execution') return p.phase?.toLowerCase().includes('execution');
      if (extraFilter === 'phase_handover') return p.phase?.toLowerCase().includes('handover');
      
      if (extraFilter === 'sort_deadline' || extraFilter === 'sort_value' || extraFilter === 'sort_progress') return true;
      
      return true;
    })
    .sort((a, b) => {
      if (extraFilter === 'sort_value') {
        const av = parseFloat(String(a.contract_value || a.value || '0').replace(/[^\d.]/g, '')) || 0;
        const bv = parseFloat(String(b.contract_value || b.value || '0').replace(/[^\d.]/g, '')) || 0;
        return av - bv;
      }
      if (extraFilter === 'sort_progress') {
        return (a.progress || 0) - (b.progress || 0);
      }
      // Default: sort by target date ascending
      return new Date(a.target_date || a.targetDate || 0) - new Date(b.target_date || b.targetDate || 0);
    });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <PermissionButton module="projects" action="create">
          <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Project</Button>
        </PermissionButton>
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
          value={extraFilter}
          onChange={e => setExtraFilter(e.target.value)}
          style={{ marginLeft: '8px' }}
        >
          <option value="all">All Projects</option>
          <option value="sort_deadline">Deadline ↑</option>
          <option value="sort_value">Value ↑</option>
          <option value="sort_progress">Progress ↑</option>
          <option value="new">New Projects (&lt; 30 Days)</option>
          <option value="old">Old Projects (&ge; 30 Days)</option>
          <option value="overdue">Overdue Projects</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="scope_unlocked">Scope Unlocked</option>
          <option value="scope_locked">Scope Locked</option>
          <option value="high_value">High Value (&ge; ₹5L)</option>
          <option value="low_value">Low Value (&lt; ₹5L)</option>
          <option value="no_pm">Unassigned PM</option>
          <option value="no_designer">Unassigned Designer</option>
          <option value="phase_concept">Concept Design Phase</option>
          <option value="phase_detailed">Detailed Design Phase</option>
          <option value="phase_execution">Execution Phase</option>
          <option value="phase_handover">Handover Phase</option>
        </select>

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ marginLeft: '8px' }}
        >
          <option value="all">All Status ({counts.all})</option>
          <option value="active">Active ({counts.active})</option>
          <option value="on_hold">On Hold ({counts.on_hold})</option>
          <option value="completed">Completed ({counts.completed})</option>
          <option value="overdue">Overdue ({counts.overdue})</option>
          <option value="deleted">Deleted ({counts.deleted})</option>
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
                      <StatusBadge status={p.status} deleted={!!(p.deleted_at || p.deletedAt)} />
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
