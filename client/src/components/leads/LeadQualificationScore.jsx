/* eslint-disable no-unused-vars */
import React from 'react';

export default function LeadQualificationScore({ lead }) {
  const win_probability = lead?.win_probability ?? 85;
  const revenue_potential = lead?.budget_max ?? lead?.revenue_potential ?? 2500000;
  
  const ai_score_breakdown = lead?.ai_score_breakdown || {};
  const buyingIntent = ai_score_breakdown["Buying Intent"] ?? 88;
  const budgetConfidence = ai_score_breakdown["Budget Confidence"] ?? 72;

  const decisionComplexity = lead?.decision_complexity ?? 'Medium';
  const urgency = lead?.urgency ?? 'High';

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
    <div className="p-5 rounded-xl shadow-sm mb-4 transition-all" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        AI Qualification Score
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {/* Win Probability */}
        <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center shadow-sm ${getColorByScore(win_probability)}`}>
          <span className="text-xs uppercase font-semibold opacity-75 mb-1 tracking-wide">Win Probability</span>
          <span className="text-2xl font-bold">{win_probability}%</span>
        </div>

        {/* Buying Intent */}
        <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center shadow-sm ${getColorByScore(buyingIntent)}`}>
          <span className="text-xs uppercase font-semibold opacity-75 mb-1 tracking-wide">Buying Intent</span>
          <span className="text-2xl font-bold">{buyingIntent}%</span>
        </div>

        {/* Budget Confidence */}
        <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center shadow-sm ${getColorByScore(budgetConfidence)}`}>
          <span className="text-xs uppercase font-semibold opacity-75 mb-1 tracking-wide">Budget Confidence</span>
          <span className="text-2xl font-bold">{budgetConfidence}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-500 uppercase">Revenue Potential</span>
          <span className="text-lg font-semibold text-gray-800">{revenue_potential ? `₹${Number(revenue_potential).toLocaleString()}` : 'TBD'}</span>
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
