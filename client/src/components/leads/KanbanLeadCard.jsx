import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '../ui/badge'; // Assuming standard UI
import ScoreBadge from './ScoreBadge';

export default function KanbanLeadCard({ lead, onAction }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { ...lead } });

  const [showMenu, setShowMenu] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSlaBreached = lead.days_in_stage > 3; // Example SLA: > 3 days is breached

  const handleAction = (e, actionType) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onAction) onAction(actionType, lead);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`bg-white p-4 rounded-lg shadow-sm border mb-3 cursor-grab hover:shadow-md transition-shadow relative ${isDragging ? 'ring-2 ring-primary cursor-grabbing' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-800 line-clamp-1">{lead.name}</h4>
        <ScoreBadge score={lead.score} />
      </div>

      <div className="text-sm text-gray-500 mb-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate">{lead.locality || 'Unknown Locality'}</span>
          <span>•</span>
          <span>{lead.carpet_area_sqft ? `${lead.carpet_area_sqft} sqft` : 'Area TBA'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" size="sm">{lead.scope || 'Unspecified Scope'}</Badge>
        </div>
      </div>

      <div className="flex justify-between items-end mt-4">
        <div className={`text-xs px-2 py-1 rounded-full ${isSlaBreached ? 'bg-red-100 text-red-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>
          {lead.days_in_stage || 0}d in stage
        </div>
        
        <div className="flex items-center gap-2">
          {lead.assignee_avatar ? (
            <img src={lead.assignee_avatar} alt="avatar" className="w-6 h-6 rounded-full" title={lead.assignee_name} />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold" title={lead.assignee_name}>
              {(lead.assignee_name || '?').charAt(0).toUpperCase()}
            </div>
          )}
          
          <div className="flex items-center gap-1 border-l pl-2 relative">
             <button 
                type="button"
                onClick={(e) => handleAction(e, 'schedule')}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-primary transition-colors"
                title="Schedule Visit"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </button>
             
             <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition-colors"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
             </button>

             {showMenu && (
                <div className="absolute right-0 bottom-full mb-1 w-32 bg-white border shadow-lg rounded-md overflow-hidden z-10 text-sm">
                   <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={(e) => handleAction(e, 'reassign')}>Reassign</button>
                   <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={(e) => handleAction(e, 'park')}>Park Lead</button>
                   <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600" onClick={(e) => handleAction(e, 'lost')}>Mark Lost</button>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
