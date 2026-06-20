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
import { useLeads } from '../../hooks/useLeads';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [view, setView] = useState('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [page, setPage] = useState(1);
  const limit = 20;

  const filters = useMemo(() => {
    const f = { page, limit };
    if (search) f.search = search;
    if (sourceFilter && sourceFilter !== 'All Sources') f.source = sourceFilter;
    if (assigneeFilter) f.assigneeId = assigneeFilter;
    if (scoreRange && scoreRange !== 'all') f.scoreRange = scoreRange;
    if (createdFrom) f.createdFrom = createdFrom;
    if (createdTo) f.createdTo = createdTo;
    if (sortBy) {
      if (sortBy === 'latest') { f.sortBy = 'created_at'; f.sortDesc = true; }
      else if (sortBy === 'score') { f.sortBy = 'score'; f.sortDesc = true; }
      else if (sortBy === 'name') { f.sortBy = 'name'; f.sortDesc = false; }
    }
    return f;
  }, [search, sourceFilter, assigneeFilter, scoreRange, sortBy, createdFrom, createdTo, page, limit]);

  const { leads, stages, stats, total, loading, optimisticStageChange, bulkChangeStage, refetch } = useLeads(filters);

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
    } catch {
      // error handling deferred to hook
    }
    setStageMenuLeadId(null);
  };

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('All Sources');
    setAssigneeFilter('');
    setScoreRange('all');
    setCreatedFrom('');
    setCreatedTo('');
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/leads/export?${params}`, {
        credentials: 'include'
      });
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

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const csv = await file.text();
    try {
      const res = await api.post('/leads/import', { csv });
      if (res.data.success) {
        const { created, skipped } = res.data.data;
        toast.success(`Imported ${created} leads${skipped > 0 ? `, ${skipped} skipped` : ''}`);
        refetch();
      }
    } catch {
      toast.error('Import failed');
    }
    e.target.value = '';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>

        {/* Universal Search */}
        <div style={{ flex: 1, minWidth: '250px', maxWidth: '400px' }}>
          <div className={styles.searchContainer}>
            <input 
              type="text" 
              placeholder="Search leads by name, email, phone..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.headerSearchInput}
            />
            <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
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

          <Button variant="outline" onClick={handleExport}>&#8595; Export</Button>
          <Button variant="outline" onClick={() => document.getElementById('csv-import-input').click()}>&#8593; Import</Button>
          <input id="csv-import-input" type="file" accept=".csv" style={{display:'none'}} onChange={handleImport} />
          <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
        </div>
      </div>

      {view !== 'dashboard' && <LeadStatsBar stats={stats} loading={loading} />}

      <LeadFilterRow
        search={search} setSearch={setSearch}
        assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter}
        sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
        scoreRange={scoreRange} setScoreRange={setScoreRange}
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
            clearFilters={clearFilters}
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
    </div>
  );
}
