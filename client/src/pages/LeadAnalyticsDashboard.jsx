import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import PeriodSelector from '../components/analytics/PeriodSelector';
import StatsBar from '../components/analytics/StatsBar';
import FunnelChart from '../components/analytics/FunnelChart';
import SourceROITable from '../components/analytics/SourceROITable';
import RepLeaderboard from '../components/analytics/RepLeaderboard';
import LostReasonsChart from '../components/analytics/LostReasonsChart';
import styles from './LeadAnalyticsDashboard.module.css';

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
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Lead Analytics</h1>
          <p className={styles.subtitle}>Measure pipeline health and rep performance</p>
        </div>
        <PeriodSelector period={period} setPeriod={setPeriod} />
      </div>

      {loading ? (
        <div className={styles.pulse}>
          <div className={styles.skeletonHeader}></div>
          <div className={styles.grid}>
             <div className={styles.skeletonChart}></div>
             <div className={styles.skeletonChart}></div>
          </div>
        </div>
      ) : (
        <>
          <StatsBar data={data.summary} />
          
          <div className={styles.grid}>
            <FunnelChart data={data.funnel} />
            <LostReasonsChart data={data.lost} />
          </div>

          <div className={styles.grid}>
            <SourceROITable data={data.sources} />
            <RepLeaderboard data={data.reps} />
          </div>
        </>
      )}
    </div>
  );
}
