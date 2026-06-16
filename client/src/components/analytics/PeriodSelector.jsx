import React from 'react';

export default function PeriodSelector({ period, setPeriod }) {
  const periods = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' }
  ];

  return (
    <div className="flex gap-2">
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            period === p.value 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
