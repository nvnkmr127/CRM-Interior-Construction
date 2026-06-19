import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function PredictiveRevenueWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/leads/manager/predictive-revenue');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load predictive revenue data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 bg-white rounded-lg shadow border border-gray-200 animate-pulse h-48"></div>;
  }

  const totalRevenue = data.reduce((sum, item) => sum + Number(item.expected_revenue), 0);
  const totalPipeline = data.reduce((sum, item) => sum + Number(item.total_pipeline), 0);

  return (
    <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm border border-indigo-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Predictive Revenue Engine
        </h3>
        <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">AI FORECAST</span>
      </div>

      <div className="flex flex-col gap-1 mb-6">
        <div className="text-xs text-gray-500 font-medium">Expected Weighted Revenue</div>
        <div className="text-3xl font-extrabold text-gray-900">
          ₹{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-xs font-semibold text-indigo-600 mt-1">
          From a total active pipeline of ₹{totalPipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-indigo-100 pb-1">Expected Revenue by Stage</h4>
        {data.length === 0 ? (
          <div className="text-xs text-gray-400 italic">No active pipeline data available.</div>
        ) : (
          data.map((stage, idx) => {
            const expected = Number(stage.expected_revenue);
            const percentage = totalRevenue > 0 ? (expected / totalRevenue) * 100 : 0;
            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-700">{stage.stage_name} <span className="text-gray-400">({stage.lead_count})</span></span>
                  <span className="text-gray-900 font-bold">₹{expected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="w-full bg-indigo-100 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
