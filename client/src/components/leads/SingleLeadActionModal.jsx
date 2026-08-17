import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, Textarea } from '../ui';
import { updateLead, logActivity, deleteLead, convertToProject, getLead } from '../../api/leads';
import { useToast } from '../../store/toastContext';
import { useConfirm } from '../../store/confirmContext';

export default function SingleLeadActionModal({ isOpen, onClose, leadId, filteredLeads, users, stages = [], onUpdateSuccess }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState(null);

  // Form states
  const [status, setStatus] = useState('');
  const [stageId, setStageId] = useState('');
  const [source, setSource] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [nextActivityDate, setNextActivityDate] = useState('');

  // Quick activity log states
  const [activityType, setActivityType] = useState('note');
  const [activityNotes, setActivityNotes] = useState('');

  // Project conversion state
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [projectBudget, setProjectBudget] = useState('100000');
  const [projectStartDate, setProjectStartDate] = useState('');

  useEffect(() => {
    if (leadId && isOpen) {
      setLoading(true);
      getLead(leadId)
        .then(res => {
          if (res && res.success && res.data) {
            const l = res.data;
            setLead(l);
            setStatus(l.status || '');
            setStageId(l.stage_id || '');
            setSource(l.source || '');
            setAssigneeId(l.assignee_id || '');
            if (l.next_activity_at) {
              setNextActivityDate(new Date(l.next_activity_at).toISOString().split('T')[0]);
            }
          }
        })
        .catch(err => {
          console.error('Failed to fetch lead details:', err);
          toast.error('Failed to load lead details');
        })
        .finally(() => setLoading(false));
    }
  }, [leadId, isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!lead) return;

    setLoading(true);
    try {
      // 1. Update basic fields
      const updates = {
        status,
        stage_id: stageId,
        source,
        assignee_id: assigneeId === 'unassigned' ? null : assigneeId,
        next_activity_at: nextActivityDate ? new Date(nextActivityDate).toISOString() : null
      };
      await updateLead(leadId, updates);

      // 2. Log activity if notes are present
      if (activityNotes.trim()) {
        await logActivity(leadId, {
          type: activityType,
          notes: activityNotes
        });
      }

      toast.success('Lead updated successfully');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update lead:', err);
      toast.error(err.response?.data?.message || 'Failed to update lead');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsLost = async () => {
    const isConfirmed = await confirm({
      title: 'Mark Lead as Lost',
      message: 'Are you sure you want to mark this lead as lost?',
      confirmText: 'Mark as Lost',
      isDanger: true
    });
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await updateLead(leadId, { status: 'lost' });
      await logActivity(leadId, { type: 'note', notes: 'Lead marked as Lost via Actions panel.' });
      toast.success('Lead marked as lost');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Delete Lead',
      message: `Are you sure you want to delete lead "${lead?.name || ''}"? This action is permanent.`,
      confirmText: 'Delete',
      isDanger: true
    });
    if (!isConfirmed) return;

    setLoading(true);
    try {
      await deleteLead(leadId);
      toast.success('Lead deleted');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete lead');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: `${lead.name} - Construction Project`,
        budget: Number(projectBudget) || 100000,
        startDate: projectStartDate ? new Date(projectStartDate).toISOString() : new Date().toISOString(),
        timeline_weeks: 12
      };
      await convertToProject(leadId, payload);
      toast.success('Lead successfully converted to Project!');
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to convert lead:', err);
      toast.error(err.response?.data?.message || 'Failed to convert lead to project');
    } finally {
      setLoading(false);
    }
  };

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
  assignedOptions.unshift({ value: 'unassigned', label: 'Unassigned' });

  const activityOptions = [
    { value: 'note', label: 'Internal Note' },
    { value: 'call', label: 'Log Call' },
    { value: 'email', label: 'Log Email' },
    { value: 'whatsapp', label: 'Log WhatsApp' }
  ];

  if (!lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Lead Actions: ${lead.name}`}>
      {showConvertForm ? (
        <form onSubmit={handleConvertToProject} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>Convert Lead to Construction Project</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>This will automatically initialize a project workspace in CRM linked to this client.</p>
          
          <Input
            label="Project Estimated Budget (INR)"
            type="number"
            value={projectBudget}
            onChange={(e) => setProjectBudget(e.target.value)}
            required
          />

          <Input
            label="Estimated Start Date"
            type="date"
            value={projectStartDate}
            onChange={(e) => setProjectStartDate(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setShowConvertForm(false)} disabled={loading} type="button">
              Back
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Converting...' : 'Convert to Project'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Select
              label="Lead Status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <Select
              label="Pipeline Stage"
              options={stageOptions}
              value={stageId}
              onChange={setStageId}
            />
            <Select
              label="Lead Source"
              options={sourceOptions}
              value={source}
              onChange={setSource}
            />
            <Select
              label="Assigned Representative"
              options={assignedOptions}
              value={assigneeId}
              onChange={setAssigneeId}
              searchable
            />
          </div>

          <Input
            type="date"
            label="Next Contact Date"
            value={nextActivityDate}
            onChange={(e) => setNextActivityDate(e.target.value)}
          />

          <div style={{ background: 'var(--color-surface-2, #f9fafb)', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border, #e5e7eb)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>Quick Activity Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Select
                options={activityOptions}
                value={activityType}
                onChange={setActivityType}
              />
              <Textarea
                placeholder="Log activity details or client notes here..."
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: '1px solid var(--color-border, #e5e7eb)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="outline" type="button" onClick={() => setShowConvertForm(true)} disabled={loading} style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                ⭐ Convert
              </Button>
              <Button variant="outline" type="button" onClick={handleMarkAsLost} disabled={loading} style={{ border: '1px solid var(--color-warning)', color: '#d97706' }}>
                🪦 Lost
              </Button>
              <Button variant="outline" type="button" onClick={handleDelete} disabled={loading} style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
                🗑 Delete
              </Button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
