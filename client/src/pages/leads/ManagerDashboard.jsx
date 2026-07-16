/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { Button, Badge, Modal } from '../../components/ui';
import PredictiveRevenueWidget from '../../components/leads/PredictiveRevenueWidget';
import HeatMapWidget from '../../components/leads/HeatMapWidget';

export default function ManagerDashboard() {
  const [slaBreaches, setSlaBreaches] = useState([]);
  const [pipelineMovement, setPipelineMovement] = useState([]);
  const [repCapacity, setRepCapacity] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState({});
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [scheduledVisits, setScheduledVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [slaRes, pipeRes, repRes, scoreRes, appRes, visitRes] = await Promise.all([
        api.get('/leads/manager/sla-breaches'),
        api.get('/leads/manager/pipeline-movement'),
        api.get('/leads/manager/rep-capacity'),
        api.get('/leads/manager/score-distribution'),
        api.get('/leads/manager/pending-approvals'),
        api.get('/leads/manager/scheduled-visits')
      ]);
      setSlaBreaches(slaRes.data?.data || []);
      setPipelineMovement(pipeRes.data?.data || []);
      setRepCapacity(repRes.data?.data || []);
      setScoreDistribution(scoreRes.data?.data || {});
      setPendingApprovals(appRes.data?.data || []);
      setScheduledVisits(visitRes.data?.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("You do not have manager permissions.");
        navigate('/leads');
      } else {
        toast.error('Failed to load real-time dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id, status) => {
    if (!window.confirm(`Are you sure you want to ${status} this discount?`)) return;
    try {
      await api.post(`/leads/manager/approvals/${id}/decide`, { status });
      toast.success(`Discount ${status} successfully.`);
      fetchDashboardData();
    } catch (err) {
      toast.error(`Failed to ${status} discount`);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center text-gray-500">Loading live ops view...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Ops View</h1>
          <p className="text-sm text-gray-500">Live operational snapshot</p>
        </div>
        <div className="text-xs font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Live Sync Active
        </div>
      </div>

      {/* SECTION 0: PREDICTIVE REVENUE & HEAT MAP */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PredictiveRevenueWidget />
        <HeatMapWidget />
      </section>

      {/* SECTION 1: SLA BREACHES */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          🚨 Critical SLA Breaches
          <Badge variant="danger">{slaBreaches.length}</Badge>
        </h2>
        {slaBreaches.length === 0 ? (
          <div className="bg-white p-4 rounded-lg shadow-sm text-sm text-gray-500 border border-gray-100">All SLAs met. Great job team!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slaBreaches.map(b => (
              <div key={b.id} className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-900">{b.name}</span>
                  <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">{b.hours_overdue}h Overdue</span>
                </div>
                <div className="text-sm text-gray-600 mb-1"><span className="font-medium text-gray-700">Breach:</span> {b.breach_type}</div>
                <div className="text-sm text-gray-600 mb-3"><span className="font-medium text-gray-700">Rep:</span> {b.rep_name || 'Unassigned'}</div>
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-100">Reassign Lead</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KPIs & SCORE DISTRIBUTION */}
      <section className="grid grid-cols-4 gap-4">
        {[
          { label: 'Hot Leads', count: scoreDistribution.hot || 0, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Warm Leads', count: scoreDistribution.warm || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cold Leads', count: scoreDistribution.cold || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Dead Leads', count: scoreDistribution.dead || 0, color: 'text-gray-600', bg: 'bg-gray-100' }
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all ${kpi.bg}`}>
            <div className="text-sm font-medium text-gray-600">{kpi.label}</div>
            <div className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.count}</div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 3: REP CAPACITY HEATMAP */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Rep Capacity Heatmap</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y overflow-hidden">
            <div className="grid grid-cols-4 p-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <div className="col-span-2">Sales Rep</div>
              <div className="text-center">Active Load</div>
              <div className="text-center">Contacted Today</div>
            </div>
            {repCapacity.map(rep => {
              const loadColor = rep.active_leads > 35 ? 'text-red-600 bg-red-100' : rep.active_leads >= 20 ? 'text-amber-600 bg-amber-100' : 'text-green-600 bg-green-100';
              return (
                <div key={rep.rep_id} className="grid grid-cols-4 p-3 items-center hover:bg-gray-50 transition-colors">
                  <div className="col-span-2 flex items-center gap-3">
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{rep.rep_name?.[0]}</div>
                    )}
                    <span className="font-medium text-sm text-gray-900">{rep.rep_name}</span>
                  </div>
                  <div className="text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${loadColor}`}>{rep.active_leads}</span>
                  </div>
                  <div className="text-center text-sm font-medium text-gray-600">{rep.contacted_today}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 5: DISCOUNT QUEUE */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Discount Approval Queue</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {pendingApprovals.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No pending approvals.</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Lead & Rep</th>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingApprovals.map(req => (
                    <tr key={req.id}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{req.lead_name}</div>
                        <div className="text-gray-500 text-xs">{req.rep_name}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-gray-900 font-medium">{req.discount_percent}% off</div>
                        <div className="text-gray-500 text-xs">₹{req.original_amount}</div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleApproval(req.id, 'rejected')} className="text-red-600 hover:bg-red-50">Reject</Button>
                        <Button variant="primary" size="sm" onClick={() => handleApproval(req.id, 'approved')} className="bg-green-600 hover:bg-green-700">Approve</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 6: TODAY'S VISITS */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Scheduled Visits</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y overflow-hidden">
            {scheduledVisits.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No visits scheduled today.</div>
            ) : (
              scheduledVisits.map(v => (
                <div key={v.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{v.lead_name}</div>
                    <div className="text-gray-500 text-xs">{v.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">{new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <div className="text-xs text-gray-500">{v.rep_name}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* SECTION 2: PIPELINE MOVEMENT */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Today's Pipeline Movement</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 max-h-96 overflow-y-auto">
            {pipelineMovement.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No stage transitions today yet.</div>
            ) : (
              <div className="relative pl-4 border-l-2 border-blue-100 space-y-6">
                {pipelineMovement.map(p => (
                  <div key={p.id} className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white"></span>
                    <div className="text-sm font-medium text-gray-900">{p.lead_name}</div>
                    <div className="text-sm text-gray-600">{p.transition}</div>
                    <div className="text-xs text-gray-400 mt-1">{p.rep_name} • {new Date(p.created_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
