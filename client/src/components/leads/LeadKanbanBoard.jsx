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
  
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.budget_max) || 0), 0);
  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue);

  return (
    <div className="flex flex-col bg-gray-50 rounded-lg border min-w-[280px] max-w-[280px] max-h-full flex-shrink-0 mr-4">
      <div className="p-3 border-b bg-gray-100/50 flex justify-between items-center rounded-t-lg">
        <div>
          <h3 className="font-semibold text-gray-700">{stage.name} <Badge variant="secondary" className="ml-2">{leads.length}</Badge></h3>
          <p className="text-xs text-gray-500 mt-1 font-medium">{formattedValue}</p>
        </div>
      </div>
      
      <div ref={setNodeRef} className="flex-1 p-2 overflow-y-auto min-h-[150px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
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
        {leads.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
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
        const matchName = lead.name?.toLowerCase().includes(term);
        const matchPhone = lead.phone?.includes(term);
        if (!matchName && !matchPhone) return false;
      }
      if (filters.reps.length > 0 && !filters.reps.includes(lead.assigned_rep_id)) return false;
      if (filters.scoreTier && lead.score_tier !== filters.scoreTier) return false;
      if (filters.source && lead.source?.toLowerCase() !== filters.source.toLowerCase()) return false;
      if (filters.locality && !lead.locality?.toLowerCase().includes(filters.locality.toLowerCase())) return false;
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
    const targetStageName = stages.find(s => s.id === targetStageId)?.name;
    
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
      showToast('Failed to update stage. Reverting.', 'error');
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
