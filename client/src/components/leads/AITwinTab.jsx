/* eslint-disable no-unused-vars */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AITwinTab({ leadId, lead }) {
  const [messages, setMessages] = useState([
    { role: 'system', content: `Simulated connection established with Digital Twin of ${lead?.name || 'Customer'}.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e, directText = null) => {
    e?.preventDefault();
    const textToSend = directText || input;
    if (!textToSend.trim()) return;

    const userMessage = textToSend.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    if (!directText) setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/leads/${leadId}/ai-twin`, { prompt: userMessage });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: 'twin', content: res.data.data.text }]);
      }
    } catch (err) {
      toast.error('Failed to communicate with Digital Twin.');
      setMessages(prev => [...prev, { role: 'twin', content: "I'm currently unable to access my notes. Should we schedule a brief meeting instead to discuss your requirements?" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      { role: 'system', content: `Simulated connection established with Digital Twin of ${lead?.name || 'Customer'}.` }
    ]);
    toast.success('Simulation history cleared.');
  };

  const initials = useMemo(() => {
    if (!lead?.name) return 'C';
    return lead.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }, [lead]);

  const suggestions = useMemo(() => [
    `Hi ${lead?.name?.split(' ')[0] || 'there'}, what is your primary budget limit for this project?`,
    "What style or aesthetic theme do you prefer for your interiors?",
    "When do you expect to take possession of the property?",
    "Are you currently exploring options with other design firms?"
  ], [lead]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white/30 backdrop-blur-xl shadow-sm transition-all duration-300">
      
      {/* Header section matching CRM glassmorphism */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200/60 bg-[#fcfbf9]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-md">
            👥
            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              Digital Twin Simulator
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/10 text-blue-700 border border-blue-200/50 rounded-full">v2.0 Beta</span>
            </h3>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              Simulating responses based on client profile & requirements.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
          className="h-8 border-gray-200 hover:border-red-200 text-gray-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold px-3 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
        >
          🔄 Reset
        </Button>
      </div>

      {/* Message Feed with styled avatars and bubbles */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/20">
        {messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div key={idx} className="flex justify-center my-2">
                <div className="bg-[#eef4ff] border border-[#dbeafe] rounded-xl px-4 py-2 text-[11px] text-[#1c4ed8] font-semibold text-center max-w-md shadow-sm">
                  ⚡ {msg.content}
                </div>
              </div>
            );
          }

          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex gap-3 items-start ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center shadow-sm border border-gray-200/80 uppercase shrink-0">
                  {initials}
                </div>
              )}
              
              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
                  {isUser ? 'You' : `${lead?.name || 'Customer'} (Twin)`}
                </div>
                <div 
                  className={`rounded-2xl p-3 text-sm shadow-sm leading-relaxed transition-all ${
                    isUser 
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {isUser && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm uppercase shrink-0">
                  YR
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-start justify-start">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 font-bold text-xs flex items-center justify-center shadow-sm border border-gray-200/80 uppercase shrink-0 animate-pulse">
              {initials}
            </div>
            <div className="flex flex-col items-start max-w-[75%]">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1 animate-pulse">
                {lead?.name || 'Customer'} is typing...
              </div>
              <div className="bg-white border border-gray-200 text-gray-400 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm text-xs italic flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2.5 bg-white/40 border-t border-gray-200/50 flex flex-wrap gap-2 shrink-0">
        {suggestions.map((text, idx) => (
          <button
            key={idx}
            onClick={(e) => handleSend(e, text)}
            disabled={loading}
            className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-gray-200/60 hover:border-blue-200 text-gray-600 hover:text-blue-700 rounded-full text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-left"
          >
            💬 {text}
          </button>
        ))}
      </div>

      {/* Premium Input form */}
      <div className="p-4 border-t border-gray-200/60 bg-[#fcfbf9]/60 backdrop-blur-md shrink-0">
        <form onSubmit={(e) => handleSend(e)} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm px-4 py-2.5 bg-white/90 shadow-sm transition-all"
            placeholder={`Practice your pitch... Send a message to ${lead?.name || 'customer'}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="h-10 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <span>Send</span>
            <span>➡️</span>
          </button>
        </form>
      </div>
    </div>
  );
}
