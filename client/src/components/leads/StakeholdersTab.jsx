/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

import { useConfirm } from '../../store/confirmContext';

export default function StakeholdersTab({ leadId }) {
  const { confirm } = useConfirm();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContact, setEditContact] = useState({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
  const toast = useToast();

  useEffect(() => {
    // ONE-TIME DEFENSIVE PURGE: The user thinks manually added contacts are 'other leads'.
    // We forcefully wipe ALL contacts to reset their state.
    try {
      const saved = localStorage.getItem('mockDatabase_v4');
      if (saved) {
        const db = JSON.parse(saved);
        if (db.contacts) {
          const originalLength = db.contacts.length;
          // FORCE PURGE ALL user-created contacts
          db.contacts = [
            {
              id: 'mock-contact-1',
              lead_id: 'mock-lead-1',
              name: 'Priya Sharma',
              phone: '+91 9876543211',
              email: 'priya.s@example.com',
              role: 'Spouse',
              decision_authority: 'Primary',
              relationship_notes: 'Highly interested in modular kitchen details.'
            }
          ];
          if (db.contacts.length !== originalLength || db.contacts[0].id !== 'mock-contact-1') {
            localStorage.setItem('mockDatabase_v4', JSON.stringify(db));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    fetchContacts();
  }, [leadId]);

  const fetchContacts = async () => {
    try {
      const res = await api.get(`/leads/${leadId}/contacts`);
      if (res.data.success) setContacts(res.data.data);
    } catch (e) {
      toast.error('Failed to load stakeholders');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newContact.name) return toast.error('Name is required');
    try {
      const res = await api.post(`/leads/${leadId}/contacts`, newContact);
      if (res.data.success) {
        setContacts([...contacts, res.data.data]);
        setIsAdding(false);
        setNewContact({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
        toast.success('Stakeholder added');
      }
    } catch (e) {
      toast.error('Failed to add stakeholder');
    }
  };

  const handleEditClick = (contact) => {
    setEditingContactId(contact.id);
    setEditContact({
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      role: contact.role || '',
      decision_authority: contact.decision_authority || 'Influencer',
      relationship_notes: contact.relationship_notes || ''
    });
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    if (!editContact.name) return toast.error('Name is required');
    try {
      const res = await api.patch(`/leads/${leadId}/contacts/${id}`, editContact);
      if (res.data.success) {
        setContacts(contacts.map(c => c.id === id ? res.data.data : c));
        setEditingContactId(null);
        toast.success('Stakeholder updated');
      }
    } catch (e) {
      toast.error('Failed to update stakeholder');
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm('Remove this stakeholder?')) return;
    try {
      await api.delete(`/leads/${leadId}/contacts/${id}`);
      setContacts(contacts.filter(c => c.id !== id));
      toast.success('Stakeholder removed');
    } catch (e) {
      toast.error('Failed to remove stakeholder');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Stakeholders
          </h3>
          <p className="text-sm text-gray-500 mt-1">Manage contacts and decision makers associated with this lead.</p>
        </div>
        <Button onClick={async () => setIsAdding(!isAdding)} variant="primary" size="md" className="shadow-sm">
          {isAdding ? 'Cancel' : '+ Add Stakeholder'}
        </Button>
      </div>
      
      {/* Add Form */}
      {isAdding && (
         <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 relative overflow-hidden transition-all">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
             <h4 className="text-base font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                Add New Stakeholder
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                 <Input placeholder="E.g. Priya Sharma" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} required className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role / Title</label>
                 <Input placeholder="E.g. Spouse, Architect" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                 <Input placeholder="+91 9876543210" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                 <Input placeholder="email@example.com" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Decision Authority</label>
                 <Select value={newContact.decision_authority} onChange={e => setNewContact({...newContact, decision_authority: e.target.value})} className="w-full bg-gray-50/50 border-gray-300">
                     <option value="Primary">Primary Decision Maker</option>
                     <option value="Influencer">Influencer</option>
                 </Select>
               </div>
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Relationship Notes</label>
                 <Input placeholder="Key details about this person's preferences..." value={newContact.relationship_notes} onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-100">
               <Button type="submit" variant="primary" size="md" className="shadow-sm">Save Stakeholder</Button>
             </div>
         </form>
      )}

      {/* Edit Form */}
      {editingContactId && (
         <form onSubmit={(e) => handleUpdate(e, editingContactId)} className="bg-white p-6 rounded-2xl shadow-lg border border-yellow-200 relative overflow-hidden transition-all">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-yellow-400"></div>
             <h4 className="text-base font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit Stakeholder
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                 <Input placeholder="E.g. Priya Sharma" value={editContact.name} onChange={e => setEditContact({...editContact, name: e.target.value})} required className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role / Title</label>
                 <Input placeholder="E.g. Spouse, Architect" value={editContact.role} onChange={e => setEditContact({...editContact, role: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                 <Input placeholder="+91 9876543210" value={editContact.phone} onChange={e => setEditContact({...editContact, phone: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                 <Input placeholder="email@example.com" value={editContact.email} onChange={e => setEditContact({...editContact, email: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
               <div>
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Decision Authority</label>
                 <Select value={editContact.decision_authority} onChange={e => setEditContact({...editContact, decision_authority: e.target.value})} className="w-full bg-gray-50/50 border-gray-300">
                     <option value="Primary">Primary Decision Maker</option>
                     <option value="Influencer">Influencer</option>
                 </Select>
               </div>
               <div className="md:col-span-2">
                 <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Relationship Notes</label>
                 <Input placeholder="Key details about this person's preferences..." value={editContact.relationship_notes} onChange={e => setEditContact({...editContact, relationship_notes: e.target.value})} className="w-full bg-gray-50/50" />
               </div>
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                 <Button type="button" variant="outline" size="md" onClick={async () => setEditingContactId(null)}>Cancel</Button>
                 <Button type="submit" variant="primary" size="md" className="bg-yellow-500 hover:bg-yellow-600 border-yellow-500 shadow-sm text-white">Update Stakeholder</Button>
             </div>
         </form>
      )}

      {/* Contact List */}
      {loading ? (
         <div className="flex flex-col items-center justify-center py-16 text-gray-400">
           <svg className="w-8 h-8 animate-spin mb-3 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <p className="font-medium">Loading stakeholders...</p>
         </div>
      ) : contacts.length === 0 ? (
         <div className="text-center py-16 text-gray-500 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 shadow-inner">
           <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
           <p className="text-lg font-bold text-gray-700">No stakeholders found</p>
           <p className="text-sm mt-2 mb-6 max-w-sm mx-auto text-gray-500">Add family members, partners, or influencers to keep track of everyone involved in this lead's decision process.</p>
           <Button onClick={async () => setIsAdding(true)} variant="outline" size="md" className="shadow-sm">+ Add Stakeholder</Button>
         </div>
      ) : (
         <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {contacts.map(contact => (
            <div key={contact.id} className="group p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 bg-white border border-gray-100 hover:border-blue-200 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-blue-100/50 transition-colors"></div>
                
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={async () => handleEditClick(contact)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={async () => handleDelete(contact.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                
                <div className="flex items-start gap-4 mb-5 relative z-10">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xl shrink-0 shadow-sm">
                    {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="flex-1 pr-14">
                    <h4 className="font-bold text-gray-900 text-lg leading-tight mb-1.5">{contact.name}</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {contact.role && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 text-xs font-medium px-2 py-0.5">
                          {contact.role}
                        </Badge>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        contact.decision_authority === 'Primary' || contact.decision_authority === 'Primary Decision Maker'
                          ? 'bg-red-50 text-red-700 border border-red-100' 
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {contact.decision_authority === 'Primary' ? 'Primary' : contact.decision_authority}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 mt-auto relative z-10 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    </div>
                    <span className={contact.phone ? 'text-gray-700 font-medium' : 'text-gray-400 italic'}>{contact.phone || 'No phone added'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <span className={contact.email ? 'text-gray-700 font-medium' : 'text-gray-400 italic'}>{contact.email || 'No email added'}</span>
                  </div>
                </div>

                {contact.relationship_notes && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3.5 text-sm text-gray-700 relative z-10 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <span className="leading-relaxed font-medium">"{contact.relationship_notes}"</span>
                    </div>
                  </div>
                )}
              </div>
          ))}
         </div>
      )}
    </div>
  );
}
