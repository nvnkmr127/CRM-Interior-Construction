import { Modal, Button } from '../ui'
import styles from './TaskRecurrenceModal.module.css'

export default function EditSeriesModal({ isOpen, onClose, onSelect }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editing a Recurring Task">
      <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--color-text)' }}>
        <p style={{ marginBottom: 16 }}>You are editing a recurring task. How would you like to apply these changes?</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button variant="outline" onClick={() => { onSelect('single'); onClose(); }} style={{ justifyContent: 'flex-start', height: 'auto', padding: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>This occurrence only</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>Apply changes to this single task. Future occurrences will not be affected.</div>
            </div>
          </Button>

          <Button variant="outline" onClick={() => { onSelect('future'); onClose(); }} style={{ justifyContent: 'flex-start', height: 'auto', padding: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>This and future occurrences</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>Apply changes to this task and all future instances in the series.</div>
            </div>
          </Button>

          <Button variant="outline" onClick={() => { onSelect('all'); onClose(); }} style={{ justifyContent: 'flex-start', height: 'auto', padding: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>The entire series</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>Apply changes to all past, present, and future tasks in this series.</div>
            </div>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
