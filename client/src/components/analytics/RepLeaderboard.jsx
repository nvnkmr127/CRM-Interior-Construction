import React from 'react';

export default function RepLeaderboard({ data }) {
  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">No rep performance data available for this period.</div>;
  }

  const maxWon = Math.max(...data.map(d => d.won));

  const handleDownload = () => {
    const headers = ['Rep Name', 'Assigned', 'Won', 'Conv %', 'SLA Met', 'Visits', 'Proposals'];
    const csvContent = [
      headers.join(','),
      ...data.map(r => `${r.rep_name},${r.leads_assigned},${r.won},${r.conversion_rate},${r.contacted_within_sla},${r.visits_done},${r.proposals_sent}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rep_leaderboard_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Rep Leaderboard</h3>
        <button onClick={handleDownload} className="text-xs text-blue-600 font-medium hover:underline">Download CSV</button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        {data.map((rep, index) => {
          const isTop = index === 0 && rep.won > 0;
          return (
            <div key={rep.rep_id} className={`p-3 rounded-lg border ${isTop ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt={rep.rep_name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {(rep.rep_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isTop && <span className="absolute -top-1 -right-1 text-xs" title="Top Performer">👑</span>}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{rep.rep_name}</h4>
                    <p className="text-xs text-gray-500">{rep.leads_assigned} assigned • {rep.contacted_within_sla} SLA met</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{rep.won} Won</p>
                  <p className="text-xs text-green-600 font-medium">{rep.conversion_rate}% Conv</p>
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div 
                  className={`h-1.5 rounded-full ${isTop ? 'bg-yellow-400' : 'bg-blue-500'}`} 
                  style={{ width: `${maxWon > 0 ? (rep.won / maxWon) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between mt-2 text-[10px] text-gray-400 uppercase font-semibold">
                <span>{rep.visits_done} Visits</span>
                <span>{rep.proposals_sent} Proposals</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
