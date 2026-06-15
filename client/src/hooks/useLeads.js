import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getLeads, changeLeadStage } from '../api/leads';

export function useLeads(filters = {}) {
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
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

      const [leadsRes, stagesRes] = await Promise.all([
        getLeads(params),
        api.get('/config/lead-stages').catch(() => ({ data: { data: [] } }))
      ]);

      if (leadsRes.success) {
        let fetchedLeads = leadsRes.data;
        if (filters.sortBy) {
          fetchedLeads.sort((a, b) => {
            let valA = a[filters.sortBy];
            let valB = b[filters.sortBy];
            if (valA < valB) return filters.sortDesc ? 1 : -1;
            if (valA > valB) return filters.sortDesc ? -1 : 1;
            return 0;
          });
        }
        setLeads(fetchedLeads);
      }

      if (stagesRes.data?.success) {
        setStages(stagesRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Failed to fetch leads or stages');
    } finally {
      setLoading(false);
    }
  }, [filters.stageId, filters.assigneeId, filters.source, filters.search, filters.sortBy, filters.sortDesc]);

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

  const refetch = () => {
    return fetchLeadsAndStages();
  };

  return { leads, stages, loading, error, refetch, optimisticStageChange };
}
