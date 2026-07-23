import React, { useState, useEffect, useRef } from 'react';
import Input from './Input';
import Button from './Button';
import Select from './Select';
import Badge from './Badge';
import { FiSearch, FiFilter, FiSave, FiX, FiCheck } from 'react-icons/fi';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function SearchFilterBar({ 
  moduleName,
  onFilterChange,
  departments = [],
  roles = [],
  branches = [],
  managers = [] 
}) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  const [selectedSavedFilter, setSelectedSavedFilter] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  
  const [filters, setFilters] = useState({
    role: '',
    status: '',
    department_id: '',
    manager_id: '',
    branch_id: '',
    joining_month: false,
    no_logins: false,
    no_projects: false,
    no_tasks: false,
    inactive_locked: false
  });

  const toast = useToast();
  const filterRef = useRef(null);
  
  useEffect(() => {
    fetchSavedFilters();
    
    // Click outside to close filter popover
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFirstRender = useRef(true);

  // Debounced search
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handler = setTimeout(() => {
      onFilterChange({ search, ...filters });
    }, 300);
    return () => clearTimeout(handler);
  }, [search, filters]);

  const fetchSavedFilters = async () => {
    try {
      const res = await api.get(`/filters/${moduleName}`);
      setSavedFilters(res.data.data || []);
    } catch (err) {
      console.error('Failed to load saved filters', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      role: '', status: '', department_id: '', manager_id: '', branch_id: '',
      joining_month: false, no_logins: false, no_projects: false, no_tasks: false, inactive_locked: false
    });
    setSelectedSavedFilter('');
  };

  const loadSavedFilter = (id) => {
    const target = savedFilters.find(f => f.id === id);
    if (target) {
      setFilters(target.filter_state);
      setSelectedSavedFilter(id);
    }
  };

  const saveFilter = async () => {
    if (!newFilterName.trim()) return;
    try {
      const res = await api.post('/filters', {
        module: moduleName,
        name: newFilterName,
        filter_state: filters
      });
      setSavedFilters(prev => [...prev, res.data.data]);
      setSelectedSavedFilter(res.data.data.id);
      setShowSaveModal(false);
      setNewFilterName('');
      toast.success('Filter saved successfully!');
    } catch (err) {
      toast.error('Failed to save filter.');
    }
  };

  const deleteFilter = async (id) => {
    try {
      await api.delete(`/filters/${id}`);
      setSavedFilters(prev => prev.filter(f => f.id !== id));
      if (selectedSavedFilter === id) {
        clearFilters();
      }
      toast.success('Filter deleted.');
    } catch (err) {
      toast.error('Failed to delete filter.');
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '' && v !== false).length;

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%', position: 'relative' }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Search by ID, Name, Email..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '10px 16px 10px 40px', 
            borderRadius: '8px', 
            border: '1px solid var(--color-border)',
            background: 'var(--color-background-soft)',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ position: 'relative' }} ref={filterRef}>
        <Button variant={activeFiltersCount > 0 ? "primary" : "secondary"} onClick={() => setShowFilters(!showFilters)}>
          <FiFilter style={{ marginRight: '8px' }} />
          Filters {activeFiltersCount > 0 && <Badge variant="primary" style={{ marginLeft: '8px' }}>{activeFiltersCount}</Badge>}
        </Button>

        {showFilters && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: '350px', background: '#fff', borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 50, border: '1px solid var(--color-border)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Advanced Filters</h4>
              <Button variant="ghost" onClick={clearFilters} style={{ padding: '4px 8px', fontSize: '12px' }}>Clear All</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
              <Select label="Saved Filters" value={selectedSavedFilter} onChange={e => {
                const val = e.target.value;
                if (val) loadSavedFilter(val);
                else clearFilters();
              }}>
                <option value="">-- Custom Filter --</option>
                {savedFilters.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>

              <Select label="Department" value={filters.department_id} onChange={e => handleFilterChange('department_id', e.target.value)}>
                <option value="">Any Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>

              <Select label="Manager" value={filters.manager_id} onChange={e => handleFilterChange('manager_id', e.target.value)}>
                <option value="">Any Manager</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>

              <Select label="Role" value={filters.role} onChange={e => handleFilterChange('role', e.target.value)}>
                <option value="">Any Role</option>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </Select>
              
              <Select label="Branch" value={filters.branch_id} onChange={e => handleFilterChange('branch_id', e.target.value)}>
                <option value="">Any Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '4px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>Quick Filters</strong>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.joining_month} onChange={e => handleFilterChange('joining_month', e.target.checked)} />
                  Joined This Month
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.no_logins} onChange={e => handleFilterChange('no_logins', e.target.checked)} />
                  Never Logged In
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.no_projects} onChange={e => handleFilterChange('no_projects', e.target.checked)} />
                  No Projects
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.no_tasks} onChange={e => handleFilterChange('no_tasks', e.target.checked)} />
                  No Tasks
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.inactive_locked} onChange={e => handleFilterChange('inactive_locked', e.target.checked)} />
                  Inactive / Locked
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setShowSaveModal(true)} disabled={activeFiltersCount === 0 || selectedSavedFilter !== ''}>
                <FiSave style={{ marginRight: '6px' }} /> Save Filter
              </Button>
              {selectedSavedFilter && (
                <Button variant="danger" onClick={() => deleteFilter(selectedSavedFilter)}>
                  Delete Filter
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {showSaveModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '350px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Save Custom Filter</h3>
            <Input 
              label="Filter Name" 
              value={newFilterName}
              onChange={e => setNewFilterName(e.target.value)}
              placeholder="e.g. Needs Onboarding"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <Button variant="ghost" onClick={() => setShowSaveModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveFilter} disabled={!newFilterName.trim()}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
