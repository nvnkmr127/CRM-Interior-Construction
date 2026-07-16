/* eslint-disable no-unused-vars */
import React from 'react';
import { Input, Button } from '../ui';

export default function LeadFilterBar({ filters, setFilters, reps }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleRepChange = (e) => {
    // Multi-select simulation for reps
    const value = Array.from(e.target.selectedOptions, option => option.value);
    setFilters((prev) => ({ ...prev, reps: value }));
  };

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-4 items-start mb-6 p-5 rounded-xl shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderWidth: '1px' }}>
      <div className="flex-1 min-w-[220px]">
        <Input 
          type="text" 
          name="search" 
          placeholder="Search by name or phone..." 
          value={filters.search || ''} 
          onChange={handleChange} 
        />
      </div>

      <div className="min-w-[150px]">
        <select 
          name="reps" 
          multiple 
          value={filters.reps || []} 
          onChange={handleRepChange}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="" disabled className="text-xs text-gray-400">Hold Ctrl for multiple</option>
          {reps?.map(rep => (
            <option key={rep.id} value={rep.id}>{rep.name}</option>
          ))}
        </select>
      </div>

      <div className="min-w-[120px]">
        <select 
          name="scoreTier" 
          value={filters.scoreTier || ''} 
          onChange={handleChange}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Tiers</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
          <option value="dead">Dead</option>
        </select>
      </div>

      <div className="min-w-[120px]">
        <select 
          name="intent" 
          value={filters.intent || ''} 
          onChange={handleChange}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Intents</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="min-w-[120px]">
        <Input 
          type="text" 
          name="source" 
          placeholder="Source" 
          value={filters.source || ''} 
          onChange={handleChange} 
        />
      </div>

      <div className="min-w-[120px]">
        <Input 
          type="text" 
          name="locality" 
          placeholder="Locality" 
          value={filters.locality || ''} 
          onChange={handleChange} 
        />
      </div>

      <Button variant="outline" onClick={() => setFilters({ search: '', reps: [], scoreTier: '', source: '', locality: '', intent: '' })}>
        Clear
      </Button>
    </div>
  );
}
