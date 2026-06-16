import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function FunnelChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">No funnel data available for this period.</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { stage, count, drop_off_rate } = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md text-sm">
          <p className="font-bold capitalize mb-1">{stage.replace('_', ' ')}</p>
          <p>Leads: {count}</p>
          {drop_off_rate > 0 && <p className="text-red-500 font-medium mt-1">Drop-off: {drop_off_rate}%</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4">Pipeline Funnel</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tickFormatter={(v) => v.replace('_', ' ')} width={100} style={{ fontSize: '12px', textTransform: 'capitalize' }} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`hsl(210, 80%, ${80 - index * 6}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
