import React, { useState, useEffect } from 'react';
import styles from '../../components/finance/AdvancedFilters.module.css';
import Select from '../../components/ui/Select';
import eventRegistry from '../../utils/eventRegistry';

export default function WebhookFilters({ onApply, onReset, appliedFilters, rightContent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  
  const initialFilters = {
    event: [],
    status: [],
    debugMode: [],
    createdBy: '',
    startDate: '',
    endDate: '',
    responseStatus: []
  };

  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    const saved = localStorage.getItem('webhookFiltersViews');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (!appliedFilters) return;
    const newFilters = { ...initialFilters };
    Object.entries(appliedFilters).forEach(([key, val]) => {
      if (key === 'createdBy' || key === 'startDate' || key === 'endDate') {
        newFilters[key] = val;
      } else {
        newFilters[key] = typeof val === 'string' ? val.split(',') : val;
      }
    });
    setFilters(newFilters);
  }, [appliedFilters]);

  const handleApply = () => {
    const activeFilters = Object.entries(filters).reduce((acc, [key, val]) => {
      if (Array.isArray(val) && val.length > 0) acc[key] = val.join(',');
      else if (typeof val === 'string' && val.trim() !== '') acc[key] = val;
      return acc;
    }, {});
    
    onApply(activeFilters);
  };

  const handleReset = () => {
    setFilters(initialFilters);
    onApply({});
    if (onReset) onReset();
  };

  const handleSave = () => {
    const filterName = prompt("Enter a name for this saved filter:");
    if (!filterName) return;
    const newSaved = [...savedFilters, { name: filterName, filters }];
    setSavedFilters(newSaved);
    localStorage.setItem('webhookFiltersViews', JSON.stringify(newSaved));
    alert('Filter saved successfully!');
  };

  const loadSavedFilter = (saved) => {
    setFilters(saved.filters);
  };

  if (!isOpen) {
    return (
      <div className={styles.containerCollapsed} style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <button className={styles.toggleBtn} onClick={() => setIsOpen(true)}>
          <span className={styles.icon}>⚡</span> Advanced Filters
        </button>
        {rightContent}
      </div>
    );
  }

  const allEvents = eventRegistry.getAllEventNames().map(eventName => ({
    value: eventName,
    label: eventName
  }));

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  const debugOptions = [
    { value: 'true', label: 'Debug ON' },
    { value: 'false', label: 'Debug OFF' }
  ];

  const responseStatusOptions = [
    { value: 'healthy', label: 'Healthy (Success)' },
    { value: 'failing', label: 'Failing' },
    { value: 'none', label: 'No Deliveries' }
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <button className={styles.toggleBtn} onClick={() => setIsOpen(false)} style={{ background: '#f8fafc' }}>
          <span className={styles.icon}>⚡</span> Close Filters
        </button>
        {rightContent}
      </div>

      <div className={styles.container} style={{ marginBottom: 0 }}>
        <div className={styles.header}>
          <h3>Webhook Filters</h3>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

      <div className={styles.savedFiltersBar}>
        <span className={styles.savedLabel}>Saved Views:</span>
        {savedFilters.map((sf, idx) => (
          <button key={idx} className={styles.savedBadge} onClick={() => loadSavedFilter(sf)}>
            {sf.name}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        <Select 
          label="Event"
          options={allEvents}
          value={filters.event}
          onChange={(v) => setFilters({...filters, event: v})}
          multi={true}
          searchable={true}
          placeholder="Select Events"
        />

        <Select 
          label="Status"
          options={statusOptions}
          value={filters.status}
          onChange={(v) => setFilters({...filters, status: v})}
          multi={true}
          searchable={false}
          placeholder="Select Status"
        />

        <Select 
          label="Debug Mode"
          options={debugOptions}
          value={filters.debugMode}
          onChange={(v) => setFilters({...filters, debugMode: v})}
          multi={true}
          searchable={false}
          placeholder="Select Mode"
        />

        <Select 
          label="Response Status"
          options={responseStatusOptions}
          value={filters.responseStatus}
          onChange={(v) => setFilters({...filters, responseStatus: v})}
          multi={true}
          searchable={false}
          placeholder="Select Response Status"
        />

        <div className={styles.filterGroup}>
          <label>Created By</label>
          <input 
            type="text" 
            placeholder="Search username" 
            value={filters.createdBy}
            onChange={(e) => setFilters({...filters, createdBy: e.target.value})}
            className={styles.input}
            style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid var(--color-border)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Last Delivery Date</label>
          <div className={styles.rangeGroup}>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className={styles.input}
            />
            <span>-</span>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className={styles.input}
            />
          </div>
        </div>

      </div>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={handleReset}>Reset Filters</button>
        <button className={styles.btnSecondary} onClick={handleSave}>Save Filter</button>
        <button className={styles.btnPrimary} onClick={handleApply}>Apply Filters</button>
      </div>
    </div>
    </div>
  );
}
