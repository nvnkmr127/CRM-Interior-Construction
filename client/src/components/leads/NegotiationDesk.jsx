/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function NegotiationDesk({ leadId, lead, onUpdate }) {
  const toast = useToast();
  const negotiation = lead?.custom_fields?.negotiation || {};
  
  const [quotedPrice, setQuotedPrice] = useState(negotiation.quoted_price || '');
  const [targetPrice, setTargetPrice] = useState(negotiation.target_price || '');
  const [notes, setNotes] = useState(negotiation.notes || '');
  const [loading, setLoading] = useState(false);

  const gap = (parseFloat(quotedPrice) || 0) - (parseFloat(targetPrice) || 0);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/leads/${leadId}/negotiation`, {
        quoted_price: quotedPrice,
        target_price: targetPrice,
        notes: notes
      });
      if (res.data.success) {
        toast.success('Negotiation details saved');
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      toast.error('Failed to save negotiation details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Negotiation Desk
          </h3>
          <p className="text-sm text-gray-500">Track final financial hurdles before closing.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Our Quoted Price</label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-400">₹</span>
              <input 
                type="number" 
                value={quotedPrice}
                onChange={e => setQuotedPrice(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-200 focus:border-blue-500 focus:outline-none focus:ring-0 pb-1"
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="bg-orange-50/50 p-4 rounded-lg border border-orange-100">
            <label className="block text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Customer Target Price</label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-400">₹</span>
              <input 
                type="number" 
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                className="w-full text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-orange-200 focus:border-orange-500 focus:outline-none focus:ring-0 pb-1"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
          <div>
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">The Gap</div>
            <div className={`text-xl font-bold ${gap > 0 ? 'text-red-600' : gap < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              {gap > 0 ? `₹${gap.toLocaleString()} to close` : gap < 0 ? `Target exceeded by ₹${Math.abs(gap).toLocaleString()}` : 'Aligned'}
            </div>
          </div>
          <div className="w-1/2">
             <label className="block text-xs font-medium text-gray-700 mb-1">Negotiation Notes & Tactics</label>
             <textarea 
               rows={2}
               className="w-full text-sm border-gray-300 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
               placeholder="e.g. Offered free chimney to bridge the gap instead of a cash discount..."
               value={notes}
               onChange={e => setNotes(e.target.value)}
             ></textarea>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Negotiation'}
          </Button>
        </div>
      </div>

      {gap > 0 && gap < 200000 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg p-5 shadow-sm">
          <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI Closing Tactics (Close the ₹{gap.toLocaleString()} gap)
          </h4>
          <ul className="space-y-2 text-sm text-emerald-900">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <strong>Value Add Instead of Discount:</strong> Offer a free modular kitchen accessory upgrade (e.g., tall unit, tandem drawers) worth ₹20k to make them feel they won, preserving margins.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <strong>Warranty Extension:</strong> Offer an extended 5-year warranty on woodwork. High perceived value to customer, low actual cost to company.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">•</span>
              <strong>Phased Execution:</strong> Suggest moving the guest bedroom wardrobes to a "Phase 2" project next year to hit their immediate budget constraint.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
