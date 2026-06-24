import React, { useState } from 'react';
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

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="p-4 border-b border-gray-200 bg-blue-50/50">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          Digital Customer Twin
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          Practice your pitch. The AI will respond as {lead?.name || 'the customer'} based on their recorded budget, timeline, and preferences.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : msg.role === 'system'
                  ? 'bg-gray-200 text-gray-600 text-xs w-full text-center'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-none'
            }`}>
              {msg.role === 'twin' && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{lead?.name || 'Customer'} (Simulated)</div>}
              {msg.role === 'user' && <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-1">You</div>}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-500 rounded-lg rounded-bl-none p-3 shadow-sm text-sm italic">
              Thinking...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder={`Send a message to ${lead?.name || 'customer'}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" variant="primary" disabled={loading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
