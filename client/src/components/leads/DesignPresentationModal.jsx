import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function DesignPresentationModal({ isOpen, onClose, leadId, onLogged }) {
  const [outcome, setOutcome] = useState('Revisions Needed');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!notes) {
      toast.error('Please add notes about the presentation.');
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        type: 'meeting',
        notes: `**Design Presentation Logged**\n\n**Outcome:** ${outcome}\n\n**Notes:**\n${notes}`,
      };
      
      const res = await api.post(`/leads/${leadId}/activities`, payload);
      if (res.data.success) {
        toast.success('Presentation logged successfully');
        if (onLogged) onLogged();
        onClose();
      }
    } catch (e) {
      toast.error('Failed to log presentation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
          <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
            Log Design Presentation
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presentation Outcome</label>
              <select 
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="Approved - Move to Quote">Approved - Move to Quote</option>
                <option value="Revisions Needed">Revisions Needed</option>
                <option value="Rejected - Needs New Concept">Rejected - Needs New Concept</option>
                <option value="Customer Unsure / Delayed">Customer Unsure / Delayed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Notes & Feedback</label>
              <textarea 
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did the customer like? What needs changing?"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              ></textarea>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Logging...' : 'Log Presentation'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
