import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import LeadCard from './LeadCard';

export default function StageColumn({ stage, leads, onLeadClick }) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: {
      type: 'Column',
      stage,
    },
  });

  return (
    <div className="flex flex-col flex-shrink-0 w-[280px] h-full bg-gray-100/50 rounded-lg border border-gray-200">
      {/* Column Header */}
      <div className="p-3 font-semibold text-gray-700 flex items-center justify-between border-b border-gray-200 bg-gray-50/80 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color || '#6B6B6B' }}
          />
          <span className="truncate max-w-[180px]">{stage.name}</span>
        </div>
        <div className="bg-white border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full shadow-sm">
          {leads.length}
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 min-h-[150px]"
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
