import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function BudgetPlanner({ leadId, lead }) {
  const toast = useToast();
  const [expectedBudget, setExpectedBudget] = useState(lead?.budget_max || '');
  const [loading, setLoading] = useState(false);
  const [varianceData, setVarianceData] = useState(null);

  const customerBudget = lead?.budget_max ? parseFloat(lead.budget_max) : 0;

  const analyzeBudget = async () => {
    if (!expectedBudget) {
      toast.error('Please enter the expected budget planner value.');
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.post(`/leads/${leadId}/budget-planner`, {
        expected_budget: expectedBudget
      });
      if (res.data.success) {
        setVarianceData(res.data.data);
        toast.success('Budget analysis complete');
      }
    } catch (e) {
      toast.error('Failed to analyze budget');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isOverBudget = varianceData && varianceData.variance > 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            AI Budget Planner
          </h3>
          <p className="text-sm text-gray-500">Compare customer budget against estimated scope.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Customer Budget (Max)</label>
            <div className="text-2xl font-bold text-gray-900 border-b-2 border-gray-100 pb-2">
              ₹{customerBudget.toLocaleString()}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Expected Budget (Planner Estimate)</label>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-gray-900">₹</span>
              <input 
                type="number"
                value={expectedBudget}
                onChange={(e) => setExpectedBudget(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-indigo-500 focus:outline-none pb-1 bg-transparent"
                placeholder="Enter estimate..."
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
          <div className="flex-1">
            {varianceData && (
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold uppercase px-3 py-1 rounded-full ${
                  isOverBudget ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {isOverBudget ? 'Over Budget' : 'Under Budget'}
                </span>
                <span className="text-gray-600 text-sm font-medium">
                  Variance: ₹{Math.abs(varianceData.variance).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={analyzeBudget}
            disabled={loading || !expectedBudget}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Analyzing...' : 'Analyze Variance'}
          </button>
        </div>
      </div>

      {varianceData && isOverBudget && (
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-5 border border-orange-100 shadow-sm">
          <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI Value-Engineering Recommendations
          </h4>
          <div className="space-y-3">
            {varianceData.recommendations?.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-md shadow-sm border border-orange-50">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {varianceData && !isOverBudget && (
        <div className="bg-green-50 rounded-lg p-5 border border-green-100 shadow-sm text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h4 className="text-lg font-bold text-green-800 mb-1">Budget Aligned!</h4>
          <p className="text-sm text-green-700">The expected scope fits comfortably within the customer's budget.</p>
        </div>
      )}
    </div>
  );
}
