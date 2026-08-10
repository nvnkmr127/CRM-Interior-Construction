/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import layoutStyles from './ConfigLayout.module.css'
import styles from './LeadStagesManager.module.css'
import { Button, Badge, Modal, Input } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

const PRESET_COLOURS = [
  '#6B7280', '#1A3A5C', '#E8935A', '#2D6A4F', '#8B2020', '#4A2040',
  '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777', '#0891B2'
]

function SortableStage({ stage, updateStage, deleteStage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const [showPicker, setShowPicker] = useState(false)
  const [name, setName] = useState(stage.name)
  const [wipLimit, setWipLimit] = useState(stage.wipLimit ?? '')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const handleBlur = () => {
    const updates = {}
    if (name !== stage.name) updates.name = name
    
    let parsedLimit = wipLimit === '' ? null : parseInt(wipLimit, 10)
    if (isNaN(parsedLimit)) parsedLimit = null
    if (parsedLimit !== stage.wipLimit) updates.wip_limit = parsedLimit
    
    if (Object.keys(updates).length > 0) {
      updateStage(stage.id, updates)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.stageCard}>
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="6" cy="4" r="1.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="6" cy="12" r="1.5"/>
          <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="10" cy="12" r="1.5"/>
        </svg>
      </div>
      
      <div className={styles.colourDotWrapper}>
        <div 
          className={styles.colourDot} 
          style={{ background: stage.color || '#6B7280' }}
          onClick={() => setShowPicker(!showPicker)}
        />
        {showPicker && (
          <>
            <div className={styles.pickerBackdrop} onClick={() => setShowPicker(false)} />
            <div className={styles.colourPicker}>
              {PRESET_COLOURS.map(c => (
                <div 
                  key={c} 
                  className={styles.pickerDot} 
                  style={{ background: c }}
                  onClick={() => {
                    updateStage(stage.id, { color: c })
                    setShowPicker(false)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <input 
        className={styles.nameInput}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={handleBlur}
      />

      <div style={{display:'flex', alignItems:'center', gap:'4px', marginLeft:'8px'}}>
        <span style={{fontSize:'12px', color:'var(--color-text-secondary)'}}>WIP:</span>
        <input 
          type="number"
          className={styles.nameInput}
          style={{ width: '60px', padding: '2px 4px', fontSize: '12px' }}
          value={wipLimit}
          onChange={e => setWipLimit(e.target.value)}
          onBlur={handleBlur}
          placeholder="∞"
          min="0"
        />
      </div>

      {stage.requiredFields > 0 && (
        <span className={styles.chip}>{stage.requiredFields} required fields</span>
      )}

      {stage.isWon && <Badge variant="success">Is Won</Badge>}
      {stage.isLost && <Badge variant="danger">Is Lost</Badge>}

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => deleteStage(stage)}>
          Delete
        </Button>
      </div>
    </div>
  )
}

export default function LeadStagesManager() {
  const [stages, setStages] = useState([])
  const [stageToDelete, setStageToDelete] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newStageForm, setNewStageForm] = useState({ name: '', color: '#6B7280', wip_limit: '', is_won: false, is_lost: false, mandatory_fields: '' })
  const toast = useToast()

  useEffect(() => {
    fetchStages()
  }, [])

  const fetchStages = async () => {
    try {
      const res = await api.get('/config/lead-stages')
      const formatted = res.data.data.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        requiredFields: s.mandatory_fields ? s.mandatory_fields.length : 0,
        isWon: s.is_won,
        isLost: s.is_lost,
        wipLimit: s.wip_limit,
        leadCount: s.lead_count || 0 // Assuming backend might return this later, default 0
      }))
      setStages(formatted)
    } catch (err) {
      toast.error('Failed to fetch lead stages')
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex(i => i.id === active.id);
      const newIndex = stages.findIndex(i => i.id === over.id);
      const newItems = arrayMove(stages, oldIndex, newIndex);
      setStages(newItems);

      try {
        await api.patch('/config/lead-stages/reorder', { orderedIds: newItems.map(i => i.id) })
        toast.success('Stage order saved')
      } catch (err) {
        toast.error('Failed to save stage order')
      }
    }
  }

  const updateStage = async (id, updates) => {
    try {
      await api.put(`/config/lead-stages/${id}`, updates)
      setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s))
      toast.success('Stage updated')
    } catch (err) {
      toast.error('Failed to update stage')
    }
  }

  const addStage = () => {
    setNewStageForm({ name: '', color: '#6B7280', wip_limit: '', is_won: false, is_lost: false, mandatory_fields: '' })
    setIsAddOpen(true)
  }

  const handleCreateStage = async () => {
    if (!newStageForm.name.trim()) return toast.error('Stage name is required')
    try {
      const payload = {
        ...newStageForm,
        wip_limit: newStageForm.wip_limit ? parseInt(newStageForm.wip_limit, 10) : null,
        mandatory_fields: newStageForm.mandatory_fields ? newStageForm.mandatory_fields.split(',').map(f => f.trim()).filter(Boolean) : []
      }
      await api.post('/config/lead-stages', payload)
      toast.success('Stage created successfully')
      setIsAddOpen(false)
      fetchStages()
    } catch (err) {
      toast.error('Failed to create stage')
    }
  }

  const requestDelete = (stage) => {
    setStageToDelete(stage)
  }

  const confirmDelete = async () => {
    try {
      await api.delete(`/config/lead-stages/${stageToDelete.id}`)
      setStages(stages.filter(s => s.id !== stageToDelete.id))
      toast.success('Stage deleted')
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Cannot delete: Stage contains active leads.')
      } else {
        toast.error('Failed to delete stage')
      }
    } finally {
      setStageToDelete(null)
    }
  }

  return (
    <div className={`${layoutStyles.configSection} fade-in`}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Lead Stages</h2>
          <p className={layoutStyles.sectionDesc}>Define the stages in your sales pipeline.</p>
        </div>
        <Button variant="primary" onClick={addStage}>+ Add Stage</Button>
      </div>

      <div className={styles.list}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {stages.map(stage => (
              <SortableStage 
                key={stage.id} 
                stage={stage} 
                updateStage={updateStage}
                deleteStage={requestDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <Modal 
        isOpen={!!stageToDelete} 
        onClose={() => setStageToDelete(null)}
        title="Delete Stage"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStageToDelete(null)}>Cancel</Button>
            <Button variant="primary" style={{background:'var(--color-danger)', borderColor:'var(--color-danger)'}} onClick={confirmDelete}>
              Delete anyway
            </Button>
          </>
        }
      >
        {stageToDelete && stageToDelete.leadCount > 0 ? (
          <div style={{color:'var(--color-danger)', display:'flex', gap:'8px', alignItems:'center', background:'var(--color-danger-light, #fee2e2)', padding:'12px', borderRadius:'8px'}}>
            <span style={{fontSize:20}}>⚠</span>
            <span>{stageToDelete.leadCount} leads are in this stage. Move them first or they will be unassigned.</span>
          </div>
        ) : (
          <p>Are you sure you want to delete this stage?</p>
        )}
      </Modal>

      {/* Add Stage Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Lead Stage"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateStage}>Create Stage</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input 
            label="Stage Name" 
            placeholder="e.g. Qualified Lead" 
            value={newStageForm.name} 
            onChange={(e) => setNewStageForm({...newStageForm, name: e.target.value})} 
          />

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Stage Color
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PRESET_COLOURS.map(c => (
                <div 
                  key={c} 
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: c, cursor: 'pointer',
                    border: newStageForm.color === c ? '3px solid var(--color-surface)' : '2px solid transparent',
                    boxShadow: newStageForm.color === c ? `0 0 0 2px ${c}` : 'none'
                  }}
                  onClick={() => setNewStageForm({...newStageForm, color: c})}
                />
              ))}
            </div>
          </div>

          <Input 
            label="WIP Limit (optional)" 
            type="number"
            placeholder="Maximum leads allowed in this stage" 
            value={newStageForm.wip_limit} 
            onChange={(e) => setNewStageForm({...newStageForm, wip_limit: e.target.value})} 
          />

          <Input 
            label="Mandatory Fields (comma separated)" 
            placeholder="e.g. Budget, Timeframe" 
            value={newStageForm.mandatory_fields} 
            onChange={(e) => setNewStageForm({...newStageForm, mandatory_fields: e.target.value})} 
          />

          <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={newStageForm.is_won} 
                onChange={(e) => setNewStageForm({...newStageForm, is_won: e.target.checked, is_lost: e.target.checked ? false : newStageForm.is_lost})}
                style={{ width: '16px', height: '16px' }}
              />
              Is Won Stage
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={newStageForm.is_lost} 
                onChange={(e) => setNewStageForm({...newStageForm, is_lost: e.target.checked, is_won: e.target.checked ? false : newStageForm.is_won})}
                style={{ width: '16px', height: '16px' }}
              />
              Is Lost Stage
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
