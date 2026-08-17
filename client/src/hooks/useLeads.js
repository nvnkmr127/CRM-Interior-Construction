/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLeads, changeLeadStage, bulkChangeLeadStage, bulkDeleteLeads } from '../api/leads';

export function useLeads(filters = {}) {
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, wonThisMonth: 0, avgScore: 0, convPct: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeadsAndStages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters };
      if (!params.stageId) delete params.stageId;
      if (!params.assigneeId) delete params.assigneeId;
      if (!params.source) delete params.source;
      if (!params.search) delete params.search;

      const [leadsRes, stagesRes, statsRes] = await Promise.all([
        getLeads(params),
        api.get('/config/lead-stages').catch(() => ({ data: { data: [] } })),
        api.get('/leads/stats').catch(() => ({ data: { data: { total: 0, wonThisMonth: 0, avgScore: 0, convPct: 0 } } }))
      ]);

      if (stagesRes.data?.success) {
        setStages(stagesRes.data.data);
      }
      const fetchedStages = stagesRes.data?.data || [];

      let isMockData = false;
      let fetchedLeads = [];

      if (leadsRes.success) {
        fetchedLeads = Array.isArray(leadsRes.data) ? leadsRes.data : Array.isArray(leadsRes.results) ? leadsRes.results : [];
        
        // Inject mock data if no leads exist and no filters are applied
        // REMOVED: User requested to fix unexpected leads appearing. We no longer inject hardcoded leads.

        let tempTotal = 0;
        if (!isMockData && leadsRes.pagination) {
          tempTotal = leadsRes.pagination.total || 0;
        } else if (!isMockData && leadsRes.meta?.total !== undefined) {
          tempTotal = leadsRes.meta.total;
        } else if (!isMockData && leadsRes.total !== undefined) {
          tempTotal = leadsRes.total;
        } else {
          tempTotal = fetchedLeads.length;
        }
        setTotal(tempTotal);
        var leadsListTotal = tempTotal; // Defined globally inside the function

        setLeads(fetchedLeads);
      }
      
      if (statsRes.data?.success) {
        if (isMockData) {
          setStats({ total: fetchedLeads.length, wonThisMonth: 1, avgScore: 72, convPct: 20 });
        } else {
          setStats(statsRes.data.data || { total: fetchedLeads.length, wonThisMonth: 0, avgScore: 0, convPct: 0 });
        }
      } else {
        // If /leads/stats API fails (catch block returns statsRes.data without success=true)
        if (isMockData) {
          setStats({ total: fetchedLeads.length, wonThisMonth: 1, avgScore: 72, convPct: 20 });
        } else {
          setStats({ total: leadsListTotal, wonThisMonth: 0, avgScore: 0, convPct: 0 });
        }
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch leads or stages');
    } finally {
      setLoading(false);
    }
  }, [
    filters.stageId,
    filters.assigneeId,
    filters.source,
    filters.search,
    filters.intent,
    filters.sortBy,
    filters.sortDesc,
    filters.page,
    filters.limit,
    filters.scoreRange,
    filters.createdFrom,
    filters.createdTo,
    filters.deletedOnly,
    filters.status
  ]);

  useEffect(() => {
    fetchLeadsAndStages();
    
    // Listen for cross-browser mock DB changes to keep UI instantly synced
    const handleDbChange = () => fetchLeadsAndStages();
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, [fetchLeadsAndStages]);

  const optimisticStageChange = async (leadId, newStageId) => {
    const previousLeads = [...leads];
    
    // 1. Optimistic UI update
    setLeads(prev => prev.map(lead => {
      if (lead.id === leadId) {
        // We also need to map the stage_name if possible. We can find it from the stages array.
        const targetStage = stages.find(s => s.id === newStageId);
        return { 
          ...lead, 
          stage_id: newStageId,
          stage_name: targetStage ? targetStage.name : lead.stage_name
        };
      }
      return lead;
    }));

    // 2. Call API
    try {
      await changeLeadStage(leadId, newStageId);
    } catch (err) {
      // 3. Revert on error
      setLeads(previousLeads);
      throw err;
    }
  };

  const bulkChangeStage = async (leadIds, newStageId) => {
    const previousLeads = [...leads];
    
    // 1. Optimistic UI update
    setLeads(prev => prev.map(lead => {
      if (leadIds.includes(lead.id)) {
        const targetStage = stages.find(s => s.id === newStageId);
        return { 
          ...lead, 
          stage_id: newStageId,
          stage_name: targetStage ? targetStage.name : lead.stage_name
        };
      }
      return lead;
    }));

    // 2. Call API
    try {
      await bulkChangeLeadStage(leadIds, newStageId);
    } catch (err) {
      // 3. Revert on error
      setLeads(previousLeads);
      throw err;
    }
  };

  const bulkDelete = async (leadIds) => {
    // 1. Optimistic UI update
    const previousLeads = [...leads];
    setLeads(prev => prev.filter(lead => !leadIds.includes(lead.id)));
    
    // 2. Call API
    try {
        await bulkDeleteLeads(leadIds);
    } catch (err) {
      // 3. Revert on error
      setLeads(previousLeads);
      throw err;
    }
  };

  const refetch = () => {
    return fetchLeadsAndStages();
  };

  return { leads, stages, stats, total, loading, error, refetch, optimisticStageChange, bulkChangeStage, bulkDelete };
}
