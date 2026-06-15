import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import LeadCard from './LeadCard';
import StageColumn from './StageColumn';

export default function KanbanBoard({ stages, leads, onLeadClick, onStageChange }) {
  const [localLeads, setLocalLeads] = useState([]);
  const [activeLead, setActiveLead] = useState(null);

  // Sync with upstream props when they change
  useEffect(() => {
    setLocalLeads(leads);
  }, [leads]);

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 5 } // 5px movement required before drag starts
    }),
    useSensor(KeyboardSensor, { 
      coordinateGetter: sortableKeyboardCoordinates 
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const lead = localLeads.find((l) => l.id === active.id);
    setActiveLead(lead);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === 'Lead';
    const isOverALead = over.data.current?.type === 'Lead';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveALead) return;

    // Moving lead over another lead
    if (isActiveALead && isOverALead) {
      setLocalLeads((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        const overIndex = prev.findIndex((t) => t.id === overId);
        
        if (prev[activeIndex].stage_id !== prev[overIndex].stage_id) {
          const newLeads = [...prev];
          // Optimistically update the stage_id
          newLeads[activeIndex] = { ...newLeads[activeIndex], stage_id: prev[overIndex].stage_id };
          return arrayMove(newLeads, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    // Moving lead over empty column area
    if (isActiveALead && isOverAColumn) {
      setLocalLeads((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        if (prev[activeIndex].stage_id !== overId) {
          const newLeads = [...prev];
          newLeads[activeIndex] = { ...newLeads[activeIndex], stage_id: overId };
          return arrayMove(newLeads, activeIndex, activeIndex);
        }
        return prev;
      });
    }
  };

  const handleDragEnd = async (event) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const activeLeadId = active.id;
    
    // Check current state after the visual optimistic update
    const currentLocalLead = localLeads.find((l) => l.id === activeLeadId);
    if (!currentLocalLead) return;

    const newStageId = currentLocalLead.stage_id;

    // Compare with the original truth
    const originalLead = leads.find((l) => l.id === activeLeadId);
    
    // Only fire the API call if the column has actually changed
    if (originalLead && originalLead.stage_id !== newStageId) {
      try {
        await onStageChange(activeLeadId, newStageId);
      } catch (error) {
        // Parent is responsible for showing the error toast.
        // We revert the optimistic update here.
        setLocalLeads(leads);
      }
    }
  };

  return (
    <div className="flex h-full w-full overflow-x-auto overflow-y-hidden gap-4 p-4 snap-x snap-mandatory">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {stages.map((stage) => {
          const columnLeads = localLeads.filter((l) => l.stage_id === stage.id);
          return (
            <div key={stage.id} className="snap-center shrink-0 w-[85vw] sm:w-80 h-full">
              <StageColumn
                stage={stage}
                leads={columnLeads}
                onLeadClick={onLeadClick}
              />
            </div>
          );
        })}

        {/* The overlay is what actually gets dragged by the cursor */}
        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
