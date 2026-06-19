import React, { useState } from 'react';

export default function DiscoveryCallChecklist({ lead, onUpdate }) {
  const [checklist, setChecklist] = useState({
    budget: !!lead?.budget_max,
    timeline: !!lead?.possession_date,
    propertyStatus: !!lead?.house_status,
    decisionMakers: false,
    stylePreference: !!lead?.interior_style,
    previousExperience: false,
    competitor: !!lead?.competitor_mentioned,
    loanStatus: !!lead?.loan_approved,
    priorityRooms: false,
  });

  const handleToggle = (key) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const calculateProgress = () => {
    const total = Object.keys(checklist).length;
    const completed = Object.values(checklist).filter(Boolean).length;
    return Math.round((completed / total) * 100);
  };

  const progress = calculateProgress();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          Discovery Call Checklist
        </h3>
        <span className="text-sm font-medium text-gray-600">{progress}% Complete</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
        <div 
          className={`h-2 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-300`} 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: 'budget', label: 'Budget Confirmed' },
          { key: 'timeline', label: 'Timeline & Possession Date' },
          { key: 'propertyStatus', label: 'Property Status (Built/Under Construction)' },
          { key: 'decisionMakers', label: 'All Decision Makers Identified' },
          { key: 'stylePreference', label: 'Style Preferences Discussed' },
          { key: 'previousExperience', label: 'Previous Interior Experience' },
          { key: 'competitor', label: 'Competitors Evaluated' },
          { key: 'loanStatus', label: 'Loan / Financing Status' },
          { key: 'priorityRooms', label: 'Priority Rooms Identified' },
        ].map((item) => (
          <label key={item.key} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-100 transition-colors">
            <div className="mt-0.5">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                checked={checklist[item.key]}
                onChange={() => handleToggle(item.key)}
              />
            </div>
            <span className={`text-sm ${checklist[item.key] ? 'text-gray-500 line-through' : 'text-gray-700 font-medium'}`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>

      {progress === 100 && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md border border-green-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <strong>Excellent!</strong> You are ready to schedule a site visit.
          </div>
          <button className="px-3 py-1 bg-green-600 text-white rounded shadow-sm hover:bg-green-700 transition-colors">
            Schedule Visit
          </button>
        </div>
      )}
    </div>
  );
}
