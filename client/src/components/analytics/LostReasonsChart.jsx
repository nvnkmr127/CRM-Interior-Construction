import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function LostReasonsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">No lost reasons recorded for this period.</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { reason, count, percentage } = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md text-sm">
          <p className="font-bold capitalize mb-1">{reason.replace('_', ' ')}</p>
          <p>Count: {count}</p>
          <p className="text-gray-500 text-xs mt-1">{percentage}% of lost leads</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4">Lost Reasons Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="reason" type="category" axisLine={false} tickLine={false} tickFormatter={(v) => v.replace('_', ' ')} width={100} style={{ fontSize: '12px', textTransform: 'capitalize' }} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#f87171" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
