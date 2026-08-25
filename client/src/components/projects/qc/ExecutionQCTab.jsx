import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { Button, Badge, Card } from '../../ui';
import styles from './ExecutionQCTab.module.css';

export default function ExecutionQCTab({ projectId, project }) {
  const [templates, setTemplates] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedStageId, setSelectedStageId] = useState(null);
  
  // Exclude non-execution phases for the dropdown
  const executionPhases = project?.phases?.filter(p => p.name.toLowerCase().includes('execution')) || [];

  const loadData = async () => {
    setLoading(true);
    try {
      const [tplRes, stgRes] = await Promise.all([
        api.get('/qc/templates'),
        api.get(`/projects/${projectId}/qc`)
      ]);
      const fetchedTemplates = Array.isArray(tplRes.data?.data) ? tplRes.data.data : (Array.isArray(tplRes.data) ? tplRes.data : []);
      const fetchedStages = Array.isArray(stgRes.data?.data) ? stgRes.data.data : (Array.isArray(stgRes.data) ? stgRes.data : []);
      
      setTemplates(fetchedTemplates);
      setStages(fetchedStages);
      
      if (fetchedStages.length > 0) {
        setSelectedStageId(prev => {
          // Keep current selection if it still exists, otherwise default to first
          const exists = fetchedStages.some(s => s.id === prev);
          return exists ? prev : fetchedStages[0].id;
        });
      }
      
      if (executionPhases.length > 0) {
        setSelectedPhase(executionPhases[0].id);
      } else if (project?.phases?.length > 0) {
        setSelectedPhase(project.phases[project.phases.length - 1].id);
      }
    } catch (err) {
      console.error('Failed to load QC data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleInitializeStage = async () => {
    if (project?.status === 'completed') {
      alert('Cannot initialize QC checklists on a completed project.');
      return;
    }
    if (!selectedPhase || !selectedTemplate) {
      alert('Please select both a phase and a template to initialize.');
      return;
    }
    try {
      const res = await api.post(`/projects/${projectId}/qc`, {
        phaseId: selectedPhase,
        templateId: selectedTemplate
      });
      const newId = res.data?.data?.id || res.data?.id;
      if (newId) {
        setSelectedStageId(newId);
      }
      loadData();
      setSelectedTemplate('');
    } catch (err) {
      console.error('Failed to init stage', err);
      alert('Failed to add QC stage.');
    }
  };

  const handleUpdateItem = async (stageId, itemId, payload) => {
    if (project?.status === 'completed') {
      alert('Cannot update QC items on a completed project.');
      return;
    }
    try {
      await api.put(`/projects/${projectId}/qc/${stageId}/items/${itemId}`, payload);
      loadData();
    } catch (err) {
      console.error('Failed to update QC item', err);
      alert('Failed to update item.');
    }
  };

  const handleSignOff = async (stageId) => {
    if (project?.status === 'completed') {
      alert('Cannot sign off stages on a completed project.');
      return;
    }
    try {
      await api.post(`/projects/${projectId}/qc/${stageId}/sign-off`);
      loadData();
    } catch (err) {
      console.error('Failed to sign off stage', err);
      alert(err.response?.data?.error || 'Failed to sign off stage. Check if all items are passed and photos uploaded.');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading QC Data...</div>;

  const currentStage = stages.find(s => s.id === selectedStageId) || stages[0];

  return (
    <div className={styles.container}>
      {/* Left Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Quality Checklists</h3>
          {project?.status !== 'completed' && (
            <div className={styles.formContainer}>
              <select 
                value={selectedPhase} 
                onChange={e => setSelectedPhase(e.target.value)}
                className={styles.select}
              >
                <option value="">Select Phase</option>
                {project?.phases?.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                ))}
              </select>

              <select 
                value={selectedTemplate} 
                onChange={e => setSelectedTemplate(e.target.value)}
                className={styles.select}
              >
                <option value="">Select Template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.stage_name}</option>
                ))}
              </select>

              <Button variant="primary" size="sm" onClick={handleInitializeStage} style={{ width: '100%' }}>
                + Add Checklist
              </Button>
            </div>
          )}
        </div>

        <div className={styles.checklistList}>
          {stages.map(stage => {
            const phase = project?.phases?.find(p => p.id === stage.phase_id);
            const totalItems = stage.items?.length || 0;
            const passedItems = stage.items?.filter(i => i.is_passed === true).length || 0;
            const isActive = selectedStageId === stage.id || (!selectedStageId && stages[0]?.id === stage.id);

            return (
              <div 
                key={stage.id} 
                className={`${styles.sidebarItem} ${isActive ? styles.activeItem : ''}`}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <div className={styles.itemTitle}>
                  {stage.stage_name}
                  <Badge variant={stage.status === 'completed' ? 'success' : stage.status === 'in_progress' ? 'info' : 'warning'} size="sm">
                    {stage.status === 'completed' ? 'Signed Off' : stage.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className={styles.itemMeta}>
                  Phase: {phase ? phase.name : 'Unknown'}
                </div>
                <div className={styles.itemCounts}>
                  Passed: {passedItems}/{totalItems} items
                </div>
              </div>
            );
          })}
          {stages.length === 0 && (
            <div style={{ padding: '12px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No checklists initialized.
            </div>
          )}
        </div>
      </div>

      {/* Right Workspace */}
      <div className={styles.workspace}>
        {stages.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>Execution Stage Quality Control</h2>
            <p>No QC checklists have been initialized for this project yet. Use the sidebar controls to add checklists for your execution phases.</p>
          </div>
        ) : !currentStage ? (
          <div className={styles.emptyState}>
            <h2>Quality Control Checklist</h2>
            <p>Select a checklist from the sidebar to review items, upload photo evidence, and complete sign-offs.</p>
          </div>
        ) : (
          <>
            {/* Stage Detail Workspace */}
            {(() => {
              const phase = project?.phases?.find(p => p.id === currentStage.phase_id);
              const totalItems = currentStage.items?.length || 0;
              const passedItems = currentStage.items?.filter(i => i.is_passed === true).length || 0;

              return (
                <>
                  <div className={styles.stageHeader}>
                    <div className={styles.stageInfo}>
                      <h3 className={styles.stageTitle}>
                        {currentStage.stage_name}
                        <Badge variant={currentStage.status === 'completed' ? 'success' : currentStage.status === 'in_progress' ? 'info' : 'warning'}>
                          {currentStage.status.replace(/_/g, ' ')}
                        </Badge>
                      </h3>
                      <div className={styles.stageMeta}>
                        Phase: {phase ? phase.name : 'Unknown'} • Progress: {passedItems}/{totalItems} Items Passed
                      </div>
                    </div>
                    
                    {currentStage.status !== 'completed' && project?.status !== 'completed' && (
                      <Button 
                        variant="primary" 
                        onClick={() => handleSignOff(currentStage.id)}
                        disabled={passedItems !== totalItems}
                      >
                        Sign Off Stage
                      </Button>
                    )}
                    {currentStage.status === 'completed' && (
                      <div className={styles.signedOffText}>
                        Signed Off ✅
                      </div>
                    )}
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.checklistTable}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Checklist Item</th>
                          <th style={{ textAlign: 'center', width: '120px' }}>Pass/Fail</th>
                          <th style={{ textAlign: 'left' }}>Photo Evidence</th>
                          <th style={{ textAlign: 'left' }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentStage.items?.map(item => (
                          <tr key={item.id}>
                            <td>
                              {item.item_text} {item.is_photo_mandatory && <span className={styles.mandatoryStar}>*</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <select 
                                disabled={currentStage.status === 'completed' || project?.status === 'completed'}
                                value={item.is_passed === true ? 'pass' : item.is_passed === false ? 'fail' : ''}
                                onChange={(e) => {
                                  const val = e.target.value === 'pass' ? true : e.target.value === 'fail' ? false : null;
                                  handleUpdateItem(currentStage.id, item.id, { is_passed: val });
                                }}
                                className={`${styles.passFailSelect} ${item.is_passed === true ? styles.pass : item.is_passed === false ? styles.fail : ''}`}
                              >
                                <option value="">Select...</option>
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                              </select>
                            </td>
                            <td>
                              {item.photo_url ? (
                                <div className={styles.photoEvidenceContainer}>
                                  <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className={styles.evidenceLink}>View Photo</a>
                                  {currentStage.status !== 'completed' && project?.status !== 'completed' && (
                                    <button onClick={() => handleUpdateItem(currentStage.id, item.id, { photo_url: null })} className={styles.removePhotoBtn}>Remove</button>
                                  )}
                                </div>
                              ) : (
                                currentStage.status !== 'completed' && project?.status !== 'completed' && (
                                  <button onClick={() => {
                                    const url = prompt('Enter photo URL (Mock upload):');
                                    if (url) handleUpdateItem(currentStage.id, item.id, { photo_url: url });
                                  }} className={styles.uploadPhotoBtn}>
                                    Upload Photo
                                  </button>
                                )
                              )}
                            </td>
                            <td>
                              <input 
                                type="text" 
                                disabled={currentStage.status === 'completed' || project?.status === 'completed'}
                                value={item.notes || ''}
                                onChange={(e) => handleUpdateItem(currentStage.id, item.id, { notes: e.target.value })}
                                placeholder="Add notes..."
                                className={styles.notesInput}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
