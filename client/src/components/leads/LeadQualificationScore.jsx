import React from 'react';

export default function LeadQualificationScore({ lead }) {
  if (!lead) return null;

  const {
    win_probability = 0,
    revenue_potential,
    ai_score_breakdown = {}
  } = lead;

  const buyingIntent = ai_score_breakdown["Buying Intent"] || 0;
  const budgetConfidence = ai_score_breakdown["Budget Confidence"] || 0;
  
  const decisionComplexity = lead.decision_complexity || 'TBD';
  const urgency = lead.urgency || 'TBD';

  const getColorByScore = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getProgressColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm mb-4">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        AI Qualification Score
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {/* Win Probability */}
        <div className={`p-3 rounded-md border flex flex-col items-center justify-center text-center min-w-0 overflow-hidden break-words ${getColorByScore(win_probability)}`}>
          <span className="text-xs uppercase font-semibold opacity-80 mb-1 whitespace-normal break-words">Win Probability</span>
          <span className="text-2xl font-bold">{win_probability}%</span>
        </div>

        {/* Buying Intent */}
        <div className={`p-3 rounded-md border flex flex-col items-center justify-center text-center min-w-0 overflow-hidden break-words ${getColorByScore(buyingIntent)}`}>
          <span className="text-xs uppercase font-semibold opacity-80 mb-1 whitespace-normal break-words">Buying Intent</span>
          <span className="text-2xl font-bold">{buyingIntent}%</span>
        </div>

        {/* Budget Confidence */}
        <div className={`p-3 rounded-md border flex flex-col items-center justify-center text-center min-w-0 overflow-hidden break-words ${getColorByScore(budgetConfidence)}`}>
          <span className="text-xs uppercase font-semibold opacity-80 mb-1 whitespace-normal break-words leading-tight">Budget Confidence</span>
          <span className="text-2xl font-bold">{budgetConfidence}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase">Revenue Potential</span>
          <span className="text-lg font-semibold text-gray-800">{revenue_potential ? `₹${revenue_potential.toLocaleString()}` : 'TBD'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase">Urgency</span>
          <span className="text-lg font-semibold text-gray-800">{urgency}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase">Decision Complexity</span>
          <span className="text-lg font-semibold text-gray-800">{decisionComplexity}</span>
        </div>
      </div>
      
      {/* Visual bars */}
      <div className="mt-5 space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-gray-600">Buying Intent Profile</span>
            <span className="text-gray-500">{buyingIntent}/100</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${getProgressColor(buyingIntent)}`} style={{ width: `${buyingIntent}%` }}></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-gray-600">Budget Confidence</span>
            <span className="text-gray-500">{budgetConfidence}/100</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${getProgressColor(budgetConfidence)}`} style={{ width: `${budgetConfidence}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
