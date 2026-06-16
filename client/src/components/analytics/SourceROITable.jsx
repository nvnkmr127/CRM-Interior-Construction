import React from 'react';

export default function SourceROITable({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">No source data available for this period.</div>;
  }

  const handleDownload = () => {
    const headers = ['Source', 'Total Leads', 'Won Leads', 'Conversion %', 'Total Value'];
    const csvContent = [
      headers.join(','),
      ...data.map(r => `${r.source || 'Unknown'},${r.count},${r.won_count},${r.conversion_rate},${r.total_value}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `source_roi_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Source ROI</h3>
        <button onClick={handleDownload} className="text-xs text-blue-600 font-medium hover:underline">Download CSV</button>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium text-right">Leads</th>
              <th className="px-4 py-3 font-medium text-right">Won</th>
              <th className="px-4 py-3 font-medium text-right">Conv %</th>
              <th className="px-4 py-3 font-medium text-right">Pipeline Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 capitalize">{row.source?.replace('_', ' ') || 'Unknown'}</td>
                <td className="px-4 py-3 text-right">{row.count}</td>
                <td className="px-4 py-3 text-right text-green-600 font-medium">{row.won_count}</td>
                <td className="px-4 py-3 text-right">{row.conversion_rate}%</td>
                <td className="px-4 py-3 text-right">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(row.total_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
