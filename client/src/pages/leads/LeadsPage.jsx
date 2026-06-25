import React, { useState, useMemo } from 'react';
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
  const isAdmin = user?.role === 'admin' || user?.role?.name === 'admin' || user?.role === 'superadmin' || user?.role?.name === 'superadmin';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('crm_leads_sortBy') || 'latest');

  React.useEffect(() => {
    localStorage.setItem('crm_leads_sortBy', sortBy);
  }, [sortBy]);
  const [view, setView] = useState('list');
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

  const { leads, stages, stats, total, loading, optimisticStageChange, bulkChangeStage, bulkDelete, refetch } = useLeads(filters);

  // Unique assignees for dropdown
  const assignees = useMemo(() => {
    const map = {};
    leads.forEach(l => {
      if (l.assignee_id && l.assignee_name) map[l.assignee_id] = l.assignee_name;
    });
    return Object.entries(map);
  }, [leads]);

  const filteredLeads = leads;

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
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>

        {/* Universal Search */}
        <div style={{ flex: 1, minWidth: '250px', maxWidth: '480px' }}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedSearch(search);
              setPage(1);
            }} 
            style={{ width: '100%' }}
          >
            <div className={styles.searchContainer} style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search leads by name, email, phone..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.headerSearchInput}
                style={{ width: '100%', paddingRight: '36px' }}
              />
              <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </form>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          
          {/* Notification Center */}
          <div className={styles.notifWrapper}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={styles.notifToggle}
              title="Notifications"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span className={styles.notifBadge}></span>
            </button>
            
            {isNotificationsOpen && (
              <div className={styles.notifDropdown}>
                <div className={styles.notifHeader}>
                  <h3>Notifications</h3>
                  <button>Mark all read</button>
                </div>
                <div className={styles.notifList}>
                  <div className={styles.notifItem}>
                    <div className={`${styles.notifIcon} ${styles.notifIconInfo}`}>✨</div>
                    <div className={styles.notifContent}>
                      <p><span>AI Suggestion:</span> Follow up with Rahul Sharma. Lead score increased to 92.</p>
                      <p className={styles.notifTime}>10 mins ago</p>
                    </div>
                  </div>
                  <div className={styles.notifItem}>
                    <div className={`${styles.notifIcon} ${styles.notifIconAlert}`}>🔴</div>
                    <div className={styles.notifContent}>
                      <p><span>SLA Alert:</span> 3 leads in 'Site Visit' have breached the 3-day SLA.</p>
                      <p className={styles.notifTime}>1 hour ago</p>
                    </div>
                  </div>
                  <div className={styles.notifItem}>
                    <div className={`${styles.notifIcon} ${styles.notifIconEvent}`}>📅</div>
                    <div className={styles.notifContent}>
                      <p><span>Meeting:</span> Site visit with Amit Patel starts in 30 minutes.</p>
                      <p className={styles.notifTime}>Just now</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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

      <div className={styles.content}>
        {view === 'dashboard' ? (
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
          onSave={() => refetch()}
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
