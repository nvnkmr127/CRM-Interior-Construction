import React, { useState } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AIProposalGenerator({ leadId, lead }) {
  const [proposalText, setProposalText] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetBudget, setTargetBudget] = useState(lead?.budget_max || '');
  const toast = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/leads/${leadId}/generate-proposal`, {
        target_budget: targetBudget
      });
      if (res.data.success && res.data.data.proposal_text) {
        setProposalText(res.data.data.proposal_text);
        toast.success('Proposal generated successfully');
      } else {
        toast.error('Failed to generate proposal');
      }
    } catch (e) {
      toast.error('Failed to generate proposal');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            AI Executive Proposal
          </h3>
          <p className="text-sm text-gray-500">Auto-generate a 1-page sales narrative based on scope and budget.</p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex items-center gap-4 mb-6 shadow-sm">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Target Budget (₹)</label>
          <input 
            type="number" 
            value={targetBudget}
            onChange={e => setTargetBudget(e.target.value)}
            className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g. 1500000"
          />
        </div>
        <div className="pt-5">
          <Button variant="primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : '✨ Generate Proposal'}
          </Button>
        </div>
      </div>

      {proposalText ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-600 uppercase">Draft Proposal (Markdown)</span>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(proposalText).then(() => toast.success('Copied to clipboard!'))}>
              Copy Text
            </Button>
          </div>
          <textarea 
            className="w-full h-96 p-4 text-sm font-mono text-gray-800 border-none focus:ring-0 resize-y"
            value={proposalText}
            onChange={(e) => setProposalText(e.target.value)}
          ></textarea>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-300 rounded-lg">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <p className="text-sm font-medium">No proposal generated yet.</p>
          <p className="text-xs mt-1">Click the generate button above to create a draft.</p>
        </div>
      )}
    </div>
  );
}
