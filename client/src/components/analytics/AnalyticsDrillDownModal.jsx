import React, { useState, useMemo } from 'react';
import { Modal, DataTable, Button, Input, Pagination } from '../ui';
import { useToast } from '../../store/toastContext';

export default function AnalyticsDrillDownModal({ isOpen, onClose, title, data = [] }) {
  const toast = useToast();
  
  // -- State --
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState({ key: 'date', dir: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [stageMenuOpen, setStageMenuOpen] = useState(false);

  // -- Handlers --
  const handleSort = (key) => {
    if (sortBy.key === key) {
      setSortBy({ key, dir: sortBy.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setSortBy({ key, dir: 'desc' });
    }
  };

  const handleExportCSV = () => {
    if (!data.length) return;
    
    // Convert to CSV
    const headers = ['Lead Name', 'Stage', 'Amount', 'Source', 'Date'];
    const rows = filteredAndSortedData.map(d => [
      d.name, 
      d.stage, 
      d.amount, 
      d.source, 
      d.date
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_Leads.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Exported to CSV');
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} leads?`)) return;
    toast.success(`Successfully deleted ${selectedIds.size} leads (Simulated)`);
    setSelectedIds(new Set());
  };

  const handleBulkStageChange = (stage) => {
    toast.success(`Moved ${selectedIds.size} leads to ${stage} (Simulated)`);
    setStageMenuOpen(false);
    setSelectedIds(new Set());
  };

  // -- Derived Data --
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];
    
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(lead => 
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.source && lead.source.toLowerCase().includes(q)) ||
        (lead.stage && lead.stage.toLowerCase().includes(q))
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy.key];
      let bVal = b[sortBy.key];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortBy.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.dir === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [data, search, sortBy]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredAndSortedData.slice(startIndex, startIndex + limit);
  }, [filteredAndSortedData, page, limit]);

  // -- Table Columns --
  const columns = [
    { key: 'name', label: 'Lead Name', sortable: true },
    { key: 'stage', label: 'Stage', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true },
    { key: 'source', label: 'Source', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
  ];

  if (title.includes('Wins') || title.includes('Losses') || title.includes('Risk') || title.includes('Opportunity') || title.includes('AI Insight') || title.includes('Forecast')) {
    columns.push(
      { key: 'winProb', label: 'Win Probability' },
      { key: 'confidence', label: 'Confidence Score' }
    );
    // Enrich paginated data for AI views
    paginatedData.forEach(row => {
      row.winProb = <span style={{ fontWeight: 700, color: row.amount > 50000 ? '#059669' : '#D97706' }}>{row.amount > 100000 ? '85%' : '45%'}</span>;
      row.confidence = <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7C3AED', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>92%</span>;
    });
  }

  // Assign IDs to dummy data if missing so selection works
  paginatedData.forEach((row, idx) => {
    if (!row.id) row.id = `mock-${idx}`;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Analytics &nbsp;&gt;&nbsp; Drill-Down
        </span>
        <span style={{ fontSize: '1.25rem' }}>{title}</span>
      </div>
    } size="xl">
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
        
        {/* Bulk Actions Toolbar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>
              {selectedIds.size} selected
            </span>
            <div style={{ position: 'relative' }}>
              <Button variant="outline" size="sm" onClick={() => setStageMenuOpen(!stageMenuOpen)}>
                Change Stage
              </Button>
              {stageMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '150px' }}>
                  {['New', 'Contacted', 'Site Visit', 'Quotation', 'Negotiation'].map(s => (
                    <div 
                      key={s} 
                      style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)' }}
                      onClick={() => handleBulkStageChange(s)}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancel</Button>
          </div>
        )}

        {/* Top Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ width: '300px' }}>
            <Input 
              type="text" 
              placeholder="Search leads..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            📥 Export CSV
          </Button>
        </div>
        
        {/* Table */}
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={paginatedData}
            selectable={true}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            sortBy={sortBy}
            onSort={handleSort}
            emptyMessage="No matching leads found."
          />
        </div>

        {/* Pagination */}
        {filteredAndSortedData.length > limit && (
          <div style={{ marginTop: '16px' }}>
            <Pagination 
              currentPage={page}
              totalPages={Math.ceil(filteredAndSortedData.length / limit)}
              onPageChange={setPage}
            />
          </div>
        )}

      </div>
    </Modal>
  );
}
