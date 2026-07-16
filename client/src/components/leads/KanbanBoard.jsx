/* eslint-disable no-unused-vars */
import React from 'react';
import { Badge, Button, EmptyState } from '../ui';
import LeadCard from './LeadCard';
import styles from './KanbanBoard.module.css';

export default function KanbanBoard({ stages, leadsByStage, onLeadClick, onAddLead, onMoveLead }) {
  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    if (leadId && onMoveLead) {
      onMoveLead(leadId, stageId);
    }
  };

  return (
    <div className={styles.board}>
      {stages.map(stage => (
        <div 
          key={stage.id} 
          className={styles.column} 
          style={{ '--col-color': stage.color || 'var(--color-border)' }}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          <div className={styles.colHeader}>
            <div className={styles.colTitle}>
              {stage.name}
              <Badge variant="neutral" size="sm">{leadsByStage[stage.id]?.length || 0}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onAddLead}>+ Add</Button>
          </div>
          <div className={styles.colBody}>
            {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) ? (
              <EmptyState 
                icon="◎" 
                title="No leads in this stage" 
                description=""
                action={{ label: 'Add a lead', onClick: onAddLead }}
              />
            ) : (
              leadsByStage[stage.id].map(lead => (
                <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} draggable />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
