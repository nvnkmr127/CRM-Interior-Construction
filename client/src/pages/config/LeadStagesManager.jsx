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
import { Button, Badge, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'

const PRESET_COLOURS = [
  '#6B7280', '#1A3A5C', '#E8935A', '#2D6A4F', '#8B2020', '#4A2040',
  '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777', '#0891B2'
]

function SortableStage({ stage, updateStage, deleteStage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const [showPicker, setShowPicker] = useState(false)
  const [name, setName] = useState(stage.name)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const handleBlur = () => {
    if (name !== stage.name) {
      updateStage(stage.id, { name })
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

      {stage.requiredFields > 0 && (
        <span className={styles.chip}>{stage.requiredFields} required fields</span>
      )}

      {stage.isWon && <Badge variant="success">Is Won</Badge>}
      {stage.isLost && <Badge variant="danger">Is Lost</Badge>}

      <div className={styles.actions}>
        <Button variant="ghost" size="sm">Edit</Button>
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
  const toast = useToast()

  useEffect(() => {
    setStages([
      { id: '1', name: 'New Lead', color: '#6B7280', requiredFields: 0, leadCount: 12 },
      { id: '2', name: 'Contacted', color: '#2563EB', requiredFields: 2, leadCount: 5 },
      { id: '3', name: 'Proposal Sent', color: '#D97706', requiredFields: 4, leadCount: 3 },
      { id: '4', name: 'Won', color: '#059669', requiredFields: 0, isWon: true, leadCount: 0 },
      { id: '5', name: 'Lost', color: '#DC2626', requiredFields: 0, isLost: true, leadCount: 0 }
    ])
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        toast.success('Stage order saved')
        return newItems;
      });
    }
  }

  const updateStage = (id, updates) => {
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const requestDelete = (stage) => {
    setStageToDelete(stage)
  }

  const confirmDelete = () => {
    setStages(stages.filter(s => s.id !== stageToDelete.id))
    setStageToDelete(null)
    toast.success('Stage deleted')
  }

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Lead Stages</h2>
          <p className={layoutStyles.sectionDesc}>Define the stages in your sales pipeline.</p>
        </div>
        <Button variant="primary">+ Add Stage</Button>
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
    </div>
  )
}
