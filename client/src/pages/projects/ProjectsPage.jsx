import { useState, useEffect } from 'react';
import { Button, Skeleton } from '../../components/ui';
import ProjectCard from '../../components/projects/ProjectCard';
import styles from './ProjectsPage.module.css';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../../api/projects';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getProjects()
      .then(res => {
        setProjects(res.data?.data || []);
        setError(null);
      })
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status?.toLowerCase() === statusFilter;
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const counts = {
    active: projects.filter(p => p.status === 'active').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    completed: projects.filter(p => p.status === 'completed').length,
    overdue: projects.filter(p => p.overdue).length
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <Button variant="primary" onClick={() => navigate('/projects/new')}>+ New Project</Button>
      </div>

      <div className={styles.kpiStrip}>
        <span>Active: {counts.active}</span> &middot;
        <span>On Hold: {counts.on_hold}</span> &middot;
        <span>Completed: {counts.completed}</span> &middot;
        <span className={styles.dangerText}>Overdue: {counts.overdue}</span>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.pills}>
          {['all', 'active', 'completed'].map(s => (
            <button
              key={s}
              className={statusFilter === s ? styles.pillActive : styles.pill}
              onClick={() => setStatusFilter(s)}
              style={{background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px'}}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <input
            className={styles.search}
            placeholder="⌕ Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{display:'flex', gap:'4px'}}>
            <Button variant={view==='grid'?'secondary':'ghost'} size="sm" onClick={()=>setView('grid')}>⊞</Button>
            <Button variant={view==='list'?'secondary':'ghost'} size="sm" onClick={()=>setView('list')}>≡</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} height="200px" />)}
        </div>
      ) : error ? (
        <div style={{padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-danger)'}}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)'}}>No projects found.</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
