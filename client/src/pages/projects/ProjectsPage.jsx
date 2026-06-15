import React, { useState } from 'react';
import { Button, Badge } from '../../components/ui';
import ProjectCard from '../../components/projects/ProjectCard';
import styles from './ProjectsPage.module.css';
import { useNavigate } from 'react-router-dom';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  
  // Dummy data for rendering the redesign
  const projects = [
    { id: 1, name: 'Villa Renovation', clientName: 'Aditya Birla', type: 'Residential', status: 'Active', pmName: 'Rahul Sharma', progress: 75, completedTasks: 15, totalTasks: 20, phase: 'Phase 2: Execution', value: '₹12.5L', targetDate: '2026-08-15', overdue: false },
    { id: 2, name: 'Office Fitout', clientName: 'TechFlow Pvt Ltd', type: 'Commercial', status: 'Overdue', pmName: 'Neha Gupta', progress: 40, completedTasks: 8, totalTasks: 20, phase: 'Phase 1: Design', value: '₹45.0L', targetDate: '2026-06-10', overdue: true },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <Button variant="primary">+ New Project</Button>
      </div>

      <div className={styles.kpiStrip}>
        <span>Active: 12</span> &middot;
        <span>On Hold: 2</span> &middot;
        <span>Completed: 8</span> &middot;
        <span className={styles.dangerText}>Overdue: 3</span>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.pills}>
          <Badge variant="accent">All</Badge>
          <Badge variant="neutral">Active</Badge>
          <Badge variant="neutral">Completed</Badge>
        </div>
        <div className={styles.controls}>
          <select className={styles.search}><option>All PMs</option></select>
          <input className={styles.search} placeholder="⌕ Search projects..." />
          <div style={{display:'flex', gap:'4px'}}>
            <Button variant={view==='grid'?'secondary':'ghost'} size="sm" onClick={()=>setView('grid')}>⊞</Button>
            <Button variant={view==='list'?'secondary':'ghost'} size="sm" onClick={()=>setView('list')}>≡</Button>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
        ))}
      </div>
    </div>
  );
}
