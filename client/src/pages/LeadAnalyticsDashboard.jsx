import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import PeriodSelector from '../components/analytics/PeriodSelector';
import StatsBar from '../components/analytics/StatsBar';
import FunnelChart from '../components/analytics/FunnelChart';
import SourceROITable from '../components/analytics/SourceROITable';
import RepLeaderboard from '../components/analytics/RepLeaderboard';
import LostReasonsChart from '../components/analytics/LostReasonsChart';

export default function LeadAnalyticsDashboard() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: null,
    funnel: null,
    sources: null,
    reps: null,
    lost: null
  });

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sumRes, funRes, srcRes, repRes, lostRes] = await Promise.all([
          api.get(`/analytics/leads/summary?period=${period}`),
          api.get(`/analytics/leads/funnel?period=${period}`),
          api.get(`/analytics/leads/by_source?period=${period}`),
          api.get(`/analytics/leads/rep_performance?period=${period}`),
          api.get(`/analytics/leads/lost_reasons?period=${period}`)
        ]);

        if (isMounted) {
          setData({
            summary: sumRes.data?.data,
            funnel: funRes.data?.data,
            sources: srcRes.data?.data,
            reps: repRes.data?.data,
            lost: lostRes.data?.data
          });
        }
      } catch (e) {
        console.error('Failed to fetch analytics', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchData();
    return () => { isMounted = false; };
  }, [period]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lead Analytics</h1>
          <p className="text-gray-500 mt-1">Measure pipeline health and rep performance</p>
        </div>
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="h-64 bg-gray-200 rounded-lg"></div>
             <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      ) : (
        <>
          <StatsBar data={data.summary} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FunnelChart data={data.funnel} />
            <LostReasonsChart data={data.lost} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SourceROITable data={data.sources} />
            <RepLeaderboard data={data.reps} />
          </div>
        </>
      )}
    </div>
  );
}
