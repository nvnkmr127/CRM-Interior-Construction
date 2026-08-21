import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseFiltersFromURL, serializeFiltersToURL } from '../../utils/filterSync';
import { Button, PermissionButton } from '../../components/ui';
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
import MarkLostModal from '../../components/leads/MarkLostModal';
import { useLeads } from '../../hooks/useLeads';
import { useAuth } from '../../store/authContext';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = 
    user?.role === 'admin' || 
    user?.role?.name?.toLowerCase() === 'admin' || 
    user?.role === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'super admin' || 
    (user?.role?.permissions && user.role.permissions.includes('*'));
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  const [search, setSearch] = useState(params.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(params.get('search') || '');

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
    let changed = false;
    const currentParams = new URLSearchParams(location.search);
    
    if (currentParams.get('new') === 'true') {
      setIsFormOpen(true);
      currentParams.delete('new');
      changed = true;
    }
    
    if (currentParams.get('id')) {
      setSelectedLeadId(currentParams.get('id'));
      currentParams.delete('id');
      changed = true;
    }

    if (changed) {
      navigate({ search: currentParams.toString() }, { replace: true });
    }
  }, [location.search, navigate]);

  const [assigneeFilter, setAssigneeFilter] = useState(params.get('assigneeId') || '');
  const [sourceFilter, setSourceFilter] = useState(params.get('source') || 'All Sources');
  const [scoreRange, setScoreRange] = useState(params.get('scoreRange') || 'all');
  const [intentFilter, setIntentFilter] = useState(params.get('intent') || 'all');
  const [sortBy, setSortBy] = useState(() => params.get('sortBy') || localStorage.getItem('crm_leads_sortBy') || 'latest');
  const [createdFrom, setCreatedFrom] = useState(params.get('createdFrom') || '');
  const [createdTo, setCreatedTo] = useState(params.get('createdTo') || '');
  const [stageIdFilter, setStageIdFilter] = useState(params.get('stageId') || '');

  // Sync state changes to URL
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const currentParams = new URLSearchParams(location.search);
    const newFiltersStr = serializeFiltersToURL({
      search: debouncedSearch,
      assigneeId: assigneeFilter,
      source: sourceFilter,
      scoreRange,
      intent: intentFilter,
      createdFrom,
      createdTo,
      stageId: stageIdFilter,
      sortBy
    });
    
    // Strip old filter params
    ['search', 'assigneeId', 'source', 'scoreRange', 'intent', 'createdFrom', 'createdTo', 'stageId', 'sortBy'].forEach(k => currentParams.delete(k));
    
    const finalSearch = new URLSearchParams(currentParams.toString() + (currentParams.toString() && newFiltersStr ? '&' : '') + newFiltersStr).toString();
    
    if (finalSearch !== location.search.substring(1)) {
      navigate({ search: finalSearch }, { replace: true });
    }
  }, [debouncedSearch, assigneeFilter, sourceFilter, scoreRange, intentFilter, createdFrom, createdTo, stageIdFilter, sortBy, navigate, location.search]);

  // Sync URL changes back to state (for back button)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('search') !== null && urlParams.get('search') !== debouncedSearch) setSearch(urlParams.get('search') || '');
    if (urlParams.get('assigneeId') !== null && urlParams.get('assigneeId') !== assigneeFilter) setAssigneeFilter(urlParams.get('assigneeId') || '');
    if (urlParams.get('source') !== null && urlParams.get('source') !== sourceFilter) setSourceFilter(urlParams.get('source') || 'All Sources');
    if (urlParams.get('scoreRange') !== null && urlParams.get('scoreRange') !== scoreRange) setScoreRange(urlParams.get('scoreRange') || 'all');
    if (urlParams.get('intent') !== null && urlParams.get('intent') !== intentFilter) setIntentFilter(urlParams.get('intent') || 'all');
    if (urlParams.get('createdFrom') !== null && urlParams.get('createdFrom') !== createdFrom) setCreatedFrom(urlParams.get('createdFrom') || '');
    if (urlParams.get('createdTo') !== null && urlParams.get('createdTo') !== createdTo) setCreatedTo(urlParams.get('createdTo') || '');
    if (urlParams.get('stageId') !== null && urlParams.get('stageId') !== stageIdFilter) setStageIdFilter(urlParams.get('stageId') || '');
    if (urlParams.get('sortBy') !== null && urlParams.get('sortBy') !== sortBy) setSortBy(urlParams.get('sortBy') || 'latest');
  }, [location.search]);

  useEffect(() => {
    localStorage.setItem('crm_leads_sortBy', sortBy);
  }, [sortBy]);
  
  const initialView = params.get('view') || 'dashboard';
  const [view, setView] = useState(initialView);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlView = params.get('view');
    if (urlView && urlView !== view) {
      setView(urlView);
      setSelectedLeadId(null);
      setIsFormOpen(false);
    }
  }, [location.search, view]);

  // Close modals when a sidebar link is clicked (detecting the state timestamp we pass)
  useEffect(() => {
    if (location.state?.fromSidebar) {
      setSelectedLeadId(null);
      setIsFormOpen(false);
    }
  }, [location.state?.reset]);

  const handleViewChange = (newView) => {
    setView(newView);
    setSelectedLeadId(null);
    setIsFormOpen(false);
    const params = new URLSearchParams(location.search);
    params.set('view', newView);
    params.delete('id');
    navigate({ search: params.toString() });
  };
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [markLostLeadId, setMarkLostLeadId] = useState(null);
  const [markLostSubmitting, setMarkLostSubmitting] = useState(false);

  const handleMarkLostConfirm = async (reason) => {
    setMarkLostSubmitting(true);
    try {
      await api.patch(`/leads/${markLostLeadId}`, { lost_reason: reason });
      await bulkDelete([markLostLeadId]);
      toast.success('Lead marked as lost successfully');
      setMarkLostLeadId(null);
      refetch();
    } catch (e) {
      toast.error('Failed to mark lead as lost.');
    } finally {
      setMarkLostSubmitting(false);
    }
  };

  const handleParkLead = async (leadId) => {
    try {
      await api.patch(`/leads/${leadId}`, { status: 'parked' });
      toast.success('Lead parked successfully');
      // Re-fetch since leads custom hook exposes refetch
      refetch();
    } catch (e) {
      toast.error('Failed to park lead.');
    }
  };

  const [users, setUsers] = useState([]);
  useEffect(() => {
    import('../../api/axios').then(({ default: api }) => {
      api.get('/users?limit=50')
        .then(res => { if (res.data && res.data.success) setUsers(res.data.data); })
        .catch(err => console.error('Failed to load users list:', err));
    });
  }, []);

  const filters = useMemo(() => {
    const f = { page, limit: (view === 'calendar' || view === 'kanban' || view === 'map' || view === 'dashboard') ? 200 : limit };
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    if (sourceFilter && sourceFilter !== 'All Sources') f.source = sourceFilter;
    if (assigneeFilter) f.assigneeId = assigneeFilter;
    if (scoreRange && scoreRange !== 'all') f.scoreRange = scoreRange;
    if (intentFilter && intentFilter !== 'all') f.intent = intentFilter;
    if (createdFrom) f.createdFrom = createdFrom;
    if (createdTo) f.createdTo = createdTo;
    if (stageIdFilter) f.stageId = stageIdFilter;
    if (statusFilter === 'deleted') {
      f.deletedOnly = true;
    } else if (statusFilter === 'parked') {
      f.status = 'parked';
    } else if (statusFilter === 'active') {
      f.status = 'active';
    }
    if (sortBy) {
      if (sortBy === 'latest') { f.sortBy = 'created_at'; f.sortDesc = true; }
      else if (sortBy === 'score') { f.sortBy = 'score'; f.sortDesc = true; }
      else if (sortBy === 'name') { f.sortBy = 'name'; f.sortDesc = false; }
    }
    return f;
  }, [debouncedSearch, sourceFilter, assigneeFilter, scoreRange, intentFilter, sortBy, createdFrom, createdTo, stageIdFilter, statusFilter, page, limit, view]);

  const { leads, stages, stats, total, loading, error, optimisticStageChange, bulkChangeStage, bulkDelete, refetch } = useLeads(filters);

  // Unique assignees for dropdown using fetched users
  const assignees = useMemo(() => {
    const map = {};
    const arr = Array.isArray(leads) ? leads : [];
    for (const l of arr) {
      if (l.assignee_id) {
        const user = users.find(u => u.id === l.assignee_id);
        if (user || l.assignee_name) {
           map[l.assignee_id] = l.assignee_name || (user ? user.name : 'Unassigned');
        }
      }
    }
    return Object.entries(map);
  }, [leads, users]);

  // Calculate filteredLeads without useMemo to guarantee it runs on every render
  const filteredLeads = (() => {
    const arr = leads.map(l => {
      if (!l.assignee_name && l.assignee_id) {
        const user = users.find(u => u.id === l.assignee_id);
        if (user) return { ...l, assignee_name: user.name };
      }
      return l;
    });
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
    const arr = Array.isArray(filteredLeads) ? filteredLeads : [];
    for (const l of arr) {
      if (!map[l.stage_id]) map[l.stage_id] = [];
      map[l.stage_id].push(l);
    }
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

  const handleReassignLead = async (leadId, newAssigneeId) => {
    try {
      await api.patch(`/leads/${leadId}`, { assignee_id: newAssigneeId || null });
      toast.success('Lead reassigned successfully');
      refetch();
    } catch (e) {
      toast.error('Failed to reassign lead.');
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
    setStageIdFilter('');
    setStatusFilter('active');
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/leads/export', {
        params: filters,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Leads exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed');
    }
  };

  // handleImport is now handled inside LeadImportModal

  return (
    <div className={styles.page}>
      {!selectedLeadId && (
        <>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.title}>Leads</h1>
              <p className={styles.subtitle}>Manage your interior construction pipeline</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <PermissionButton 
                module="leads"
                action="export_csv"
                variant="outline" 
                onClick={handleExport}
                title="Export Leads to CSV"
              >&#8593; Export</PermissionButton>
              {statusFilter !== 'deleted' && (
                <>
                  <PermissionButton module="leads" action="import" variant="outline" onClick={() => setIsImportModalOpen(true)}>&#8595; Import</PermissionButton>
                  <PermissionButton module="leads" action="create" variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</PermissionButton>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
            <button
              onClick={() => { setStatusFilter('active'); setPage(1); }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: statusFilter === 'active' ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: 'transparent',
                color: statusFilter === 'active' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              Active Leads
            </button>
            <button
              onClick={() => { setStatusFilter('parked'); setPage(1); }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: statusFilter === 'parked' ? '2px solid var(--color-warning)' : '2px solid transparent',
                background: 'transparent',
                color: statusFilter === 'parked' ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              Parked Leads
            </button>
            <button
              onClick={() => { setStatusFilter('deleted'); setPage(1); }}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: statusFilter === 'deleted' ? '2px solid var(--color-danger)' : '2px solid transparent',
                background: 'transparent',
                color: statusFilter === 'deleted' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              Deleted Leads
            </button>
          </div>
        </>
      )}

      {!selectedLeadId && view !== 'dashboard' && <LeadStatsBar stats={stats} loading={loading} />}

      {!selectedLeadId && view !== 'dashboard' && (
        <LeadFilterRow
          search={search} setSearch={setSearch}
          assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          scoreRange={scoreRange} setScoreRange={setScoreRange}
          intentFilter={intentFilter} setIntentFilter={setIntentFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          view={view} setView={handleViewChange}
          assignees={assignees}
          createdFrom={createdFrom} setCreatedFrom={setCreatedFrom}
          createdTo={createdTo} setCreatedTo={setCreatedTo}
          stageIdFilter={stageIdFilter} setStageIdFilter={setStageIdFilter}
          onClearFilters={clearFilters}
        />
      )}

      {!selectedLeadId && (
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
              stages={stages}
              loading={loading} 
              onLeadClick={setSelectedLeadId} 
              onViewChange={handleViewChange}
              onSiteVisitsTodayClick={(leadId) => {
                setDrawerInitialTab('site-visits');
                setSelectedLeadId(leadId);
              }}
            />
          </ErrorBoundary>
        ) : view === 'kanban' && !loading ? (
          <ErrorBoundary>
            <LeadKanbanBoard
              initialLeads={filteredLeads}
              stages={stages}
              users={users}
              onStageChange={handleMoveStage}
              onReassign={handleReassignLead}
              onLeadClick={setSelectedLeadId}
              onMarkLost={(id) => setMarkLostLeadId(id)}
              onPark={handleParkLead}
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
            page={page}
            limit={limit}
            total={total}
            setPage={setPage}
            setSelectedLeadId={setSelectedLeadId}
            stageMenuLeadId={stageMenuLeadId}
            setStageMenuLeadId={setStageMenuLeadId}
            stages={stages}
            handleMoveStage={handleMoveStage}
            bulkChangeStage={bulkChangeStage}
            bulkDelete={bulkDelete}
            clearFilters={clearFilters}
            refetch={refetch}
            search={debouncedSearch}
            users={users}
          />
        )}
        </div>
      )}

      {selectedLeadId && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <LeadDrawer
            leadId={selectedLeadId}
            isOpen={!!selectedLeadId}
            onClose={() => {
              setSelectedLeadId(null);
              setDrawerInitialTab('overview');
            }}
            onLeadUpdated={(updatedLead) => {
              if (!updatedLead) setSelectedLeadId(null);
              refetch();
            }}
            stages={stages}
            initialTab={drawerInitialTab}
          />
        </div>
      )}

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

      {markLostLeadId && (
        <MarkLostModal
          isOpen={!!markLostLeadId}
          onClose={() => setMarkLostLeadId(null)}
          onConfirm={handleMarkLostConfirm}
          isSubmitting={markLostSubmitting}
        />
      )}
    </div>
  );
}
