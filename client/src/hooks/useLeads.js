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

      if (leadsRes.success) {
        let fetchedLeads = Array.isArray(leadsRes.data) ? leadsRes.data : Array.isArray(leadsRes.results) ? leadsRes.results : [];
        
        // Inject mock data if no leads exist
        if (fetchedLeads.length === 0) {
          const s1 = fetchedStages[0]?.id || '1';
          const s2 = fetchedStages[1]?.id || fetchedStages[0]?.id || '2';
          const s3 = fetchedStages[2]?.id || fetchedStages[1]?.id || '3';
          
          fetchedLeads = [
            { id: 'mock-1', name: 'Acme Corp Redevelopment', email: 'contact@acmecorp.com', phone: '555-0101', source: 'Website', companyName: 'Acme Corp', score: 85, intent: 'High', status: 'New', stageId: s1, createdAt: new Date(Date.now() - 86400000).toISOString() },
            { id: 'mock-2', name: 'TechNova Office Build', email: 'facilities@technova.io', phone: '555-0202', source: 'Referral', companyName: 'TechNova', score: 65, intent: 'Medium', status: 'Contacted', stageId: s2, createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
            { id: 'mock-3', name: 'Vertex Retail Expansion', email: 'expansion@vertex.net', phone: '555-0303', source: 'Cold Call', companyName: 'Vertex', score: 92, intent: 'High', status: 'Qualified', stageId: s3, createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
            { id: 'mock-4', name: 'Nexus HQ Renovation', email: 'admin@nexus.co', phone: '555-0404', source: 'Event', companyName: 'Nexus', score: 40, intent: 'Low', status: 'New', stageId: s1, createdAt: new Date(Date.now() - 86400000 * 12).toISOString() },
            { id: 'mock-5', name: 'Stark Industries Fitout', email: 'tony@stark.com', phone: '555-0505', source: 'Website', companyName: 'Stark Ind.', score: 78, intent: 'High', status: 'Contacted', stageId: s2, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() }
          ];
        }

        if (leadsRes.pagination) {
          setTotal(leadsRes.pagination.total || 0);
        } else if (leadsRes.meta?.total !== undefined) {
          setTotal(leadsRes.meta.total);
        } else if (leadsRes.total !== undefined) {
          setTotal(leadsRes.total);
        } else {
          setTotal(fetchedLeads.length);
        }

        setLeads(fetchedLeads);
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
    filters.createdTo
  ]);

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
