import React, { useState, useEffect } from 'react';
import styles from './AdvancedFilters.module.css';
import Select from '../ui/Select';

export default function AdvancedFilters({ onApply, onReset, appliedFilters }) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  
  const initialFilters = {
    status: [],
    transaction_type: [],
    project: [],
    customer: [],
    requester: [],
    vendor: [],
    department: [],
    branch: [],
    priority: [],
    approvalLevel: [],
    paymentMethod: [],
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: ''
  };

  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    const saved = localStorage.getItem('financialApprovalFilters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Sync internal state with external applied filters (e.g. when a chip is removed)
  useEffect(() => {
    if (!appliedFilters) return;
    
    const newFilters = { ...initialFilters };
    Object.entries(appliedFilters).forEach(([key, val]) => {
      if (key === 'minAmount' || key === 'maxAmount' || key === 'startDate' || key === 'endDate') {
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
    localStorage.setItem('financialApprovalFilters', JSON.stringify(newSaved));
    alert('Filter saved successfully!');
  };

  const loadSavedFilter = (saved) => {
    setFilters(saved.filters);
  };

  if (!isOpen) {
    return (
      <div className={styles.containerCollapsed}>
        <button className={styles.toggleBtn} onClick={() => setIsOpen(true)}>
          <span className={styles.icon}>⚡</span> Advanced Filters
        </button>
      </div>
    );
  }

  // Mock options for dropdowns (in a real app, these would be fetched from API)
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const typeOptions = [
    { value: 'invoice', label: 'Invoice Generation' },
    { value: 'payment', label: 'Payment Creation' },
    { value: 'payment_update', label: 'Payment Record' },
    { value: 'discount', label: 'Discount Application' },
    { value: 'credit', label: 'Credit Note' },
    { value: 'refund', label: 'Refund' }
  ];

  const projectOptions = [
    { value: 'Alpha Tower', label: 'Alpha Tower' },
    { value: 'Beta Complex', label: 'Beta Complex' },
    { value: 'Gamma Residences', label: 'Gamma Residences' }
  ];

  const customerOptions = [
    { value: 'Acme Corp', label: 'Acme Corp' },
    { value: 'Globex', label: 'Globex' },
    { value: 'Initech', label: 'Initech' }
  ];

  const vendorOptions = [
    { value: 'Vendor A', label: 'Vendor A' },
    { value: 'Vendor B', label: 'Vendor B' },
    { value: 'Vendor C', label: 'Vendor C' }
  ];

  const requesterOptions = [
    { value: 'Alice Manager', label: 'Alice Manager' },
    { value: 'Bob Director', label: 'Bob Director' },
    { value: 'System', label: 'System' }
  ];

  const deptOptions = [
    { value: 'finance', label: 'Finance' },
    { value: 'sales', label: 'Sales' },
    { value: 'operations', label: 'Operations' }
  ];

  const branchOptions = [
    { value: 'hq', label: 'Headquarters' },
    { value: 'north', label: 'North Branch' },
    { value: 'south', label: 'South Branch' }
  ];

  const priorityOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const levelOptions = [
    { value: 'l1', label: 'Level 1 (Manager)' },
    { value: 'l2', label: 'Level 2 (Director)' },
    { value: 'l3', label: 'Level 3 (VP)' }
  ];

  const paymentMethodOptions = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Advanced Enterprise Filters</h3>
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
          label="Status"
          options={statusOptions}
          value={filters.status}
          onChange={(v) => setFilters({...filters, status: v})}
          multi={true}
          searchable={true}
          placeholder="Select Statuses"
        />

        <Select 
          label="Transaction Type"
          options={typeOptions}
          value={filters.transaction_type}
          onChange={(v) => setFilters({...filters, transaction_type: v})}
          multi={true}
          searchable={true}
          placeholder="Select Types"
        />

        <Select 
          label="Project"
          options={projectOptions}
          value={filters.project}
          onChange={(v) => setFilters({...filters, project: v})}
          multi={true}
          searchable={true}
          placeholder="Select Projects"
        />

        <Select 
          label="Customer"
          options={customerOptions}
          value={filters.customer}
          onChange={(v) => setFilters({...filters, customer: v})}
          multi={true}
          searchable={true}
          placeholder="Select Customers"
        />

        <Select 
          label="Vendor (Mock)"
          options={vendorOptions}
          value={filters.vendor}
          onChange={(v) => setFilters({...filters, vendor: v})}
          multi={true}
          searchable={true}
          placeholder="Select Vendors"
        />

        <Select 
          label="Requester"
          options={requesterOptions}
          value={filters.requester}
          onChange={(v) => setFilters({...filters, requester: v})}
          multi={true}
          searchable={true}
          placeholder="Select Requesters"
        />

        <Select 
          label="Department (Mock)"
          options={deptOptions}
          value={filters.department}
          onChange={(v) => setFilters({...filters, department: v})}
          multi={true}
          searchable={true}
          placeholder="Select Departments"
        />

        <Select 
          label="Branch (Mock)"
          options={branchOptions}
          value={filters.branch}
          onChange={(v) => setFilters({...filters, branch: v})}
          multi={true}
          searchable={true}
          placeholder="Select Branches"
        />

        <Select 
          label="Priority (Mock)"
          options={priorityOptions}
          value={filters.priority}
          onChange={(v) => setFilters({...filters, priority: v})}
          multi={true}
          searchable={true}
          placeholder="Select Priorities"
        />

        <Select 
          label="Approval Level (Mock)"
          options={levelOptions}
          value={filters.approvalLevel}
          onChange={(v) => setFilters({...filters, approvalLevel: v})}
          multi={true}
          searchable={true}
          placeholder="Select Levels"
        />

        <Select 
          label="Payment Method (Mock)"
          options={paymentMethodOptions}
          value={filters.paymentMethod}
          onChange={(v) => setFilters({...filters, paymentMethod: v})}
          multi={true}
          searchable={true}
          placeholder="Select Methods"
        />

        {/* Amount Range */}
        <div className={styles.filterGroup}>
          <label>Amount Range</label>
          <div className={styles.rangeGroup}>
            <input 
              type="number" 
              placeholder="Min" 
              value={filters.minAmount}
              onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
              className={styles.input}
            />
            <span>-</span>
            <input 
              type="number" 
              placeholder="Max" 
              value={filters.maxAmount}
              onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
              className={styles.input}
            />
          </div>
        </div>

        {/* Dates */}
        <div className={styles.filterGroup}>
          <label>Date Range</label>
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
  );
}
