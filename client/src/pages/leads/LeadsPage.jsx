import React, { useState } from 'react';
import { Button } from '../../components/ui';
import KanbanBoard from '../../components/leads/KanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import { useLeads } from '../../hooks/useLeads';
import styles from './LeadsPage.module.css';

export default function LeadsPage() {
  const { leads, stages, loading } = useLeads();
  const [view, setView] = useState('kanban');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Group leads by stage
  const leadsByStage = {};
  leads?.forEach(l => {
    if (!leadsByStage[l.stage_id]) leadsByStage[l.stage_id] = [];
    leadsByStage[l.stage_id].push(l);
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leads</h1>
        <div className={styles.actions}>
          <input className={styles.search} placeholder="⌕ Search leads..." />
          <Button variant="primary" onClick={() => setIsFormOpen(true)}>+ New Lead</Button>
        </div>
      </div>

      <div className={styles.summary}>
        42 leads &nbsp;·&nbsp; 8 qualified &nbsp;·&nbsp; 3 won this month
      </div>

      <div className={styles.filters}>
        <div className={styles.stages}>
          <button className={`${styles.pill} ${selectedStage === 'all' ? styles.pillActive : ''}`} onClick={() => setSelectedStage('all')}>All</button>
          {stages?.map(s => (
            <button key={s.id} className={`${styles.pill} ${selectedStage === s.id ? styles.pillActive : ''}`} onClick={() => setSelectedStage(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className={styles.dropdowns}>
          <select className={styles.dropdown}><option>Assignee</option></select>
          <select className={styles.dropdown}><option>Source</option></select>
          <select className={styles.dropdown}><option>Sort</option></select>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`} onClick={() => setView('kanban')}>⊞ Kanban</button>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>≡ List</button>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {view === 'kanban' ? (
          <KanbanBoard stages={stages || []} leadsByStage={leadsByStage} onLeadClick={setSelectedLeadId} />
        ) : (
          <div>List View (Coming Soon)</div>
        )}
      </div>

      <LeadDrawer 
        leadId={selectedLeadId} 
        isOpen={!!selectedLeadId} 
        onClose={() => setSelectedLeadId(null)} 
      />

      {isFormOpen && (
        <LeadForm onClose={() => setIsFormOpen(false)} />
      )}
    </div>
  );
}
