import React, { useState } from 'react';
import { Modal, Button, Checkbox, Input, Select } from '../ui';
import { bulkUpdateLeads } from '../../api/leads';
import { useToast } from '../../store/toastContext';

export default function LeadsBulkActionsModal({ isOpen, onClose, selectedLeadIds, filteredLeads, users, stages = [], onUpdateSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [massDelete, setMassDelete] = useState(false);
  const [markAsLost, setMarkAsLost] = useState(false);
  const [status, setStatus] = useState('');
  const [stageId, setStageId] = useState('');
  const [source, setSource] = useState('');
  const [lastContact, setLastContact] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'converted', label: 'Converted' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' }
  ];

  const stageOptions = stages.map(s => ({ value: s.id, label: s.name }));

  const sourceOptions = [
    { value: 'Website', label: 'Website' },
    { value: 'Facebook', label: 'Facebook' },
    { value: 'Referral', label: 'Referral' },
    { value: 'Direct', label: 'Direct' },
    { value: 'IndiaMART', label: 'IndiaMART' }
  ];

  const assignedOptions = users.map(u => ({ value: u.id, label: u.name }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updates = {};
    if (massDelete) {
      updates.massDelete = true;
    } else {
      if (markAsLost) {
        updates.markAsLost = true;
      } else if (status) {
        updates.status = status;
      }
      if (stageId) {
        updates.stageId = stageId;
      }
      if (source) {
        updates.source = source;
      }
      if (lastContact) {
        updates.lastContact = new Date(lastContact).toISOString();
      }
      if (assigneeId) {
        updates.assigneeId = assigneeId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return toast.error('Please select at least one action or field to update.');
    }

    setLoading(true);
    try {
      await bulkUpdateLeads(selectedLeadIds, updates);
      toast.success('Bulk action completed successfully');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk update failed:', err);
      toast.error(err.response?.data?.message || 'Failed to complete bulk updates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Actions">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Checkbox
            label="Mass Delete"
            checked={massDelete}
            onChange={(e) => {
              setMassDelete(e.target.checked);
              if (e.target.checked) setMarkAsLost(false);
            }}
          />
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border, #e5e7eb)', margin: '4px 0' }} />
          <Checkbox
            label="Mark as lost"
            checked={markAsLost}
            disabled={massDelete}
            onChange={(e) => {
              setMarkAsLost(e.target.checked);
              if (e.target.checked) setStatus('');
            }}
          />
        </div>

        <Select
          label="Change Status"
          options={statusOptions}
          value={status}
          onChange={setStatus}
          disabled={massDelete || markAsLost}
          placeholder="Nothing selected"
        />

        <Select
          label="Move Stage"
          options={stageOptions}
          value={stageId}
          onChange={setStageId}
          disabled={massDelete}
          placeholder="Nothing selected"
        />

        <Select
          label="Lead Source"
          options={sourceOptions}
          value={source}
          onChange={setSource}
          disabled={massDelete}
          placeholder="Nothing selected"
        />

        <Input
          type="date"
          label="Last Contact"
          value={lastContact}
          onChange={(e) => setLastContact(e.target.value)}
          disabled={massDelete}
        />

        <Select
          label="Assigned"
          options={assignedOptions}
          value={assigneeId}
          onChange={setAssigneeId}
          disabled={massDelete}
          placeholder="Nothing selected"
          searchable
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Confirm Bulk Action'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
