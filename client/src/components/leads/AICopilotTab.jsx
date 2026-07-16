/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AICopilotTab({ leadId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchInsights();
  }, [leadId]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${leadId}/ai-insights`);
      if (res.data.success) {
        setInsights(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to load AI Copilot insights');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-4xl animate-pulse">🤖</div>
        <p className="text-gray-500 font-medium">AI Copilot is analyzing the lead's timeline, preferences, and communications...</p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-6 text-center text-gray-500">
        Could not load AI Insights.
        <br />
        <Button variant="outline" size="sm" onClick={fetchInsights} className="mt-4">Retry</Button>
      </div>
    );
  }

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'bg-green-100 text-green-800 border-green-200';
      case 'negative': return 'bg-red-100 text-red-800 border-red-200';
      case 'at-risk': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🤖 AI Sales Copilot
          </h3>
          <p className="text-sm text-gray-500 mt-1">Real-time intelligence extracted from customer interactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchInsights}>
          🔄 Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Next Best Action */}
        <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-blue-800 font-semibold">
            <span>⚡</span> Recommended Next Action
          </div>
          <p className="text-gray-800 text-lg">
            {insights.nextAction}
          </p>
        </div>

        {/* Sentiment */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Overall Sentiment</h4>
          <div className={`inline-flex items-center px-4 py-2 rounded-full border text-lg font-medium ${getSentimentColor(insights.sentiment)}`}>
            {insights.sentiment}
          </div>
        </div>

        {/* Buying Signals */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>📈</span> Buying Signals
          </h4>
          {insights.signals && insights.signals.length > 0 ? (
            <ul className="space-y-3">
              {insights.signals.map((signal, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic">No strong buying signals detected yet.</p>
          )}
        </div>

        {/* Objections */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>🛡️</span> Detected Objections
          </h4>
          {insights.objections && insights.objections.length > 0 ? (
            <ul className="space-y-3">
              {insights.objections.map((objection, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <span>{objection}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic">No objections detected in the timeline.</p>
          )}
        </div>

      </div>
    </div>
  );
}
