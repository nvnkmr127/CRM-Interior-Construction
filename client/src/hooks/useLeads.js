import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLeads, changeLeadStage, bulkChangeLeadStage } from '../api/leads';

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

      if (leadsRes.success) {
        let fetchedLeads = Array.isArray(leadsRes.data) ? leadsRes.data : Array.isArray(leadsRes.results) ? leadsRes.results : [];
        if (leadsRes.pagination) {
          setTotal(leadsRes.pagination.total || 0);
        } else if (leadsRes.total !== undefined) {
          setTotal(leadsRes.total);
        } else {
          setTotal(fetchedLeads.length);
        }

        setLeads(fetchedLeads);
      }

      if (stagesRes.data?.success) {
        setStages(stagesRes.data.data);
      }
      
      if (statsRes.data?.success) {
        setStats(statsRes.data.data || { total: 0, wonThisMonth: 0, avgScore: 0, convPct: 0 });
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Failed to fetch leads or stages');
    } finally {
      setLoading(false);
    }
  }, [filters.stageId, filters.assigneeId, filters.source, filters.search, filters.sortBy, filters.sortDesc, filters.page, filters.limit]);

  useEffect(() => {
    fetchLeadsAndStages();
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

  const refetch = () => {
    return fetchLeadsAndStages();
  };

  return { leads, stages, stats, total, loading, error, refetch, optimisticStageChange, bulkChangeStage };
}
