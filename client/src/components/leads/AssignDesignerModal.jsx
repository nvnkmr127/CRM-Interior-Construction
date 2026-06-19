import React, { useState, useEffect } from 'react';
import { Modal, Button, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function AssignDesignerModal({ leadId, currentAssigneeId, isOpen, onClose, onAssigned }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(currentAssigneeId || '');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      // Fetch all users or just designers. For now, fetch all users.
      const res = await api.get('/users?limit=50');
      if (res.data.success) {
        setUsers(res.data.data.map(u => ({
          value: u.id,
          label: `${u.name} (${u.role_name || 'User'})`
        })));
      }
    } catch (err) {
      toast.error('Failed to load designers');
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      return toast.error('Please select a user to assign.');
    }
    
    setLoading(true);
    try {
      const res = await api.patch(`/leads/${leadId}`, { assignee_id: selectedUserId });
      if (res.data.success) {
        toast.success('Lead reassigned successfully!');
        onAssigned(res.data.data);
        onClose();
      }
    } catch (err) {
      toast.error('Failed to reassign lead');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Designer / Manager"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAssign} disabled={loading || !selectedUserId}>
            {loading ? 'Assigning...' : 'Assign Lead'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <p className="text-sm text-gray-600">Select a team member to take ownership of this lead.</p>
        
        <Select
          label="Select Assignee"
          options={[{value:'', label:'Select team member...'}, ...users]}
          value={selectedUserId}
          onChange={setSelectedUserId}
        />
      </div>
    </Modal>
  );
}
