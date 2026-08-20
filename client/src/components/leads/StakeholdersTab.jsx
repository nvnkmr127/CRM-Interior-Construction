/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Input, Select, Textarea } from '../ui';
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
    // ONE-TIME DEFENSIVE PURGE: Wipes contacts to reset their state.
    try {
      const saved = localStorage.getItem('mockDatabase_v4');
      if (saved) {
        const db = JSON.parse(saved);
        if (db.contacts) {
          const originalLength = db.contacts.length;
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

  const getAvatarStyle = (role = '', authority = '') => {
    const cleanRole = role.toLowerCase();
    const cleanAuth = authority.toLowerCase();
    
    if (cleanAuth === 'primary' || cleanAuth === 'primary decision maker') {
      return {
        bg: 'linear-gradient(135deg, #FECFEF 0%, #FECFEF 100%)',
        color: '#E11D48',
        border: 'border-rose-200',
        icon: '👑'
      };
    }
    
    if (cleanRole.includes('spouse') || cleanRole.includes('wife') || cleanRole.includes('husband') || cleanRole.includes('partner')) {
      return {
        bg: 'linear-gradient(135deg, #FFE4E6 0%, #FECDD3 100%)',
        color: '#BE123C',
        border: 'border-rose-100',
        icon: '💍'
      };
    }
    
    if (cleanRole.includes('architect') || cleanRole.includes('designer')) {
      return {
        bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
        color: '#0369A1',
        border: 'border-sky-200',
        icon: '📐'
      };
    }

    if (cleanRole.includes('contractor') || cleanRole.includes('builder') || cleanRole.includes('engineer')) {
      return {
        bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        color: '#B45309',
        border: 'border-amber-200',
        icon: '🔨'
      };
    }

    // Default accent-themed style
    return {
      bg: 'linear-gradient(135deg, #FDF0E8 0%, #FCE0D1 100%)',
      color: '#C4813E',
      border: 'border-orange-100',
      icon: '👤'
    };
  };

  const authorityOptions = [
    { label: 'Primary Decision Maker', value: 'Primary' },
    { label: 'Influencer', value: 'Influencer' },
    { label: 'Consultant / Advisor', value: 'Consultant' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#E8935A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Stakeholders
          </h3>
          <p className="text-xs text-gray-500 mt-1">Manage family members, architects, and key decision makers.</p>
        </div>
        <Button onClick={async () => {
          setIsAdding(!isAdding);
          setEditingContactId(null);
        }} variant="primary" size="sm" className="shadow-sm">
          {isAdding ? 'Cancel' : '+ Add Stakeholder'}
        </Button>
      </div>
      
      {/* Add Form */}
      {isAdding && (
         <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl shadow-md border border-gray-150 relative overflow-hidden transition-all duration-300">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-[#E8935A]"></div>
             <h4 className="text-sm font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#E8935A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                Add New Stakeholder
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 mb-5">
               <Input 
                 label="Full Name" 
                 placeholder="E.g. Priya Sharma" 
                 value={newContact.name} 
                 onChange={e => setNewContact({...newContact, name: e.target.value})} 
                 required 
               />
               <Input 
                 label="Role / Title" 
                 placeholder="E.g. Spouse, Architect, Contractor" 
                 value={newContact.role} 
                 onChange={e => setNewContact({...newContact, role: e.target.value})} 
               />
               <Input 
                 label="Phone Number" 
                 placeholder="E.g. +91 9876543210" 
                 value={newContact.phone} 
                 onChange={e => setNewContact({...newContact, phone: e.target.value})} 
               />
               <Input 
                 label="Email Address" 
                 placeholder="email@example.com" 
                 value={newContact.email} 
                 onChange={e => setNewContact({...newContact, email: e.target.value})} 
               />
               <div className="md:col-span-2">
                 <Select 
                   label="Decision Authority" 
                   value={newContact.decision_authority} 
                   onChange={val => setNewContact({...newContact, decision_authority: val})} 
                   options={authorityOptions}
                 />
               </div>
               <div className="md:col-span-2">
                 <Textarea 
                   label="Relationship Notes" 
                   placeholder="Key details about this person's design tastes, preferences, or budget limits..." 
                   value={newContact.relationship_notes} 
                   onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})} 
                   rows={3}
                 />
               </div>
             </div>
             <div className="flex justify-end pt-4 border-t border-gray-100">
               <Button type="submit" variant="primary" size="md" className="shadow-sm">Save Stakeholder</Button>
             </div>
         </form>
      )}

      {/* Edit Form */}
      {editingContactId && (
         <form onSubmit={(e) => handleUpdate(e, editingContactId)} className="bg-white p-6 rounded-2xl shadow-md border border-gray-150 relative overflow-hidden transition-all duration-300">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C4813E]"></div>
             <h4 className="text-sm font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#C4813E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit Stakeholder
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 mb-5">
               <Input 
                 label="Full Name" 
                 placeholder="E.g. Priya Sharma" 
                 value={editContact.name} 
                 onChange={e => setEditContact({...editContact, name: e.target.value})} 
                 required 
               />
               <Input 
                 label="Role / Title" 
                 placeholder="E.g. Spouse, Architect" 
                 value={editContact.role} 
                 onChange={e => setEditContact({...editContact, role: e.target.value})} 
               />
               <Input 
                 label="Phone Number" 
                 placeholder="E.g. +91 9876543210" 
                 value={editContact.phone} 
                 onChange={e => setEditContact({...editContact, phone: e.target.value})} 
               />
               <Input 
                 label="Email Address" 
                 placeholder="email@example.com" 
                 value={editContact.email} 
                 onChange={e => setEditContact({...editContact, email: e.target.value})} 
               />
               <div className="md:col-span-2">
                 <Select 
                   label="Decision Authority" 
                   value={editContact.decision_authority} 
                   onChange={val => setEditContact({...editContact, decision_authority: val})} 
                   options={authorityOptions}
                 />
               </div>
               <div className="md:col-span-2">
                 <Textarea 
                   label="Relationship Notes" 
                   placeholder="Key details about this person's design tastes, preferences, or budget limits..." 
                   value={editContact.relationship_notes} 
                   onChange={e => setEditContact({...editContact, relationship_notes: e.target.value})} 
                   rows={3}
                 />
               </div>
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button type="button" variant="secondary" size="md" onClick={async () => setEditingContactId(null)}>Cancel</Button>
                  <Button type="submit" variant="primary" size="md" className="shadow-sm">Update Stakeholder</Button>
             </div>
         </form>
      )}

      {/* Contact List */}
      {loading ? (
         <div className="flex flex-col items-center justify-center py-16 text-gray-400">
           <svg className="w-8 h-8 animate-spin mb-3 text-[#E8935A]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <p className="font-medium text-xs">Loading stakeholders...</p>
         </div>
      ) : contacts.length === 0 ? (
         <div className="text-center py-16 text-gray-500 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
           <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
           <p className="text-sm font-bold text-gray-700">No stakeholders found</p>
           <p className="text-xs mt-1 mb-5 max-w-sm mx-auto text-gray-400">Keep track of everyone involved in this lead's decision-making process.</p>
           <Button onClick={async () => setIsAdding(true)} variant="outline" size="sm" className="shadow-sm">+ Add Stakeholder</Button>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map(contact => {
            const avatar = getAvatarStyle(contact.role, contact.decision_authority);
            
            return (
              <div key={contact.id} className="group p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 bg-white border border-gray-150 hover:border-orange-200 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/30 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-orange-100/30 transition-colors"></div>
                  
                  {/* Action Buttons (Edit / Delete) */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                    <button onClick={async () => handleEditClick(contact)} className="p-1 text-gray-400 hover:text-[#E8935A] hover:bg-orange-50 rounded-lg transition-colors cursor-pointer" title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={async () => handleDelete(contact.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Remove">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                  {/* Contact Header */}
                  <div className="flex items-start gap-3.5 mb-4 relative z-10">
                    <div 
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${avatar.border}`}
                      style={{ background: avatar.bg, color: avatar.color }}
                    >
                      {avatar.icon}
                    </div>
                    <div className="flex-1 pr-10">
                      <h4 className="font-bold text-gray-900 text-sm leading-snug mb-1">{contact.name}</h4>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {contact.role && (
                          <Badge variant="ghost" className="bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            {contact.role}
                          </Badge>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                          contact.decision_authority === 'Primary' || contact.decision_authority === 'Primary Decision Maker'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {contact.decision_authority === 'Primary' ? 'Primary' : contact.decision_authority}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Notes Block */}
                  {contact.relationship_notes && (
                    <div className="mb-4 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-650 italic relative z-10 leading-relaxed">
                      "{contact.relationship_notes}"
                    </div>
                  )}

                  {/* Actions / Comm links */}
                  <div className="space-y-2 relative z-10 pt-3.5 border-t border-gray-50">
                    {contact.phone && (
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium truncate mr-2">📞 {contact.phone}</span>
                        <div className="flex gap-1">
                          <a 
                            href={`tel:${contact.phone}`}
                            className="px-2 py-0.5 bg-orange-50 hover:bg-orange-100 text-[#E8935A] font-bold rounded-md text-[10px] transition-colors"
                          >
                            Call
                          </a>
                          <a 
                            href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-600 font-bold rounded-md text-[10px] transition-colors"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium truncate mr-2">✉️ {contact.email}</span>
                        <a 
                          href={`mailto:${contact.email}`}
                          className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-md text-[10px] transition-colors"
                        >
                          Email
                        </a>
                      </div>
                    )}
                    {!contact.phone && !contact.email && (
                      <span className="text-[10px] text-gray-400 italic">No communication details provided</span>
                    )}
                  </div>
              </div>
            );
          })}
         </div>
      )}
    </div>
  );
}
