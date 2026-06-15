import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { useLeads } from '../../hooks/useLeads';
import KanbanBoard from '../../components/leads/KanbanBoard';
import LeadDrawer from '../../components/leads/LeadDrawer';
import LeadForm from '../../components/leads/LeadForm';
import ScoreBadge from '../../components/leads/ScoreBadge';
import ContentLoader from '../../components/ui/ContentLoader';
import { format } from 'date-fns';

export default function LeadsPage() {
  const [activeView, setActiveView] = useState('kanban'); // 'kanban' | 'list'
  
  const [filters, setFilters] = useState({
    stageId: '',
    assigneeId: '',
    source: '',
    search: '',
    sortBy: 'created_at',
    sortDesc: true
  });

  const { leads, stages, loading, refetch, optimisticStageChange } = useLeads(filters);
  const [users, setUsers] = useState([]);

  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fetch users for the assignee filter (could also be its own hook)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await api.get('/users').catch(() => ({ data: { data: [] } }));
        if (usersRes.data?.success) setUsers(usersRes.data.data);
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    };
    fetchUsers();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (field) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortDesc: prev.sortBy === field ? !prev.sortDesc : true
    }));
  };

  const handleStageChange = async (leadId, newStageId) => {
    try {
      await optimisticStageChange(leadId, newStageId);
    } catch (err) {
      console.error('Stage change failed', err);
      alert('Failed to change lead stage. Please try again.');
    }
  };

  const renderSortIcon = (field) => {
    if (filters.sortBy !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return filters.sortDesc ? <span className="ml-1 text-blue-500">↓</span> : <span className="ml-1 text-blue-500">↑</span>;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* Top Bar */}
      <div className="px-6 py-5 flex justify-between items-center bg-white border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Lead
        </button>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex flex-col xl:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <select 
            name="stageId" value={filters.stageId} onChange={handleFilterChange}
            className="border border-gray-300 rounded-md text-sm p-2 bg-white min-w-[140px] focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="">All Stages</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select 
            name="assigneeId" value={filters.assigneeId} onChange={handleFilterChange}
            className="border border-gray-300 rounded-md text-sm p-2 bg-white min-w-[140px] focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <select 
            name="source" value={filters.source} onChange={handleFilterChange}
            className="border border-gray-300 rounded-md text-sm p-2 bg-white min-w-[140px] focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm capitalize cursor-pointer"
          >
            <option value="">All Sources</option>
            <option value="website">Website</option>
            <option value="facebook">Facebook</option>
            <option value="indimart">IndiaMART</option>
            <option value="referral">Referral</option>
            <option value="other">Other</option>
          </select>

          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              name="search" 
              placeholder="Search leads..." 
              value={filters.search} 
              onChange={handleFilterChange}
              className="border border-gray-300 rounded-md text-sm pl-9 p-2 min-w-[220px] focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
            />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-inner">
          <button 
            onClick={() => setActiveView('kanban')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeView === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Kanban
          </button>
          <button 
            onClick={() => setActiveView('list')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeView === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {loading && leads.length === 0 ? (
          <div className="p-6">
            <ContentLoader type={activeView === 'kanban' ? 'card' : 'table'} rows={activeView === 'kanban' ? 3 : 5} />
          </div>
        ) : activeView === 'kanban' ? (
          <KanbanBoard 
            stages={stages} 
            leads={leads} 
            onLeadClick={(lead) => setSelectedLeadId(lead.id)} 
            onStageChange={handleStageChange}
          />
        ) : (
          <div className="h-full overflow-auto p-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th onClick={() => handleSort('name')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Name {renderSortIcon('name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th onClick={() => handleSort('stage_id')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Stage {renderSortIcon('stage_id')}</th>
                    <th onClick={() => handleSort('assignee_name')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Assignee {renderSortIcon('assignee_name')}</th>
                    <th onClick={() => handleSort('score')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Score {renderSortIcon('score')}</th>
                    <th onClick={() => handleSort('source')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Source {renderSortIcon('source')}</th>
                    <th onClick={() => handleSort('created_at')} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors">Created {renderSortIcon('created_at')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map(lead => (
                    <tr 
                      key={lead.id} 
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">{lead.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{lead.phone || '-'}</div>
                        <div className="text-xs text-gray-500">{lead.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 inline-flex text-[10px] uppercase tracking-wider font-bold rounded-full border bg-gray-50 text-gray-800 border-gray-200 shadow-sm">
                          {lead.stage_name || 'No Stage'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                        {lead.assignee_name || 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium capitalize">
                        {lead.source || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '-'}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                        No leads found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-in Drawer */}
      <LeadDrawer 
        leadId={selectedLeadId} 
        isOpen={!!selectedLeadId} 
        onClose={() => setSelectedLeadId(null)} 
        onLeadUpdated={() => refetch()}
      />

      {/* New Lead Modal */}
      {isFormOpen && (
        <LeadForm 
          lead={null}
          onClose={() => setIsFormOpen(false)}
          onSave={() => {
            setIsFormOpen(false);
            refetch();
          }}
        />
      )}
      
    </div>
  );
}
