import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Avatar from '../ui/Avatar';
import { formatDistanceToNow } from 'date-fns';

const PhoneIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
  </svg>
);

const DragHandleIcon = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
    <circle cx="4" cy="4" r="1.5" />
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="4" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="4" cy="12" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);

export default function LeadCard({ lead, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'Lead', lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const getSourceColor = (source) => {
    switch ((source || '').toLowerCase()) {
      case 'facebook': return 'bg-blue-100 text-blue-700';
      case 'website': return 'bg-emerald-100 text-emerald-700';
      case 'indimart': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const lastActivity = lead.activities?.[0] || lead.last_activity;
  
  let timeAgo = '';
  if (lastActivity?.created_at) {
    try {
      timeAgo = formatDistanceToNow(new Date(lastActivity.created_at), { addSuffix: true });
    } catch (e) {
      timeAgo = 'recently';
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white p-2 rounded-lg border border-gray-200 mb-2 shadow-sm hover:shadow relative ${
        isDragging ? 'z-50' : 'z-auto'
      }`}
    >
      {/* Absolute Drag Handle - Shown on group hover */}
      <div 
        className="absolute top-2 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon />
      </div>

      {/* Main clickable area - Left padding applied to make room for drag handle */}
      <div 
        className="pl-5 cursor-pointer flex flex-col gap-1.5"
        onClick={() => onClick && onClick(lead)}
      >
        {/* Row 1: Name + Score */}
        <div className="flex justify-between items-start">
          <div className="font-bold text-sm text-gray-900 truncate pr-2">
            {lead.name}
          </div>
          {lead.score > 0 && (
            <div className="shrink-0 bg-blue-50 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded border border-blue-100">
              {lead.score}
            </div>
          )}
        </div>

        {/* Row 2: Phone */}
        <div className="flex items-center text-xs text-gray-500 gap-1">
          <PhoneIcon className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.phone || 'No phone'}</span>
        </div>

        {/* Row 3: Source + Assignee */}
        <div className="flex items-center justify-between mt-1">
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${getSourceColor(lead.source)}`}>
            {lead.source || 'Unknown'}
          </div>
          <div className="shrink-0">
            {lead.assignee_name && (
              <Avatar name={lead.assignee_name} imageUrl={lead.assignee_avatar} size="sm" />
            )}
            {!lead.assignee_name && lead.assignee_id && (
              <Avatar name="Unassigned" size="sm" />
            )}
          </div>
        </div>

        {/* Row 4: Last Activity */}
        {lastActivity && (
          <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 mt-0.5">
            <span className="capitalize">{lastActivity.type || lastActivity.title || 'Activity'}</span>
            {timeAgo && <span> &middot; {timeAgo}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
