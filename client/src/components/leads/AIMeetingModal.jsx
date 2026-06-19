import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AIMeetingModal({ isOpen, onClose, leadId, onSummarySaved }) {
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();

  const handleSummarize = async () => {
    if (!transcript.trim()) return toast.error('Please enter meeting notes or transcript');
    
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post(`/leads/${leadId}/meeting-summary`, { transcript });
      if (res.data.success) {
        setResult(res.data.data);
        toast.success('Meeting summarized and logged successfully!');
        if (onSummarySaved) onSummarySaved();
      }
    } catch (e) {
      toast.error('Failed to summarize meeting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            🎙️ AI Meeting Summarizer
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          
          {!result && (
            <>
              <p className="text-sm text-gray-600">
                Paste your raw meeting notes, voice-to-text transcript, or brain dump below. The AI will clean it up, log a professional summary, and automatically extract and create Action Items.
              </p>
              <textarea
                className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="e.g., Client wants a modern kitchen with an island. They are worried about the budget, keep it under 5 lakhs. Need to send them a revised 3D rendering by Friday."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={loading}
              />
            </>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="text-4xl animate-bounce">🤖</div>
              <p className="text-indigo-600 font-medium animate-pulse">Analyzing transcript & extracting action items...</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-6">
              <div className="bg-green-50 text-green-800 p-4 rounded-lg border border-green-200">
                <h4 className="font-bold flex items-center gap-2 mb-2">✅ Successfully Logged to Activity Feed</h4>
                <p className="text-sm">The AI has analyzed your notes and updated the CRM.</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-gray-800 bg-gray-50 p-4 rounded-lg border border-gray-100">{result.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Extracted Tasks</h4>
                  {result.action_items?.length > 0 ? (
                    <ul className="space-y-2">
                      {result.action_items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500">◻</span> {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No action items found.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sentiment</h4>
                  <span className={\`inline-block px-3 py-1 rounded-full text-xs font-semibold \${
                    result.customer_sentiment?.toLowerCase().includes('positive') ? 'bg-green-100 text-green-700' : 
                    result.customer_sentiment?.toLowerCase().includes('negative') ? 'bg-red-100 text-red-700' : 
                    'bg-gray-100 text-gray-700'
                  }\`}>
                    {result.customer_sentiment || 'Neutral'}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
          {!result && (
            <Button variant="primary" onClick={handleSummarize} disabled={loading || !transcript.trim()}>
              {loading ? 'Summarizing...' : 'Summarize & Log'}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
