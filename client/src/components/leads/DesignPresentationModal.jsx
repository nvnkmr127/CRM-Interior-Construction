/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function DesignPresentationModal({ isOpen, onClose, leadId, onLogged }) {
  const [outcome, setOutcome] = useState('Revisions Needed');
  const [notes, setNotes] = useState('');
  const [presentationDate, setPresentationDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState('');
  const [nextSteps, setNextSteps] = useState('');
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
        notes: `**Design Presentation Logged**\n\n**Date:** ${presentationDate}\n**Duration:** ${duration} mins\n**Attendees:** ${attendees}\n**Outcome:** ${outcome}\n\n**Notes:**\n${notes}\n\n**Next Steps:**\n${nextSteps}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 bg-white transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50/40">
          <h3 className="text-base font-bold text-indigo-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            Log Design Presentation
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100/80 transition-colors text-lg font-bold"
          >
            &times;
          </button>
        </div>
        
        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Presentation Date</label>
                <input 
                  type="date"
                  value={presentationDate}
                  onChange={e => setPresentationDate(e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Duration (mins)</label>
                <input 
                  type="number"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800"
                />
              </div>
 
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Attendees</label>
                <input 
                  type="text"
                  value={attendees}
                  onChange={e => setAttendees(e.target.value)}
                  placeholder="Who was present?"
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Presentation Outcome</label>
                <select 
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800"
                >
                  <option value="Approved - Move to Quote">Approved - Move to Quote</option>
                  <option value="Revisions Needed">Revisions Needed</option>
                  <option value="Rejected - Needs New Concept">Rejected - Needs New Concept</option>
                  <option value="Customer Unsure / Delayed">Customer Unsure / Delayed</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Meeting Notes & Feedback</label>
              <textarea 
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did the customer like? What needs changing?"
                className="w-full text-sm rounded-lg p-3 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800 leading-relaxed"
              ></textarea>
            </div>
 
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Next Steps / Action Items</label>
              <textarea 
                rows={2}
                value={nextSteps}
                onChange={e => setNextSteps(e.target.value)}
                placeholder="What needs to happen next?"
                className="w-full text-sm rounded-lg p-3 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all text-gray-800 leading-relaxed"
              ></textarea>
            </div>
          </div>
          
          {/* Modal Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className="px-5 py-2 bg-white border border-[#E38E54] text-[#E38E54] hover:bg-orange-50/30 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2 bg-[#E38E54] hover:bg-[#d57f46] text-white rounded-lg text-sm font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? 'Logging...' : 'Log Presentation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
