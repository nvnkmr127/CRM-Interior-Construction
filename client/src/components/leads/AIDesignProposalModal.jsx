import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AIDesignProposalModal({ isOpen, onClose, leadId }) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && !proposal) {
      generateProposal();
    }
  }, [isOpen]);

  const generateProposal = async () => {
    setLoading(true);
    setProposal(null);
    try {
      const res = await api.post(`/leads/${leadId}/ai-design-proposal`);
      if (res.data.success) {
        setProposal(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to generate AI Design Proposal');
      onClose();
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
            ✨ AI Design Proposal
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="text-5xl animate-pulse">✨</div>
              <p className="text-gray-500 font-medium">Gemini is analyzing preferences and inspirations...</p>
              <p className="text-sm text-gray-400">Generating color palettes and material suggestions</p>
            </div>
          ) : proposal ? (
            <div className="space-y-8">
              
              <div className="text-center pb-6 border-b border-gray-100">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold tracking-wide mb-3 uppercase">
                  {proposal.recommended_style}
                </span>
                <p className="text-gray-700 text-lg leading-relaxed max-w-xl mx-auto">
                  "{proposal.design_concept}"
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>🎨</span> Color Palette
                </h3>
                <div className="flex flex-wrap gap-4">
                  {proposal.color_palette?.map((color, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div 
                        className="w-16 h-16 rounded-full shadow-inner border border-gray-200"
                        style={{ backgroundColor: color.hex }}
                        title={color.hex}
                      />
                      <div className="text-xs text-gray-600 text-center font-medium max-w-[80px] leading-tight">
                        {color.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>🧱</span> Material Suggestions
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {proposal.material_suggestions?.map((material, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <span className="text-indigo-400">✧</span> {material}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Failed to load proposal.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!loading && (
            <Button variant="primary" onClick={generateProposal}>
              Regenerate
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
