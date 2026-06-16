import React, { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import { Drawer, Button, Badge } from '../ui';
import ScoreBadge from './ScoreBadge';
import ActivityTimeline from './ActivityTimeline';
import ConvertToProjectModal from './ConvertToProjectModal';
import { getLead, changeLeadStage, deleteLead } from '../../api/leads';
import LeadForm from './LeadForm';
import api from '../../api/axios';
import styles from './LeadDrawer.module.css';

export default function LeadDrawer({ leadId, isOpen, onClose, onLeadUpdated, stages = [] }) {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingStage, setPendingStage] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLead();
    }
  }, [isOpen, leadId]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const res = await getLead(leadId);
      if (res.success) setLead(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };



  const handleStageSelect = (e) => {
    const newStageId = e.target.value;
    const stageInfo = stages.find(s => s.id === newStageId);
    if (!stageInfo) return;

    const missing = [];
    if (stageInfo.mandatory_fields) {
      stageInfo.mandatory_fields.forEach(f => {
        if (!lead[f] && (!lead.custom_fields || !lead.custom_fields[f])) {
          missing.push(f);
        }
      });
    }

    if (missing.length > 0) {
      setMissingFields(missing);
      setPendingStage(stageInfo);
      setErrorMsg(`Stage gate: ${missing.join(' and ')} are required to move to ${stageInfo.name}.`);
    } else {
      setMissingFields([]);
      setPendingStage(null);
      setErrorMsg(null);
      executeStageChange(newStageId);
    }
  };

  const executeStageChange = async (newStageId) => {
    const oldStageId = lead.stage_id;
    setLead(prev => ({ ...prev, stage_id: newStageId }));
    try {
      const res = await changeLeadStage(leadId, newStageId);
      if (res.success) {
        setLead(res.data);
        onLeadUpdated?.(res.data);
        toast.success(`Stage updated to ${stages.find(s => s.id === newStageId)?.name}`);
      }
    } catch (e) {
      setLead(prev => ({ ...prev, stage_id: oldStageId }));
      toast.error('Failed to update stage. Reverted.');
      setErrorMsg('Failed to update stage. Reverted.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('WARNING: Are you sure you want to PERMANENTLY delete this lead? This action cannot be undone.')) {
      try {
        await deleteLead(leadId);
        toast.success('Lead deleted successfully');
        onClose();
        if (onLeadUpdated) onLeadUpdated(null); // Signal deletion
        else window.location.reload();
      } catch (e) {
        toast.error('Failed to delete lead.');
        setErrorMsg('Failed to delete lead.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width="520px">
      {loading || !lead ? (
        <div className="p-4">Loading...</div>
      ) : (
        <>
          <div className={styles.header}>
            <div className={styles.nameRow}>
              <input 
                className={styles.leadName} 
                defaultValue={lead.name}
              />
              <ScoreBadge score={lead.score} />
              <Badge variant="accent">{lead.stage_name}</Badge>
              {lead.assignee_avatar && <img src={lead.assignee_avatar} alt="assignee" style={{width: 24, height: 24, borderRadius: '50%'}}/>}
            </div>
            <div className={styles.quickActions}>
              <Button variant="ghost" size="sm" leftIcon="📞">Call</Button>
              <Button variant="ghost" size="sm" leftIcon="📝">Note</Button>
              <Button variant="ghost" size="sm" leftIcon="✉">Email</Button>
              <Button variant="ghost" size="sm" leftIcon="📅">Schedule</Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
              <Button variant="ghost" size="sm" style={{color: 'var(--color-danger)', fontWeight: 'bold'}} aria-label={`Delete lead ${lead.name}`} onClick={handleDelete}>Delete</Button>
              {stages.find(s => s.id === lead.stage_id)?.is_won && (
                <Button variant="ghost" size="sm" leftIcon="→" onClick={() => setIsConvertModalOpen(true)}>Convert</Button>
              )}
            </div>
          </div>
          
          <div className={styles.body}>
            <div className={styles.sectionA}>
              <div className={styles.stageChange}>
                <label className={styles.label}>Change Stage</label>
                <select value={lead.stage_id} onChange={handleStageSelect} style={{padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)'}}>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {missingFields.length > 0 && (
                  <div className={styles.missingFields}>
                    <div className={styles.missingText}>⚠ Before moving to {pendingStage?.name}, fill in:</div>
                    <div className={styles.missingPills}>
                      {missingFields.map(f => <span key={f} className={styles.missingPill}>{f}</span>)}
                    </div>
                  </div>
                )}
                {errorMsg && <div style={{color: 'var(--color-danger)', fontSize: '12px'}}>{errorMsg}</div>}
              </div>

              <div className={styles.grid}>
                <div className={styles.field}><span className={styles.label}>Phone</span><span className={styles.value}>{lead.phone || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Email</span><span className={styles.value}>{lead.email || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Source</span><span className={styles.value}>{lead.source || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Budget</span><span className={styles.value}>{lead.custom_fields?.Budget || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Assignee</span><span className={styles.value}>{lead.assignee_name || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Created</span><span className={styles.value}>{new Date(lead.created_at).toLocaleDateString()}</span></div>
                <div className={styles.field}><span className={styles.label}>Stage</span><span className={styles.value}>{lead.stage_name || '-'}</span></div>
                <div className={styles.field}><span className={styles.label}>Score</span><span className={styles.value}>{lead.score || 0}</span></div>
              </div>
            </div>
            
            <div className={styles.sectionB}>
              <div style={{fontWeight: 600, fontSize: 'var(--text-md)'}}>Activity Timeline</div>
              <ActivityTimeline leadId={leadId} />
            </div>
          </div>

          {isConvertModalOpen && (
            <ConvertToProjectModal 
              lead={lead} 
              isOpen={isConvertModalOpen} 
              onClose={() => setIsConvertModalOpen(false)} 
            />
          )}

          {isEditing && (
            <LeadForm 
              lead={lead} 
              onClose={() => setIsEditing(false)} 
              onSave={(updatedLead) => {
                setLead(updatedLead);
                onLeadUpdated?.(updatedLead);
              }} 
            />
          )}
        </>
      )}
    </Drawer>
  );
}
