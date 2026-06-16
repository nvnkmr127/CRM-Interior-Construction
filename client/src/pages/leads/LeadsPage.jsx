import React, { useState, useMemo } from 'react';
import { Button } from '../../components/ui';
import KanbanBoard from '../../components/leads/KanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import LeadStatsBar from '../../components/leads/LeadStatsBar';
import LeadFilterRow from '../../components/leads/LeadFilterRow';
import LeadTable from '../../components/leads/LeadTable';
import { useLeads } from '../../hooks/useLeads';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [view, setView] = useState('list');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);
  
  const [page, setPage] = useState(1);
  const limit = 20;

  const filters = useMemo(() => {
    const f = { page, limit };
    if (search) f.search = search;
    if (sourceFilter && sourceFilter !== 'All Sources') f.source = sourceFilter;
    if (assigneeFilter) f.assigneeId = assigneeFilter;
    if (scoreRange && scoreRange !== 'all') f.scoreRange = scoreRange;
    if (sortBy) {
      if (sortBy === 'latest') { f.sortBy = 'created_at'; f.sortDesc = true; }
      else if (sortBy === 'score') { f.sortBy = 'score'; f.sortDesc = true; }
      else if (sortBy === 'name') { f.sortBy = 'name'; f.sortDesc = false; }
    }
    return f;
  }, [search, sourceFilter, assigneeFilter, scoreRange, sortBy, page, limit]);

  const { leads, stages, stats, total, loading, optimisticStageChange, refetch } = useLeads(filters);

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
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>
        <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
      </div>

      <LeadStatsBar stats={stats} loading={loading} />

      <LeadFilterRow
        search={search} setSearch={setSearch}
        assigneeFilter={assigneeFilter} setAssigneeFilter={setAssigneeFilter}
        sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
        scoreRange={scoreRange} setScoreRange={setScoreRange}
        sortBy={sortBy} setSortBy={setSortBy}
        view={view} setView={setView}
        assignees={assignees}
      />

      <div className={styles.content}>
        {view === 'kanban' && !loading ? (
          <ErrorBoundary>
            <KanbanBoard
              stages={stages || []}
              leadsByStage={leadsByStage}
              onLeadClick={setSelectedLeadId}
              onAddLead={() => setIsFormOpen(true)}
            />
          </ErrorBoundary>
        ) : (
          <LeadTable
            filteredLeads={filteredLeads}
            loading={loading}
            page={page} limit={limit} total={total} setPage={setPage}
            setSelectedLeadId={setSelectedLeadId}
            stageMenuLeadId={stageMenuLeadId} setStageMenuLeadId={setStageMenuLeadId}
            stages={stages} handleMoveStage={handleMoveStage}
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
