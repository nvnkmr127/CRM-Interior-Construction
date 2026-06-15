import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { configApi } from '../../api/config';
import styles from './TemplateBuilder.module.css';

const DragIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

// Sortable Phase Row Component
function SortablePhase({ phase, index, updatePhase, removePhase, addMilestone, updateMilestone, removeMilestone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className={`${styles.phaseCard} ${isDragging ? styles.phaseDragging : ''}`}>
      <div className={styles.phaseHeader}>
        <div {...attributes} {...listeners} className={styles.dragHandle}>
          <DragIcon />
        </div>
        <div className={styles.col}>
          <input 
            className={styles.input} 
            value={phase.name} 
            onChange={(e) => updatePhase(phase.id, 'name', e.target.value)} 
            placeholder="Phase Name (e.g. Design)" 
          />
        </div>
        <div className={styles.col}>
          <input 
            type="number" 
            className={styles.input} 
            value={phase.duration_days} 
            onChange={(e) => updatePhase(phase.id, 'duration_days', parseInt(e.target.value) || 0)} 
            placeholder="Duration (Days)" 
          />
        </div>
        <button className={styles.actionBtn} onClick={() => removePhase(phase.id)} style={{color: 'var(--color-danger)'}}>
          <TrashIcon />
        </button>
      </div>

      <div className={styles.milestonesSection}>
        {phase.milestones.map((ms, mIdx) => (
          <div key={mIdx} className={styles.milestoneRow}>
            <input 
              className={styles.input} 
              style={{flex: 1}}
              value={ms.name} 
              onChange={(e) => updateMilestone(phase.id, mIdx, 'name', e.target.value)} 
              placeholder="Milestone Name" 
            />
            <label style={{fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px'}}>
              <input 
                type="checkbox" 
                checked={ms.triggers_payment} 
                onChange={(e) => updateMilestone(phase.id, mIdx, 'triggers_payment', e.target.checked)} 
              />
              Triggers Payment
            </label>
            <button className={styles.actionBtn} onClick={() => removeMilestone(phase.id, mIdx)}>✕</button>
          </div>
        ))}
        <button 
          className={styles.btnSecondary} 
          style={{alignSelf: 'flex-start', padding: '4px 8px', fontSize: '0.75rem'}} 
          onClick={() => addMilestone(phase.id)}
        >
          + Add Milestone
        </button>
      </div>
    </div>
  );
}


export default function TemplateBuilder() {
  const [templates, setTemplates] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    project_type: 'Residential',
    description: '',
    phases: []
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await configApi.getTemplates();
      setTemplates(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openForm = (template = null) => {
    if (template) {
      setEditingId(template.id);
      setFormData({
        name: template.name || '',
        project_type: template.project_type || 'Residential',
        description: template.description || '',
        phases: (template.phases || []).map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9) }))
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', project_type: 'Residential', description: '', phases: [] });
    }
    setView('form');
  };

  const handleSave = async () => {
    try {
      // Clean up internal React IDs before sending to Postgres
      const payload = {
        ...formData,
        phases: formData.phases.map(({ id, ...rest }) => rest)
      };

      if (editingId) {
        await configApi.updateTemplate(editingId, payload);
      } else {
        await configApi.createTemplate(payload);
      }
      setView('list');
      fetchTemplates();
    } catch (e) {
      alert('Failed to save template');
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this project template?')) {
      await configApi.deleteTemplate(id);
      fetchTemplates();
    }
  };

  // Phase Handlers
  const addPhase = () => {
    setFormData({
      ...formData,
      phases: [...formData.phases, { id: Math.random().toString(36).substr(2, 9), name: '', duration_days: 7, milestones: [] }]
    });
  };

  const updatePhase = (id, field, value) => {
    setFormData({
      ...formData,
      phases: formData.phases.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const removePhase = (id) => {
    setFormData({
      ...formData,
      phases: formData.phases.filter(p => p.id !== id)
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = formData.phases.findIndex(p => p.id === active.id);
      const newIndex = formData.phases.findIndex(p => p.id === over.id);
      setFormData({
        ...formData,
        phases: arrayMove(formData.phases, oldIndex, newIndex)
      });
    }
  };

  // Milestone Handlers
  const addMilestone = (phaseId) => {
    setFormData({
      ...formData,
      phases: formData.phases.map(p => {
        if (p.id === phaseId) {
          return { ...p, milestones: [...p.milestones, { name: '', triggers_payment: false }] };
        }
        return p;
      })
    });
  };

  const updateMilestone = (phaseId, mIdx, field, value) => {
    setFormData({
      ...formData,
      phases: formData.phases.map(p => {
        if (p.id === phaseId) {
          const newM = [...p.milestones];
          newM[mIdx][field] = value;
          return { ...p, milestones: newM };
        }
        return p;
      })
    });
  };

  const removeMilestone = (phaseId, mIdx) => {
    setFormData({
      ...formData,
      phases: formData.phases.map(p => {
        if (p.id === phaseId) {
          const newM = [...p.milestones];
          newM.splice(mIdx, 1);
          return { ...p, milestones: newM };
        }
        return p;
      })
    });
  };

  return (
    <div className={styles.container}>
      {view === 'list' && (
        <>
          <div className={styles.header}>
            <h2 className={styles.title}>Project Templates</h2>
            <button className={styles.btnPrimary} onClick={() => openForm()}>+ New Template</button>
          </div>
          
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Template Name</th>
                  <th className={styles.th}>Project Type</th>
                  <th className={styles.th}>Phases</th>
                  <th className={styles.th}>Total Duration</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => {
                  const totalDays = (t.phases || []).reduce((sum, p) => sum + (p.duration_days || 0), 0);
                  return (
                    <tr key={t.id}>
                      <td className={styles.td}><strong>{t.name}</strong></td>
                      <td className={styles.td}>{t.project_type}</td>
                      <td className={styles.td}>{(t.phases || []).length} phases</td>
                      <td className={styles.td}>{totalDays} days</td>
                      <td className={styles.td}>
                        <button className={styles.actionBtn} onClick={() => openForm(t)}>Edit</button>
                        <button className={styles.actionBtn} style={{color:'var(--color-danger)'}} onClick={() => handleDelete(t.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {templates.length === 0 && !loading && (
                  <tr><td colSpan="5" style={{padding: '20px', textAlign: 'center'}}>No templates found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'form' && (
        <div className={styles.formContainer}>
          <div className={styles.header} style={{borderBottom: 'none', paddingBottom: 0}}>
            <h2 className={styles.title}>{editingId ? 'Edit Template' : 'New Template'}</h2>
            <div style={{display:'flex', gap:'8px'}}>
              <button className={styles.btnSecondary} onClick={() => setView('list')}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave}>Save Template</button>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>Template Name</label>
              <input className={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Standard 2BHK Setup" />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>Project Type</label>
              <select className={styles.input} value={formData.project_type} onChange={e => setFormData({...formData, project_type: e.target.value})}>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Modular">Modular</option>
                <option value="Turnkey">Turnkey</option>
              </select>
            </div>
          </div>
          <div className={styles.col}>
            <label className={styles.label}>Description</label>
            <input className={styles.input} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className={styles.phasesSection}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 style={{margin: 0, fontSize: '1rem'}}>Project Phases</h3>
              <button className={styles.btnSecondary} onClick={addPhase}>+ Add Phase</button>
            </div>
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={formData.phases.map(p => p.id)} strategy={verticalListSortingStrategy}>
                {formData.phases.map((phase, index) => (
                  <SortablePhase 
                    key={phase.id} 
                    phase={phase} 
                    index={index} 
                    updatePhase={updatePhase}
                    removePhase={removePhase}
                    addMilestone={addMilestone}
                    updateMilestone={updateMilestone}
                    removeMilestone={removeMilestone}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {formData.phases.length === 0 && (
              <div style={{padding: '20px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-muted)'}}>
                No phases defined yet. Add a phase to build the project timeline.
              </div>
            )}
          </div>

          {/* Stepper Preview */}
          {formData.phases.length > 0 && (
            <div className={styles.previewSection}>
              <h3 style={{margin: 0, fontSize: '1rem'}}>Timeline Preview</h3>
              <div className={styles.stepperPreview}>
                {formData.phases.map((phase, i) => (
                  <div key={phase.id} className={styles.step}>
                    {i < formData.phases.length - 1 && <div className={styles.stepLine}></div>}
                    <div className={styles.stepCircle}>{i + 1}</div>
                    <div className={styles.stepTitle}>{phase.name || `Phase ${i+1}`}</div>
                    <div className={styles.stepDuration}>{phase.duration_days} days</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
