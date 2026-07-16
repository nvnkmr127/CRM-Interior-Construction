/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function HeatMapWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/leads/manager/heat-map');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load geographic pipeline data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 bg-white rounded-lg shadow border border-gray-200 animate-pulse h-48"></div>;
  }

  const maxPipeline = Math.max(...data.map(item => Number(item.total_pipeline)), 1); // Avoid division by zero

  return (
    <div className="p-5 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg shadow-sm border border-red-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-red-900 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          Geographic Pipeline Hotspots
        </h3>
        <span className="text-[10px] font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full">LIVE MAP</span>
      </div>

      <div className="space-y-4">
        {data.length === 0 ? (
          <div className="text-xs text-red-400 italic">No geographic data available. Add locations to leads.</div>
        ) : (
          data.map((region, idx) => {
            const pipeline = Number(region.total_pipeline);
            const percentage = (pipeline / maxPipeline) * 100;
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-24 shrink-0 truncate text-xs font-semibold text-gray-800" title={region.location}>
                  {region.location}
                </div>
                <div className="flex-1 bg-red-100 rounded-full h-3 flex items-center relative overflow-hidden group">
                  <div 
                    className="bg-gradient-to-r from-red-400 to-red-600 h-3 rounded-full transition-all duration-500 ease-in-out" 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <div className="text-xs font-bold text-gray-900">₹{pipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="text-[10px] text-gray-500">{region.lead_count} leads • {region.hot_leads} 🔥</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
