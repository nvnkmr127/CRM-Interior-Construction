/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function StakeholdersTab({ leadId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
  const [editingContactId, setEditingContactId] = useState(null);
  const [editContact, setEditContact] = useState({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
  const toast = useToast();

  useEffect(() => {
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
    if (!window.confirm('Remove this stakeholder?')) return;
    try {
      await api.delete(`/leads/${leadId}/contacts/${id}`);
      setContacts(contacts.filter(c => c.id !== id));
      toast.success('Stakeholder removed');
    } catch (e) {
      toast.error('Failed to remove stakeholder');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Stakeholders</h3>
        <Button onClick={() => setIsAdding(!isAdding)} variant="outline" size="sm">
          {isAdding ? 'Cancel' : '+ Add Stakeholder'}
        </Button>
      </div>
      
      {isAdding && (
         <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-xl border space-y-3">
             <Input placeholder="Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} required />
             <Input placeholder="Role" value={newContact.role} onChange={e => setNewContact({...newContact, role: e.target.value})} />
             <Input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
             <Input placeholder="Email" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
             <Select value={newContact.decision_authority} onChange={e => setNewContact({...newContact, decision_authority: e.target.value})}>
                 <option>Primary</option>
                 <option>Influencer</option>
             </Select>
             <Input placeholder="Notes" value={newContact.relationship_notes} onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})} />
             <Button type="submit">Save</Button>
         </form>
      )}

      {editingContactId && (
         <form onSubmit={(e) => handleUpdate(e, editingContactId)} className="bg-gray-50 p-4 rounded-xl border space-y-3">
             <Input placeholder="Name" value={editContact.name} onChange={e => setEditContact({...editContact, name: e.target.value})} required />
             <Input placeholder="Role" value={editContact.role} onChange={e => setEditContact({...editContact, role: e.target.value})} />
             <Input placeholder="Phone" value={editContact.phone} onChange={e => setEditContact({...editContact, phone: e.target.value})} />
             <Input placeholder="Email" value={editContact.email} onChange={e => setEditContact({...editContact, email: e.target.value})} />
             <Select value={editContact.decision_authority} onChange={e => setEditContact({...editContact, decision_authority: e.target.value})}>
                 <option>Primary</option>
                 <option>Influencer</option>
             </Select>
             <Input placeholder="Notes" value={editContact.relationship_notes} onChange={e => setEditContact({...editContact, relationship_notes: e.target.value})} />
             <div className="flex gap-2">
                 <Button type="submit">Update</Button>
                 <Button type="button" variant="outline" onClick={() => setEditingContactId(null)}>Cancel</Button>
             </div>
         </form>
      )}

      {loading ? (
         <div className="text-gray-500 text-sm">Loading...</div>
      ) : contacts.length === 0 ? (
         <div className="text-gray-500 text-sm italic">No stakeholders found.</div>
      ) : (
         <div className="space-y-3">
          {contacts.map(contact => (
            <div key={contact.id} className="border p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => handleEditClick(contact)} className="text-gray-400 hover:text-blue-500">
                    <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleDelete(contact.id)}
                    className="text-gray-400 hover:text-red-500 font-bold text-sm"
                    title="Remove"
                  >&times;</button>
                </div>
                
                <div className="flex justify-between items-start mb-2 pr-12">
                  <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                  {contact.role && <Badge variant="secondary">{contact.role}</Badge>}
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {contact.phone && <div className="flex items-center gap-2"><span style={{ display: 'inline-flex', color: 'var(--color-text-secondary)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span> {contact.phone}</div>}
                  {contact.email && <div className="flex items-center gap-2"><span>✉️</span> {contact.email}</div>}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full ${contact.decision_authority === 'Primary' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {contact.decision_authority}
                  </span>
                  {contact.relationship_notes && <span className="text-gray-500 italic truncate" title={contact.relationship_notes}>"{contact.relationship_notes}"</span>}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
