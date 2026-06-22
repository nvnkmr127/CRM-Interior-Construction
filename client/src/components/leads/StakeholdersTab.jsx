import React, { useState, useEffect } from 'react';
import { Button, Badge, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function StakeholdersTab({ leadId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', role: '', decision_authority: 'Influencer', relationship_notes: '' });
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

  if (loading) return <div className="p-6 text-gray-500">Loading stakeholders...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Project Stakeholders</h3>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : '+ Add Stakeholder'}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Name" 
              value={newContact.name} 
              onChange={e => setNewContact({...newContact, name: e.target.value})} 
              required 
            />
            <Input 
              label="Role (e.g. Spouse, Architect)" 
              value={newContact.role} 
              onChange={e => setNewContact({...newContact, role: e.target.value})} 
            />
            <Input 
              label="Phone" 
              value={newContact.phone} 
              onChange={e => setNewContact({...newContact, phone: e.target.value})} 
            />
            <Input 
              type="email" 
              label="Email" 
              value={newContact.email} 
              onChange={e => setNewContact({...newContact, email: e.target.value})} 
            />
            <Select 
              label="Authority" 
              value={newContact.decision_authority} 
              onChange={val => setNewContact({...newContact, decision_authority: val})}
              options={[
                { label: 'Primary Decision Maker', value: 'Primary' },
                { label: 'Influencer', value: 'Influencer' },
                { label: 'Consultant', value: 'Consultant' }
              ]}
            />
            <Input 
              label="Notes" 
              value={newContact.relationship_notes} 
              onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})} 
            />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" type="submit">Save Stakeholder</Button>
          </div>
        </form>
      )}

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 border border-dashed rounded">
          No stakeholders added yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contacts.map(contact => (
            <div key={contact.id} className="border border-gray-200 rounded-lg p-4 bg-white relative hover:shadow-sm transition-shadow">
              <button 
                onClick={() => handleDelete(contact.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 font-bold"
                title="Remove"
              >&times;</button>
              
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                {contact.role && <Badge variant="secondary">{contact.role}</Badge>}
              </div>
              
              <div className="text-sm text-gray-600 mb-3">
                {contact.phone && <div className="flex items-center gap-2"><span>📞</span> {contact.phone}</div>}
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
