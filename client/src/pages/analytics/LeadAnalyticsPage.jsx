import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
  PieChart, Pie, Cell as PieCell, Legend,
  LineChart, Line 
} from 'recharts';
import { format, subDays, startOfYear, parseISO } from 'date-fns';
import api from '../../api/axios';
import Skeleton from '../../components/ui/Skeleton';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#a4de6c'];

export default function LeadAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });

  useEffect(() => {
    fetchData();
  }, [dateRange, customRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let from = '';
      let to = new Date().toISOString();

      if (dateRange === '30d') {
        from = subDays(new Date(), 30).toISOString();
      } else if (dateRange === '90d') {
        from = subDays(new Date(), 90).toISOString();
      } else if (dateRange === 'year') {
        from = startOfYear(new Date()).toISOString();
      } else if (dateRange === 'custom') {
        from = customRange.from ? new Date(customRange.from).toISOString() : '';
        to = customRange.to ? new Date(customRange.to).toISOString() : '';
      }

      const params = {};
      if (from) params.from = from;
      if (to && dateRange !== 'custom' || customRange.to) params.to = to;

      const res = await api.get('/analytics/leads', { params });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch lead analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const getGradientColor = (index, total) => {
    // gray to green gradient based on index/total ratio
    const ratio = total > 1 ? index / (total - 1) : 1;
    // Gray: rgb(156, 163, 175) -> Green: rgb(34, 197, 94)
    const r = Math.round(156 + (34 - 156) * ratio);
    const g = Math.round(163 + (197 - 163) * ratio);
    const b = Math.round(175 + (94 - 175) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatWeek = (isoString) => {
    if (!isoString) return '';
    return format(parseISO(isoString), 'MMM d');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Analytics</h1>
          <p className="text-sm text-gray-500">Monitor lead conversion, sources, and team performance.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-md border border-gray-300 p-2 text-sm bg-white"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={customRange.from} 
                onChange={e => setCustomRange(p => ({ ...p, from: e.target.value }))}
                className="rounded-md border border-gray-300 p-2 text-sm"
              />
              <span className="text-gray-500">to</span>
              <input 
                type="date" 
                value={customRange.to} 
                onChange={e => setCustomRange(p => ({ ...p, to: e.target.value }))}
                className="rounded-md border border-gray-300 p-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Funnel by Stage */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Lead Funnel by Stage</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.stageDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="stageName" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: '#f3f4f6'}} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.stageDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getGradientColor(index, data.stageDistribution.length)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Source Pie Chart */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Lead Sources</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.sourceBreakdown}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                    >
                      {data.sourceBreakdown.map((entry, index) => (
                        <PieCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Leads Trend */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Leads Trend (Weekly)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeSeries} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="week" 
                      tickFormatter={formatWeek}
                      tick={{fontSize: 12}}
                      minTickGap={20}
                    />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip 
                      labelFormatter={formatWeek}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="count" name="Created" stroke="#8884d8" strokeWidth={3} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="wonCount" name="Won" stroke="#22c55e" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>

          {/* Chart 4: Team Performance Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
            <div className="p-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Team Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-5">Name</th>
                    <th className="py-3 px-5 text-right">Leads Assigned</th>
                    <th className="py-3 px-5 text-right">Won</th>
                    <th className="py-3 px-5 text-right">Conversion %</th>
                    <th className="py-3 px-5 text-right">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.teamPerformance.map((user) => {
                    const conversionRate = user.totalLeads > 0 
                      ? Math.round((user.wonLeads / user.totalLeads) * 100) 
                      : 0;
                    return (
                      <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-5 font-medium text-gray-900">{user.name}</td>
                        <td className="py-3 px-5 text-right">{user.totalLeads}</td>
                        <td className="py-3 px-5 text-right text-green-600 font-medium">{user.wonLeads}</td>
                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{width: `${conversionRate}%`}}></div>
                            </div>
                            <span className="w-8 text-right">{conversionRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right text-gray-500">{user.avgScore}</td>
                      </tr>
                    );
                  })}
                  {data.teamPerformance.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-400">No performance data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">No data found.</div>
      )}
    </div>
  );
}
