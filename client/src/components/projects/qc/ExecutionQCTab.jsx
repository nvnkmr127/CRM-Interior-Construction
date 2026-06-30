import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { Button, Badge, Card } from '../../ui';

export default function ExecutionQCTab({ projectId, project }) {
  const [templates, setTemplates] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  
  // Exclude non-execution phases for the dropdown
  const executionPhases = project?.phases?.filter(p => p.name.toLowerCase().includes('execution')) || [];

  const loadData = async () => {
    setLoading(true);
    try {
      const [tplRes, stgRes] = await Promise.all([
        api.get('/qc/templates'),
        api.get(`/projects/${projectId}/qc`)
      ]);
      setTemplates(tplRes.data || []);
      setStages(stgRes.data || []);
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
    if (!selectedPhase || !selectedTemplate) {
      alert('Please select both a phase and a template to initialize.');
      return;
    }
    try {
      await api.post(`/projects/${projectId}/qc`, {
        phaseId: selectedPhase,
        templateId: selectedTemplate
      });
      loadData();
      setSelectedTemplate('');
    } catch (err) {
      console.error('Failed to init stage', err);
      alert('Failed to add QC stage.');
    }
  };

  const handleUpdateItem = async (stageId, itemId, payload) => {
    try {
      await api.put(`/projects/${projectId}/qc/${stageId}/items/${itemId}`, payload);
      loadData();
    } catch (err) {
      console.error('Failed to update QC item', err);
      alert('Failed to update item.');
    }
  };

  const handleSignOff = async (stageId) => {
    try {
      await api.post(`/projects/${projectId}/qc/${stageId}/sign-off`);
      loadData();
    } catch (err) {
      console.error('Failed to sign off stage', err);
      alert(err.response?.data?.error || 'Failed to sign off stage. Check if all items are passed and photos uploaded.');
    }
  };

  if (loading) return <div>Loading QC Data...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Execution Stage QC Checklists</h2>
      </div>

      {/* Add new Stage Form */}
      <Card style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 'var(--text-md)' }}>Add QC Stage to Phase</h3>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select 
            value={selectedPhase} 
            onChange={e => setSelectedPhase(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          >
            <option value="">Select Phase</option>
            {project?.phases?.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
            ))}
          </select>

          <select 
            value={selectedTemplate} 
            onChange={e => setSelectedTemplate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          >
            <option value="">Select QC Template</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.stage_name}</option>
            ))}
          </select>

          <Button variant="primary" onClick={handleInitializeStage}>
            Add Checklist
          </Button>
        </div>
      </Card>

      {/* List Stages */}
      {stages.length === 0 ? (
        <Card style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No QC checklists initialized for this project yet.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {stages.map(stage => {
            const phase = project?.phases?.find(p => p.id === stage.phase_id);
            const totalItems = stage.items?.length || 0;
            const passedItems = stage.items?.filter(i => i.is_passed === true).length || 0;
            
            return (
              <Card key={stage.id} style={{ padding: '20px', borderLeft: stage.status === 'completed' ? '4px solid var(--color-success)' : '4px solid var(--color-warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {stage.stage_name}
                      <Badge variant={stage.status === 'completed' ? 'success' : stage.status === 'in_progress' ? 'info' : 'warning'}>
                        {stage.status.replace(/_/g, ' ')}
                      </Badge>
                    </h3>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                      Phase: {phase ? phase.name : 'Unknown'} • Progress: {passedItems}/{totalItems} Items Passed
                    </div>
                  </div>
                  
                  {stage.status !== 'completed' && (
                    <Button 
                      variant="primary" 
                      onClick={() => handleSignOff(stage.id)}
                      disabled={passedItems !== totalItems}
                    >
                      Sign Off Stage
                    </Button>
                  )}
                  {stage.status === 'completed' && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                      Signed Off ✅
                    </div>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--text-xs)' }}>Checklist Item</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: 'var(--text-xs)', width: '100px' }}>Pass/Fail</th>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--text-xs)' }}>Photo Evidence</th>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: 'var(--text-xs)' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stage.items?.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px', fontSize: 'var(--text-sm)' }}>
                          {item.item_text} {item.is_photo_mandatory && <span style={{color:'red'}}>*</span>}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <select 
                            disabled={stage.status === 'completed'}
                            value={item.is_passed === true ? 'pass' : item.is_passed === false ? 'fail' : ''}
                            onChange={(e) => {
                              const val = e.target.value === 'pass' ? true : e.target.value === 'fail' ? false : null;
                              handleUpdateItem(stage.id, item.id, { is_passed: val });
                            }}
                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)',
                                     background: item.is_passed === true ? 'var(--color-success-bg)' : item.is_passed === false ? 'var(--color-danger-bg)' : 'transparent',
                                     color: item.is_passed === true ? 'var(--color-success)' : item.is_passed === false ? 'var(--color-danger)' : 'inherit' }}
                          >
                            <option value="">Select...</option>
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {item.photo_url ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <a href={item.photo_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-xs)' }}>View Photo</a>
                              {stage.status !== 'completed' && (
                                <button onClick={() => handleUpdateItem(stage.id, item.id, { photo_url: null })} style={{background:'none', border:'none', color:'red', cursor:'pointer', fontSize:'10px'}}>Remove</button>
                              )}
                            </div>
                          ) : (
                            stage.status !== 'completed' && (
                              <button onClick={() => {
                                const url = prompt('Enter photo URL (Mock upload):');
                                if (url) handleUpdateItem(stage.id, item.id, { photo_url: url });
                              }} style={{ fontSize: 'var(--text-xs)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
                                Upload Photo
                              </button>
                            )
                          )}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <input 
                            type="text" 
                            disabled={stage.status === 'completed'}
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItem(stage.id, item.id, { notes: e.target.value })}
                            placeholder="Add notes..."
                            style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
