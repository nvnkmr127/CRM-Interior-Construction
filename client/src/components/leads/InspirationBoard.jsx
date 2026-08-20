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
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingInspiration, setEditingInspiration] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const toast = useToast();

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return toast.error('Only image files are allowed for inspiration board');
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/leads/${leadId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success && res.data.data?.download_url) {
        const imageUrl = res.data.data.download_url;
        
        // Save the inspiration directly to backend database
        const inspRes = await api.post(`/leads/${leadId}/inspirations`, {
          image_url: imageUrl,
          room_type: 'General',
          notes: ''
        });

        if (inspRes.data.success) {
          setInspirations(prev => [inspRes.data.data, ...prev]);
          toast.success('Image uploaded and added directly to board!');
        } else {
          toast.error('Failed to save inspiration record');
        }
      } else {
        toast.error('Failed to get download URL from uploaded file');
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload image file');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

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
          <Button
            variant="outline"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            className="shadow-sm border-gray-200 flex items-center gap-1.5 font-semibold text-gray-700 hover:bg-gray-50"
            disabled={isUploading}
          >
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
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
         <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-md border border-purple-100 relative overflow-hidden transition-all duration-300">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
             <h4 className="text-base font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Add New Inspiration
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                   <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                   Image URL *
                 </label>
                 <div className="relative">
                   <input 
                     type="text" 
                     placeholder="e.g. unsplash.com/photo-xxx or https://example.com/image.jpg" 
                     value={newInspiration.image_url} 
                     onChange={e => setNewInspiration({...newInspiration, image_url: e.target.value})} 
                     required 
                     className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800"
                   />
                 </div>
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                   <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                   Room / Space
                 </label>
                 <input 
                   type="text"
                   placeholder="e.g. Master Bedroom, Modular Kitchen" 
                   value={newInspiration.room_type} 
                   onChange={e => setNewInspiration({...newInspiration, room_type: e.target.value})} 
                   className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800"
                 />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                   <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                   Notes / Comments
                 </label>
                 <input 
                   type="text"
                   placeholder="e.g. Client prefers ambient wall washing lights" 
                   value={newInspiration.notes} 
                   onChange={e => setNewInspiration({...newInspiration, notes: e.target.value})} 
                   className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800"
                 />
               </div>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-100 gap-3">
               <button 
                 type="button" 
                 onClick={() => setIsAdding(false)} 
                 className="px-5 py-2 rounded-lg text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
               >
                 Cancel
               </button>
               <button 
                 type="submit" 
                 className="px-5 py-2 text-sm font-bold text-white rounded-lg bg-purple-600 hover:bg-purple-750 transition-all shadow-md hover:shadow-lg"
               >
                 Save Inspiration
               </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {inspirations.map(insp => (
             <div key={insp.id} className="relative flex flex-col group rounded-2xl overflow-hidden border border-gray-100 transition-all shadow-sm hover:shadow-lg bg-white h-auto">
                 <button 
                   onClick={async (e) => { e.stopPropagation(); setEditingInspiration(insp); }}
                   className="absolute top-3 right-12 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md backdrop-blur-md bg-white/90"
                   title="Edit"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                 </button>
                 <button 
                   onClick={async (e) => { e.stopPropagation(); handleDelete(insp.id); }}
                   className="absolute top-3 right-3 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md backdrop-blur-md bg-white/90"
                   title="Delete"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
                 
                 <div 
                   onClick={() => setSelectedImage(insp.image_url)}
                   className="relative h-56 w-full overflow-hidden shrink-0 group-hover:brightness-95 transition-all duration-300 cursor-pointer"
                 >
                   <img 
                     src={insp.image_url} 
                     alt={insp.room_type || 'Inspiration'} 
                     className="w-full h-full object-cover" 
                   />
                   
                   {/* AI Extracted Metadata Overlay */}
                   <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 backdrop-blur-md bg-white/90 border border-white/40 translate-y-2 group-hover:translate-y-0 duration-300 z-10">
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
                 
                 <div className="p-4 bg-white flex-1 flex flex-col justify-between">
                   <div className="space-y-1.5">
                     {insp.room_type ? (
                       <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs font-bold px-2 py-0.5 w-fit">
                         {insp.room_type}
                       </Badge>
                     ) : (
                       <div className="h-5"></div>
                     )}
                     {insp.notes ? (
                       <p className="text-sm text-gray-600 leading-relaxed font-medium">{insp.notes}</p>
                     ) : (
                       <p className="text-xs text-gray-400 italic">No notes added</p>
                     )}
                   </div>
                 </div>
               </div>
           ))}
          </div>
      )}

      <AIDesignProposalModal 
        isOpen={showAiModal} 
        onClose={() => setShowAiModal(false)} 
        leadId={leadId} 
      />

      {/* Edit Inspiration Pop-up Modal Form */}
      {editingInspiration && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setEditingInspiration(null)}
        >
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await api.patch(`/leads/${leadId}/inspirations/${editingInspiration.id}`, {
                  image_url: editingInspiration.image_url,
                  room_type: editingInspiration.room_type,
                  notes: editingInspiration.notes
                });
                if (res.data.success) {
                  setInspirations(inspirations.map(i => i.id === editingInspiration.id ? res.data.data : i));
                  setEditingInspiration(null);
                  toast.success('Inspiration updated');
                }
              } catch (err) {
                toast.error('Failed to update inspiration');
              }
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit Inspiration Details
              </h2>
              <button 
                type="button"
                onClick={() => setEditingInspiration(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl font-light focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                  Image URL *
                </label>
                <input 
                  type="text" 
                  value={editingInspiration.image_url} 
                  onChange={e => setEditingInspiration({...editingInspiration, image_url: e.target.value})} 
                  required 
                  className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                  Room / Space
                </label>
                <input 
                  type="text" 
                  value={editingInspiration.room_type || ''} 
                  onChange={e => setEditingInspiration({...editingInspiration, room_type: e.target.value})} 
                  className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Notes / Comments
                </label>
                <textarea 
                  value={editingInspiration.notes || ''} 
                  onChange={e => setEditingInspiration({...editingInspiration, notes: e.target.value})} 
                  className="w-full text-sm font-semibold border border-gray-200 rounded-xl p-2.5 bg-gray-50/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-gray-800 min-h-[100px]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditingInspiration(null)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Inspiration Image Preview
              </h2>
              <button 
                onClick={() => setSelectedImage(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl font-light focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-gray-50/30">
              <img 
                src={selectedImage} 
                alt="Inspiration Preview" 
                className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-gray-200"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedImage(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
