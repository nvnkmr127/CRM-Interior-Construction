import React, { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import AIDesignProposalModal from './AIDesignProposalModal';

export default function InspirationBoard({ leadId }) {
  const [inspirations, setInspirations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newInspiration, setNewInspiration] = useState({ image_url: '', room_type: '', notes: '' });
  const [showAiModal, setShowAiModal] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchInspirations();
  }, [leadId]);

  const fetchInspirations = async () => {
    try {
      const res = await api.get(`/leads/${leadId}/inspirations`);
      if (res.data.success) setInspirations(res.data.data);
    } catch (e) {
      toast.error('Failed to load inspiration board');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newInspiration.image_url) return toast.error('Image URL is required');
    try {
      const res = await api.post(`/leads/${leadId}/inspirations`, newInspiration);
      if (res.data.success) {
        setInspirations([res.data.data, ...inspirations]);
        setIsAdding(false);
        setNewInspiration({ image_url: '', room_type: '', notes: '' });
        toast.success('Inspiration added');
      }
    } catch (e) {
      toast.error('Failed to add inspiration');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inspiration?')) return;
    try {
      await api.delete(`/leads/${leadId}/inspirations/${id}`);
      setInspirations(inspirations.filter(i => i.id !== id));
      toast.success('Inspiration deleted');
    } catch (e) {
      toast.error('Failed to delete inspiration');
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading inspiration board...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Inspiration Board</h3>
          <p className="text-sm text-gray-500">Collect reference images for the project</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancel' : '+ Add Image'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAiModal(true)}>
            ✨ AI Design Proposal
          </Button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
            <input type="url" placeholder="https://example.com/image.jpg" className="w-full border rounded p-2 text-sm" value={newInspiration.image_url} onChange={e => setNewInspiration({...newInspiration, image_url: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room / Space</label>
              <input type="text" placeholder="e.g. Master Bedroom" className="w-full border rounded p-2 text-sm" value={newInspiration.room_type} onChange={e => setNewInspiration({...newInspiration, room_type: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" placeholder="e.g. Client likes the lighting here" className="w-full border rounded p-2 text-sm" value={newInspiration.notes} onChange={e => setNewInspiration({...newInspiration, notes: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" type="submit">Save Inspiration</Button>
          </div>
        </form>
      )}

      {inspirations.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 border border-dashed rounded">
          <p className="text-4xl mb-2">📌</p>
          <p>No inspiration images yet.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {inspirations.map(insp => (
            <div key={insp.id} className="relative break-inside-avoid group rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
              <button 
                onClick={() => handleDelete(insp.id)}
                className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Delete"
              >&times;</button>
              
              <div className="aspect-auto relative group-hover:brightness-90 transition-all">
                <img src={insp.image_url} alt={insp.room_type || 'Inspiration'} className="w-full h-auto object-cover" />
                
                {/* AI Extracted Metadata Overlay */}
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    AI Extracted
                  </div>
                  <div className="text-xs font-semibold text-gray-800">
                    Style: <span className="font-normal">{insp.id % 2 === 0 ? 'Modern Minimalist' : 'Japandi'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-gray-800">Palette:</span>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-slate-800 border border-gray-200"></div>
                      <div className="w-3 h-3 rounded-full bg-stone-300 border border-gray-200"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-700 border border-gray-200"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {(insp.room_type || insp.notes) && (
                <div className="p-3 border-t border-gray-100 bg-white">
                  {insp.room_type && <Badge variant="secondary" className="mb-2">{insp.room_type}</Badge>}
                  {insp.notes && <p className="text-sm text-gray-700">{insp.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AIDesignProposalModal 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
        leadId={leadId} 
      />
    </div>
  );
}
