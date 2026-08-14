/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AICopilotTab({ leadId, onRefresh }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchInsights(false);
  }, [leadId]);

  const fetchInsights = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await api.get(`/leads/${leadId}/ai-insights`);
      if (res.data.success) {
        setInsights(res.data.data);
        if (isManualRefresh && onRefresh) {
          onRefresh(false);
        }
      }
    } catch (e) {
      toast.error('Failed to load AI Copilot insights');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center space-y-6 animate-pulse">
        <div className="text-6xl filter drop-shadow-[0_0_15px_rgba(170,59,255,0.4)]">🤖</div>
        <div className="space-y-2">
          <p className="text-gray-900 font-bold text-lg">AI Sales Copilot</p>
          <p className="text-gray-500 max-w-sm text-sm">Analyzing lead timeline, communications, sentiment, and preferences...</p>
        </div>
        <div className="flex gap-2 justify-center">
          <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-12 text-center bg-red-50/50 border border-red-100 rounded-2xl">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-800 font-semibold">Could not load AI Insights.</p>
        <p className="text-red-500 text-sm mt-1">Make sure you have active communications or notes logged for this lead.</p>
        <Button variant="outline" size="sm" onClick={() => fetchInsights(true)} className="mt-4 border-red-200 text-red-700 hover:bg-red-50">
          Retry Analysis
        </Button>
      </div>
    );
  }

  const getSentimentStyle = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return {
          badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
          gradient: 'from-emerald-500/5 to-teal-500/5 border-emerald-500/10',
          icon: '🟢',
          glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
        };
      case 'negative':
        return {
          badge: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
          gradient: 'from-rose-500/5 to-red-500/5 border-rose-500/10',
          icon: '🔴',
          glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]'
        };
      case 'at-risk':
        return {
          badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
          gradient: 'from-amber-500/5 to-orange-500/5 border-amber-500/10',
          icon: '🟡',
          glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]'
        };
      default:
        return {
          badge: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
          gradient: 'from-gray-500/5 to-slate-500/5 border-gray-500/10',
          icon: '⚪',
          glow: 'shadow-none'
        };
    }
  };

  const currentStyle = getSentimentStyle(insights.sentiment);
  const winProb = insights.winProbability || 80;

  return (
    <div className="p-6 space-y-8 animate-fadeIn text-sm">
      {/* Header section with glassmorphism */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border border-white/20 bg-white/40 backdrop-blur-xl p-5 rounded-2xl shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <span className="text-2xl filter drop-shadow-[0_2px_5px_rgba(170,59,255,0.3)]">🤖</span>
            AI Sales Copilot
            <span className="text-xs font-semibold px-2 py-0.5 bg-purple-500/10 text-purple-700 border border-purple-200/50 rounded-full">v2.0 Beta</span>
          </h3>
          <p className="text-gray-500 mt-1">Real-time intelligence and recommendation engine based on customer interactions</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchInsights(true)}
          disabled={refreshing}
          className="border-purple-200 hover:border-purple-400 text-purple-700 font-semibold bg-white/60 hover:bg-purple-50 shadow-sm transition-all duration-300 flex items-center gap-2 cursor-pointer h-9 px-4 rounded-xl"
        >
          <span className={`transition-transform duration-700 ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
          {refreshing ? 'Analyzing...' : 'Refresh Insights'}
        </Button>
      </div>

      {/* Grid: Main Recommendation & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Next Best Action Card (2/3 width) */}
        <div className="lg:col-span-2 relative group overflow-hidden bg-gradient-to-br from-indigo-900 to-purple-950 border border-purple-500/30 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500 pointer-events-none"></div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-300 font-bold uppercase tracking-wider text-xs">
              <span className="bg-purple-500/30 p-1.5 rounded-lg">⚡</span> Recommended Next Action
            </div>
            <p className="text-white text-lg font-bold leading-relaxed">
              {insights.nextAction || 'Schedule a discovery call to align requirements.'}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-purple-300/80">
            <span>Powered by CRM Agent Core</span>
            <span>Suggested: {insights.suggestedFollowupDate ? new Date(insights.suggestedFollowupDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : 'ASAP'}</span>
          </div>
        </div>

        {/* Sentiment Indicator (1/3 width) */}
        <div className={`bg-gradient-to-br ${currentStyle.gradient} border ${currentStyle.glow} rounded-2xl p-6 flex flex-col justify-between transition-all duration-300`}>
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Overall Sentiment</h4>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{currentStyle.icon}</div>
              <div>
                <span className={`inline-block px-3 py-1 rounded-full border text-sm font-bold shadow-sm ${currentStyle.badge}`}>
                  {insights.sentiment || 'Neutral'}
                </span>
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Derived from whatsapp & logs</p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 italic bg-white/40 p-2.5 rounded-xl border border-white/50">
            {insights.sentiment?.toLowerCase() === 'positive' && "Customer is highly engaged and eager for designs."}
            {insights.sentiment?.toLowerCase() === 'negative' && "Follow up immediately to resolve concerns."}
            {insights.sentiment?.toLowerCase() === 'at-risk' && "Competitor mentions detected. Handle with care."}
            {(!insights.sentiment || insights.sentiment?.toLowerCase() === 'neutral') && "Neutral interest. Keep sharing references."}
          </div>
        </div>

      </div>

      {/* Grid: Signals & Objections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Buying Signals */}
        <div className="bg-white/50 border border-gray-200/80 rounded-2xl p-6 shadow-sm hover:shadow transition-all duration-300">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600">📈</span> 
              Buying Signals
            </h4>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
              {insights.signals?.length || 0} Detected
            </Badge>
          </div>
          
          {insights.signals && insights.signals.length > 0 ? (
            <ul className="space-y-3.5">
              {insights.signals.map((signal, idx) => (
                <li key={idx} className="flex items-start gap-3 text-gray-700 hover:text-gray-900 group">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100/80 text-emerald-600 font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">✓</span>
                  <span className="text-sm font-medium leading-relaxed">{signal}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-gray-400 italic">
              <div className="text-2xl mb-2">🔍</div>
              No strong buying signals detected yet. Share catalogs or pricing to warm up the lead.
            </div>
          )}
        </div>

        {/* Objections */}
        <div className="bg-white/50 border border-gray-200/80 rounded-2xl p-6 shadow-sm hover:shadow transition-all duration-300">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="bg-rose-50 p-1.5 rounded-lg text-rose-600">🛡️</span> 
              Key Objections
            </h4>
            <Badge variant="outline" className={`${insights.objections?.length > 0 ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {insights.objections?.length || 0} Flagged
            </Badge>
          </div>

          {insights.objections && insights.objections.length > 0 ? (
            <ul className="space-y-3.5">
              {insights.objections.map((objection, idx) => (
                <li key={idx} className="flex items-start gap-3 text-gray-700 hover:text-gray-900 group">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-100/80 text-rose-600 font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">⚠️</span>
                  <span className="text-sm font-medium leading-relaxed">{objection}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8 text-gray-400 italic">
              <div className="text-2xl mb-2">✅</div>
              No objections or blockers flagged in customer chats so far.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
