import React, { useState } from 'react';
import styles from './GlobalFilterBar.module.css';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';

export default function GlobalFilterBar() {
  const { globalFilters, updateFilter, resetFilters } = useAnalyticsFilters();
  const [isOpen, setIsOpen] = useState(false);

  const filterConfig = [
    { key: 'dateRange', label: 'Date Range', options: ['YTD', 'Q1', 'Q2', 'Q3', 'Q4', 'Last Year'] },
    { key: 'project', label: 'Project', options: ['All', 'Proj A', 'Proj B', 'Proj C'] },
    { key: 'client', label: 'Client', options: ['All', 'Client X', 'Client Y'] },
    { key: 'branch', label: 'Branch', options: ['All', 'North', 'South', 'East', 'West'] },
    { key: 'projectManager', label: 'PM', options: ['All', 'John D.', 'Sarah M.'] },
    { key: 'designer', label: 'Designer', options: ['All', 'Emily R.', 'David K.'] },
    { key: 'vendor', label: 'Vendor', options: ['All', 'Vendor Alpha', 'Vendor Beta'] },
    { key: 'status', label: 'Status', options: ['All', 'Active', 'Delayed', 'Completed'] },
    { key: 'stage', label: 'Stage', options: ['All', 'Design', 'Execution', 'Handover'] },
    { key: 'projectType', label: 'Type', options: ['All', 'Commercial', 'Residential'] },
    { key: 'budgetRange', label: 'Budget Range', options: ['All', '< 50L', '50L - 1Cr', '> 1Cr'] },
    { key: 'profitMargin', label: 'Profit Margin', options: ['All', '< 15%', '15-25%', '> 25%'] },
    { key: 'city', label: 'City', options: ['All', 'Mumbai', 'Delhi', 'Bangalore'] },
    { key: 'team', label: 'Team', options: ['All', 'Team Alpha', 'Team Beta'] },
    { key: 'materialCategory', label: 'Material', options: ['All', 'Wood', 'Metal', 'Glass'] }
  ];

  return (
    <div className={styles.filterBar}>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.title}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          Global Enterprise Filters
        </div>
        <div className={styles.actions}>
          <button 
            className={styles.resetBtn} 
            onClick={(e) => { e.stopPropagation(); resetFilters(); }}
          >
            Reset All
          </button>
          <svg 
            className={`${styles.toggleIcon} ${isOpen ? styles.open : ''}`} 
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className={styles.grid}>
          {filterConfig.map(f => (
            <div key={f.key} className={styles.filterGroup}>
              <label className={styles.label}>{f.label}</label>
              <select 
                className={styles.select}
                value={globalFilters[f.key]}
                onChange={(e) => updateFilter(f.key, e.target.value)}
              >
                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
