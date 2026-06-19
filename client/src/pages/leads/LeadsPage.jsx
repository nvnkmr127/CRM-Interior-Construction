import React, { useState, useMemo } from 'react';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import KanbanBoard from '../../components/leads/KanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import ErrorBoundary from '../../components/ErrorBoundary';
import LeadStatsBar from '../../components/leads/LeadStatsBar';
import LeadFilterRow from '../../components/leads/LeadFilterRow';
import LeadTable from '../../components/leads/LeadTable';
import LeadMap from '../../components/leads/LeadMap';
import { useLeads } from '../../hooks/useLeads';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [scoreRange, setScoreRange] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [view, setView] = useState('list');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stageMenuLeadId, setStageMenuLeadId] = useState(null);
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
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.subtitle}>Manage your interior construction pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button variant="outline" onClick={handleExport}>&#8595; Export</Button>
          <Button variant="outline" onClick={() => document.getElementById('csv-import-input').click()}>&#8593; Import</Button>
          <input id="csv-import-input" type="file" accept=".csv" style={{display:'none'}} onChange={handleImport} />
          <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
        </div>
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
        createdFrom={createdFrom} setCreatedFrom={setCreatedFrom}
        createdTo={createdTo} setCreatedTo={setCreatedTo}
        onClearFilters={clearFilters}
      />

      <div className={styles.content}>
        {view === 'kanban' && !loading ? (
          <ErrorBoundary>
            <KanbanBoard
              stages={stages || []}
              leadsByStage={leadsByStage}
              onLeadClick={setSelectedLeadId}
              onAddLead={() => setIsFormOpen(true)}
              onMoveLead={handleMoveStage}
            />
          </ErrorBoundary>
        ) : view === 'map' && !loading ? (
          <ErrorBoundary>
            <LeadMap leads={filteredLeads} onLeadClick={setSelectedLeadId} />
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
