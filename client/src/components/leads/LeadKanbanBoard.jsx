import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import KanbanLeadCard from './KanbanLeadCard';
import LeadFilterBar from './LeadFilterBar';
import { Badge } from '../ui'; // Standard UI badge

// Stages are now passed as props from the database

// Droppable Column Component
function KanbanColumn({ stage, leads, activeId, onLeadClick }) {
  const { setNodeRef } = useDroppable({ id: stage.id });
  const [visibleCount, setVisibleCount] = useState(50);
  
  const visibleLeads = useMemo(() => leads.slice(0, visibleCount), [leads, visibleCount]);
  
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.budget_max) || 0), 0);
  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue);

  const isOverLimit = stage.wip_limit != null && leads.length > stage.wip_limit;

  return (
    <div className={`flex flex-col rounded-lg min-w-[280px] max-w-[280px] max-h-full flex-shrink-0 mr-4 transition-colors`} style={{ background: 'var(--color-surface-2)', borderColor: isOverLimit ? 'var(--color-danger, #ef4444)' : 'var(--color-border)', borderWidth: isOverLimit ? '2px' : '1px' }}>
      <div className="p-3 flex justify-between items-center rounded-t-lg" style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h3 className="font-semibold flex items-center" style={{ color: isOverLimit ? 'var(--color-danger, #ef4444)' : 'var(--color-text)' }}>
            {stage.name} 
            <Badge variant={isOverLimit ? "danger" : "secondary"} className="ml-2">
              {leads.length}{stage.wip_limit != null ? ` / ${stage.wip_limit}` : ''}
            </Badge>
          </h3>
          <p className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{formattedValue}</p>
        </div>
        {isOverLimit && (
          <div title="WIP Limit Exceeded" style={{ color: 'var(--color-danger, #ef4444)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
        )}
      </div>
      
      <div ref={setNodeRef} className="flex-1 p-2 overflow-y-auto min-h-[150px]">
        <SortableContext items={visibleLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {visibleLeads.map(lead => (
            <KanbanLeadCard 
              key={lead.id} 
              lead={lead} 
              onAction={(action) => {
                if (action === 'view' && onLeadClick) onLeadClick(lead.id);
                else console.log('Action triggered:', action, lead.id);
              }} 
            />
          ))}
        </SortableContext>
        
        {leads.length > visibleCount && (
          <div className="py-3 text-center">
            <button 
              className="text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-1.5 rounded-full shadow-sm transition-colors"
              onClick={() => setVisibleCount(v => v + 50)}
            >
              Load {Math.min(50, leads.length - visibleCount)} more (of {leads.length - visibleCount})
            </button>
          </div>
        )}

        {leads.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm border-2 border-dashed rounded-lg" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border-strong)' }}>
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadKanbanBoard({ initialLeads = [], stages = [], reps = [], onStageChange, onLeadClick }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState(null);
  
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const [filters, setFilters] = useState({
    search: '',
    reps: [],
    scoreTier: '',
    source: '',
    locality: ''
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchName = String(lead.name || '').toLowerCase().includes(term);
        const matchPhone = String(lead.phone || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone) return false;
      }
      if (filters.reps.length > 0 && !filters.reps.includes(lead.assignee_id)) return false;
      if (filters.scoreTier) {
        const score = Number(lead.score) || 0;
        let leadTier = 'dead';
        if (score >= 61) leadTier = 'hot';
        else if (score >= 31) leadTier = 'warm';
        else if (score > 0) leadTier = 'cold';
        
        if (leadTier !== filters.scoreTier) return false;
      }
      if (filters.intent && String(lead.buying_intent || '').toLowerCase() !== filters.intent.toLowerCase()) return false;
      if (filters.source && String(lead.source || '').toLowerCase() !== filters.source.toLowerCase()) return false;
      if (filters.locality && !String(lead.locality || '').toLowerCase().includes(filters.locality.toLowerCase())) return false;
      return true;
    });
  }, [leads, filters]);

  const leadsByStage = useMemo(() => {
    const acc = {};
    stages.forEach(s => acc[s.id] = []);
    filteredLeads.forEach(lead => {
      // lead.stage_id from database
      const stageId = lead.stage_id || lead.stage;
      if (acc[stageId]) {
        acc[stageId].push(lead);
      } else {
        // Fallback if stage is unknown
        if (!acc['unknown']) acc['unknown'] = [];
        acc['unknown'].push(lead);
      }
    });
    return acc;
  }, [filteredLeads, stages]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id;
    const targetStageId = over.id; // Usually we set droppable id to the stage id

    const lead = leads.find(l => l.id === leadId);
    const leadStageId = lead?.stage_id || lead?.stage;
    if (!lead || leadStageId === targetStageId) return;

    // --- EXIT CRITERIA LOGIC ---
    const targetStage = stages.find(s => s.id === targetStageId);
    
    if (targetStage && targetStage.mandatory_fields && Array.isArray(targetStage.mandatory_fields)) {
      const missing = [];
      targetStage.mandatory_fields.forEach(f => {
        const val = lead[f] !== undefined ? lead[f] : (lead.custom_fields && lead.custom_fields[f]);
        if (val === undefined || val === null || val === '') {
          missing.push(f);
        }
      });
      if (missing.length > 0) {
        showToast(`Missing Required Fields: ${missing.join(', ')} required to move to ${targetStage.name}.`);
        return;
      }
    }

    const targetStageName = targetStage?.name;
    
    if (targetStageName === 'Quotation' && (!lead.lead_files || lead.lead_files.length === 0)) {
      showToast('Missing Requirement: Lead needs at least 1 file attached for Quotation.');
      return;
    }
    if (targetStageName === 'Closing' && (!lead.budget_max || lead.budget_max <= 0)) {
      showToast('Missing Requirement: Lead requires a filled budget max before Closing.');
      return;
    }

    const previousStage = leadStageId;

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: targetStageId, stage: targetStageId, days_in_stage: 0 } : l));

    try {
      if (onStageChange) {
        await onStageChange(leadId, targetStageId);
      }
    } catch (err) {
      // Rollback
      const apiErr = err.response?.data?.error;
      const missing = apiErr?.missing;
      let msg = 'Failed to update stage. Reverting.';
      if (apiErr?.code === 'STAGE_GATE_FAILED' && missing && missing.length > 0) {
        msg = `Missing Required Fields: ${missing.join(', ')} required to move to ${targetStage.name}.`;
      } else if (apiErr?.message) {
        msg = apiErr.message;
      }
      showToast(msg, 'error');
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: previousStage, stage: previousStage } : l));
    }
  };

  const activeLead = useMemo(() => leads.find(l => l.id === activeId), [activeId, leads]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white font-medium transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <LeadFilterBar filters={filters} setFilters={setFilters} reps={reps} />

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full items-start">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {stages.map(stage => (
              <KanbanColumn 
                key={stage.id} 
                stage={stage} 
                leads={leadsByStage[stage.id] || []} 
                activeId={activeId} 
                onLeadClick={onLeadClick}
              />
            ))}

            <DragOverlay>
              {activeLead ? <KanbanLeadCard lead={activeLead} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
