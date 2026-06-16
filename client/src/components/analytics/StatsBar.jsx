import React from 'react';

export default function StatsBar({ data }) {
  if (!data) return <div className="animate-pulse flex gap-4 h-24 mb-6"><div className="flex-1 bg-gray-200 rounded-lg"></div></div>;

  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.pipeline_value_total || 0);

  const metrics = [
    { label: 'Total Leads', value: data.total_leads, subtext: `${data.new_this_period} new this period` },
    { label: 'Conversion Rate', value: `${data.conversion_rate}%`, subtext: 'Won / Total' },
    { label: 'Pipeline Value', value: formattedValue, subtext: 'Total budget max' },
    { label: 'Avg Days to Close', value: `${data.avg_time_to_close_days}d`, subtext: 'For won leads' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, i) => (
        <div key={i} className="bg-white p-5 rounded-lg border shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-1">{m.label}</p>
          <h3 className="text-2xl font-bold text-gray-900">{m.value}</h3>
          <p className="text-xs text-gray-400 mt-1">{m.subtext}</p>
        </div>
      ))}
    </div>
  );
}
