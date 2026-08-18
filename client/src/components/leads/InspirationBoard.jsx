/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Input } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import AIDesignProposalModal from './AIDesignProposalModal';

import { useConfirm } from '../../store/confirmContext';

export default function InspirationBoard({ leadId }) {
  const { confirm } = useConfirm();

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

    let imageUrl = newInspiration.image_url.trim();
    if (!/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
      imageUrl = `https://${imageUrl}`;
    }

    try {
      const res = await api.post(`/leads/${leadId}/inspirations`, {
        ...newInspiration,
        image_url: imageUrl
      });
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
    if (!await confirm('Delete this inspiration?')) return;
    try {
      await api.delete(`/leads/${leadId}/inspirations/${id}`);
      setInspirations(inspirations.filter(i => i.id !== id));
      toast.success('Inspiration deleted');
    } catch (e) {
      toast.error('Failed to delete inspiration');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Inspiration Board
          </h3>
          <p className="text-sm text-gray-500 mt-1">Collect and organize reference images for the project design.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="md" onClick={async () => setIsAdding(!isAdding)} className="shadow-sm border-gray-200">
            {isAdding ? 'Cancel' : '+ Add Image'}
          </Button>
          <Button variant="primary" size="md" onClick={async () => setShowAiModal(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-none shadow-md text-white font-semibold">
            ✨ AI Design Proposal
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
         <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100 relative overflow-hidden transition-all">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
             <h4 className="text-base font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Add New Inspiration
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Image URL *</label>
                 <Input placeholder="e.g. unsplash.com/photo-xxx or https://example.com/image.jpg" value={newInspiration.image_url} onChange={e => setNewInspiration({...newInspiration, image_url: e.target.value})} required className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Room / Space</label>
                 <Input placeholder="e.g. Master Bedroom" value={newInspiration.room_type} onChange={e => setNewInspiration({...newInspiration, room_type: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
                 <Input placeholder="e.g. Client likes the lighting here" value={newInspiration.notes} onChange={e => setNewInspiration({...newInspiration, notes: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-100">
               <Button type="submit" variant="primary" size="md" className="shadow-sm bg-purple-600 hover:bg-purple-700 border-purple-600">Save Inspiration</Button>
             </div>
         </form>
      )}

      {/* Grid */}
      {loading ? (
         <div className="flex flex-col items-center justify-center py-16 text-gray-400">
           <svg className="w-8 h-8 animate-spin mb-3 text-purple-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <p className="font-medium">Loading inspiration board...</p>
         </div>
      ) : inspirations.length === 0 ? (
         <div className="text-center py-16 text-gray-500 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 shadow-inner">
           <svg className="w-14 h-14 text-purple-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
           <p className="text-lg font-bold text-gray-700">No inspiration images yet</p>
           <p className="text-sm mt-2 mb-6 max-w-sm mx-auto text-gray-500">Collect aesthetic references, room layouts, or material palettes to guide the design process.</p>
           <Button onClick={async () => setIsAdding(true)} variant="outline" size="md" className="shadow-sm">+ Add First Image</Button>
         </div>
      ) : (
         <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          {inspirations.map(insp => (
            <div key={insp.id} className="relative break-inside-avoid group rounded-2xl overflow-hidden border border-gray-100 transition-all shadow-sm hover:shadow-lg bg-white">
                <button 
                  onClick={async () => handleDelete(insp.id)}
                  className="absolute top-3 right-3 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md backdrop-blur-md bg-white/90"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                
                <div className="relative group-hover:brightness-95 transition-all duration-300">
                  <img 
                    src={insp.image_url} 
                    alt={insp.room_type || 'Inspiration'} 
                    className="w-full h-auto object-cover" 
                  />
                  
                  {/* AI Extracted Metadata Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 backdrop-blur-md bg-white/90 border border-white/40 translate-y-2 group-hover:translate-y-0 duration-300">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI Extracted Insights
                    </div>
                    <div className="text-xs font-bold text-gray-800">
                      Style: <span className="font-medium text-gray-600">{insp.id % 2 === 0 ? 'Modern Minimalist' : 'Japandi'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">Palette:</span>
                      <div className="flex gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-slate-800 border border-white shadow-sm"></div>
                        <div className="w-4 h-4 rounded-full bg-stone-300 border border-white shadow-sm"></div>
                        <div className="w-4 h-4 rounded-full bg-amber-700 border border-white shadow-sm"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {(insp.room_type || insp.notes) && (
                  <div className="p-4 bg-white">
                    {insp.room_type && (
                      <Badge variant="outline" className="mb-2.5 bg-gray-50 text-gray-700 border-gray-200 text-xs font-bold px-2 py-1">
                        {insp.room_type}
                      </Badge>
                    )}
                    {insp.notes && <p className="text-sm text-gray-600 leading-relaxed font-medium">{insp.notes}</p>}
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
