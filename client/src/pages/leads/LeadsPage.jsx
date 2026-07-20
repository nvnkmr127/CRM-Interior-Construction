import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import LeadKanbanBoard from '../../components/leads/LeadKanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import LeadStatsBar from '../../components/leads/LeadStatsBar';
import LeadFilterRow from '../../components/leads/LeadFilterRow';
import LeadTable from '../../components/leads/LeadTable';
import LeadMap from '../../components/leads/LeadMap';
import LeadDashboard from '../../components/leads/LeadDashboard';
import LeadCalendar from '../../components/leads/LeadCalendar';
import LeadImportModal from '../../components/leads/LeadImportModal';
import { useLeads } from '../../hooks/useLeads';
import { useAuth } from '../../store/authContext';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role?.name === 'admin' || user?.role === 'superadmin' || user?.role?.name === 'superadmin';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;
    
    if (params.get('new') === 'true') {
      setIsFormOpen(true);
      params.delete('new');
      changed = true;
    }
    
    if (params.get('id')) {
      setSelectedLeadId(params.get('id'));
      params.delete('id');
      changed = true;
    }

    if (changed) {
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [location.search, navigate]);

  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('crm_leads_sortBy') || 'latest');

  useEffect(() => {
    localStorage.setItem('crm_leads_sortBy', sortBy);
  }, [sortBy]);
  const [view, setView] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [page, setPage] = useState(1);
  const limit = 20;

  const filters = useMemo(() => {
    const f = { page, limit };
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    if (sourceFilter && sourceFilter !== 'All Sources') f.source = sourceFilter;
    if (assigneeFilter) f.assigneeId = assigneeFilter;
    if (scoreRange && scoreRange !== 'all') f.scoreRange = scoreRange;
    if (intentFilter && intentFilter !== 'all') f.intent = intentFilter;
    if (createdFrom) f.createdFrom = createdFrom;
    if (createdTo) f.createdTo = createdTo;
    if (sortBy) {
      if (sortBy === 'latest') { f.sortBy = 'created_at'; f.sortDesc = true; }
      else if (sortBy === 'score') { f.sortBy = 'score'; f.sortDesc = true; }
      else if (sortBy === 'name') { f.sortBy = 'name'; f.sortDesc = false; }
    }
    return f;
  }, [debouncedSearch, sourceFilter, assigneeFilter, scoreRange, intentFilter, sortBy, createdFrom, createdTo, page, limit]);

  const { leads, stages, stats, total, loading, error, optimisticStageChange, bulkChangeStage, bulkDelete, refetch } = useLeads(filters);

  // Unique assignees for dropdown
  const assignees = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      if (l.assignee_id && l.assignee_name) map[l.assignee_id] = l.assignee_name;
    });
    return Object.entries(map);
  }, [leads]);

  // Calculate filteredLeads without useMemo to guarantee it runs on every render
  const filteredLeads = (() => {
    const arr = [...leads];
    const getTime = (l) => {
      // If missing or invalid, treat as Infinity (newest) so they go to the top
      if (!l.created_at && !l.createdAt) return Infinity;
      const d = new Date(l.created_at || l.createdAt);
      if (isNaN(d.getTime())) return Infinity;
      return d.getTime();
    };
    
    // Always apply chronological sort as a fallback to guarantee newest is at top
    if (sortBy === 'score') {
      arr.sort((a, b) => (b.score || 0) - (a.score || 0) || getTime(b) - getTime(a));
    } else if (sortBy === 'name') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || '') || getTime(b) - getTime(a));
    } else {
      arr.sort((a, b) => getTime(b) - getTime(a));
    }
    return arr;
  })();

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
      setStageMenuLeadId(null);
    } catch (err) {
      setStageMenuLeadId(null);
      throw err;
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSourceFilter('All Sources');
    setAssigneeFilter('');
    setScoreRange('all');
    setIntentFilter('all');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(1);
  };

  const handleExport = async () => {
    try {
      if (import.meta.env.DEV && localStorage.getItem('mockSession')) {
        toast.success('Export simulated in mock session');
        return;
      }
      const params = new URLSearchParams(filters);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/leads/export?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  // handleImport is now handled inside LeadImportModal

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>

        <div className={styles.viewToggle} style={{ margin: '0 auto' }}>
          <button
            onClick={() => setView('dashboard')}
            className={`${styles.viewBtn} ${view === 'dashboard' ? styles.viewBtnActive : ''}`}
          >
            &#128202; Dashboard
          </button>
          <button
            onClick={() => setView('list')}
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
          >
            &#9776; List
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`}
          >
            &#9638; Kanban
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`${styles.viewBtn} ${view === 'calendar' ? styles.viewBtnActive : ''}`}
          >
            &#128197; Calendar
          </button>
          <button
            onClick={() => setView('map')}
            className={`${styles.viewBtn} ${view === 'map' ? styles.viewBtnActive : ''}`}
          >
            &#128506; Map
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          


          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={handleExport}
              title="Export Leads to CSV"
            >&#8593; Export</Button>
          )}
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>&#8595; Import</Button>
          <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
        </div>
      </div>

      {view !== 'dashboard' && <LeadStatsBar stats={stats} loading={loading} />}

      {view !== 'dashboard' && (
        <LeadFilterRow
          search={search} setSearch={setSearch}
          assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          scoreRange={scoreRange} setScoreRange={setScoreRange}
          intentFilter={intentFilter} setIntentFilter={setIntentFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          view={view} setView={setView}
          assignees={assignees}
          createdFrom={createdFrom} setCreatedFrom={setCreatedFrom}
          createdTo={createdTo} setCreatedTo={setCreatedTo}
          onClearFilters={clearFilters}
        />
      )}

      <div className={styles.content}>
        {error ? (
          <div style={{ padding: '40px', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠</div>
            <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</div>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>Please try refreshing the page or check your connection.</p>
          </div>
        ) : view === 'dashboard' ? (
          <ErrorBoundary>
            <LeadDashboard 
              leads={filteredLeads} 
              loading={loading} 
              onLeadClick={setSelectedLeadId} 
            />
          </ErrorBoundary>
        ) : view === 'kanban' && !loading ? (
          <ErrorBoundary>
            <LeadKanbanBoard
              initialLeads={filteredLeads}
              stages={stages}
              onStageChange={handleMoveStage}
              onLeadClick={setSelectedLeadId}
            />
          </ErrorBoundary>
        ) : view === 'map' && !loading ? (
          <ErrorBoundary>
            <LeadMap leads={filteredLeads} onLeadClick={setSelectedLeadId} />
          </ErrorBoundary>
        ) : view === 'calendar' && !loading ? (
          <ErrorBoundary>
            <LeadCalendar leads={filteredLeads} onLeadClick={setSelectedLeadId} />
          </ErrorBoundary>
        ) : (
          <LeadTable
            filteredLeads={filteredLeads}
            loading={loading}
            page={page} limit={limit} total={total} setPage={setPage}
            setSelectedLeadId={setSelectedLeadId}
            stageMenuLeadId={stageMenuLeadId} setStageMenuLeadId={setStageMenuLeadId}
            stages={stages} handleMoveStage={handleMoveStage}
            bulkChangeStage={bulkChangeStage}
            bulkDelete={bulkDelete}
            clearFilters={clearFilters}
            refetch={refetch}
            search={search}
          />
        )}
      </div>

      <LeadDrawer
        leadId={selectedLeadId}
        isOpen={!!selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={(updatedLead) => {
          if (!updatedLead) setSelectedLeadId(null);
          refetch();
        }}
        stages={stages}
      />

      {isFormOpen && (
        <LeadForm 
          onClose={() => setIsFormOpen(false)} 
          onSave={() => {
            setSortBy('latest');
            setPage(1);
            refetch();
          }}
        />
      )}
      {isImportModalOpen && (
        <LeadImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={refetch}
        />
      )}
    </div>
  );
}
