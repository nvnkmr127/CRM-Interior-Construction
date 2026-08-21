/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import KanbanLeadCard from './KanbanLeadCard';
import { Badge } from '../ui'; // Standard UI badge
import styles from './LeadKanbanBoard.module.css';

// Droppable Column Component
const KanbanColumn = React.memo(function KanbanColumn({ stage, leads, activeId, users, onLeadClick, onMarkLost, onPark, onReassign }) {
  const { setNodeRef } = useDroppable({ id: stage.id });
  const [visibleCount, setVisibleCount] = useState(50);
  
  const visibleLeads = useMemo(() => leads.slice(0, visibleCount), [leads, visibleCount]);
  
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.budget_max) || Number(lead.revenue_potential) || 0), 0);
  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalValue);

  const isOverLimit = stage.wip_limit != null && leads.length > stage.wip_limit;

  return (
    <div 
      className={`${styles.column} ${isOverLimit ? styles.columnLimitExceeded : ''}`}
    >
      <div className={styles.colHeader}>
        <div>
          <h3 className={styles.colTitle}>
            {stage.name} 
            <Badge variant={isOverLimit ? "danger" : "secondary"}>
              {leads.length}{stage.wip_limit != null ? ` / ${stage.wip_limit}` : ''}
            </Badge>
          </h3>
          <p className={styles.colSubtitle}>{formattedValue}</p>
        </div>
        {isOverLimit && (
          <div title="WIP Limit Exceeded" style={{ color: 'var(--color-danger, #ef4444)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
        )}
      </div>
      
      <div ref={setNodeRef} className={styles.colBody}>
        <SortableContext items={visibleLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {visibleLeads.map(lead => (
            <KanbanLeadCard 
              key={lead.id} 
              lead={lead} 
              users={users}
              onAction={(action, payload) => {
                if (action === 'view' && onLeadClick) onLeadClick(lead.id);
                if (action === 'lost' && onMarkLost) onMarkLost(lead.id);
                if (action === 'park' && onPark) onPark(lead.id);
                if (action === 'reassign' && onReassign) onReassign(lead.id, payload);
              }} 
            />
          ))}
        </SortableContext>
        
        {leads.length > visibleCount && (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <button 
              className="text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-1.5 rounded-full shadow-sm transition-all"
              style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)' }}
              onClick={() => setVisibleCount(v => v + 50)}
            >
              Load {Math.min(50, leads.length - visibleCount)} more (of {leads.length - visibleCount})
            </button>
          </div>
        )}

        {leads.length === 0 && (
          <div className={styles.emptyColumnState}>
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
});

export default function LeadKanbanBoard({ initialLeads = [], stages = [], users = [], onStageChange, onReassign, onLeadClick, onMarkLost, onPark }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState(null);
  
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const leadsByStage = useMemo(() => {
    const acc = {};
    if (Array.isArray(stages)) {
      for (const s of stages) {
        acc[s.id] = [];
      }
    }
    if (Array.isArray(leads)) {
      for (const lead of leads) {
        const stageId = lead.stage_id || lead.stage;
        if (acc[stageId]) {
          acc[stageId].push(lead);
        } else {
          if (!acc['unknown']) acc['unknown'] = [];
          acc['unknown'].push(lead);
        }
      }
    }
    return acc;
  }, [leads, stages]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id;
    let targetStageId = over.id;

    // Handle dropping over another card instead of column background
    const targetLead = leads.find(l => l.id === targetStageId);
    if (targetLead) {
      targetStageId = targetLead.stage_id || targetLead.stage;
    }

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
    <div className={styles.boardContainer}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white font-medium transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.board}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {stages.map(stage => (
            <KanbanColumn 
              key={stage.id} 
              stage={stage} 
              leads={leadsByStage[stage.id] || []} 
              activeId={activeId} 
              users={users}
              onLeadClick={onLeadClick}
              onMarkLost={onMarkLost}
              onPark={onPark}
              onReassign={onReassign}
            />
          ))}

          <DragOverlay>
            {activeLead ? (
              <div style={{ transform: 'rotate(2deg)', width: '260px' }}>
                <KanbanLeadCard lead={activeLead} users={users} isDraggingOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
