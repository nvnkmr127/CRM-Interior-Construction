import React from 'react';
import { Badge, Button, EmptyState } from '../ui';
import LeadCard from './LeadCard';
import styles from './KanbanBoard.module.css';

export default function KanbanBoard({ stages, leadsByStage, onLeadClick }) {
  return (
    <div className={styles.board}>
      {stages.map(stage => (
        <div key={stage.id} className={styles.column} style={{ '--col-color': stage.color || 'var(--color-border)' }}>
          <div className={styles.colHeader}>
            <div className={styles.colTitle}>
              {stage.name}
              <Badge variant="neutral" size="sm">{leadsByStage[stage.id]?.length || 0}</Badge>
            </div>
            <Button variant="ghost" size="sm">+ Add</Button>
          </div>
          <div className={styles.colBody}>
            {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) ? (
              <EmptyState 
                icon="◎" 
                title="No leads in this stage" 
                description=""
                action={{ label: 'Add a lead', onClick: () => console.log('Add lead') }}
              />
            ) : (
              leadsByStage[stage.id].map(lead => (
                <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
