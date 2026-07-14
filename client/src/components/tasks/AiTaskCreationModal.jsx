import React, { useState } from 'react'
import { Modal, Button } from '../ui'
import { createGlobalTask } from '../../api/tasks'
import { useToast } from '../../store/toastContext'

export default function AiTaskCreationModal({ isOpen, onClose }) {
  const [step, setStep] = useState('input') // 'input', 'processing', 'preview'
  const [rawInput, setRawInput] = useState('')
  const [extractedData, setExtractedData] = useState(null)
  const [recording, setRecording] = useState(false)
  const toast = useToast()

  const handleSimulateRecording = () => {
    setRecording(true)
    setTimeout(() => {
      setRecording(false)
      setRawInput("Hey, can we schedule an urgent site visit for the Smith Project tomorrow? Please make sure to check the foundation, bring the blueprints, and confirm the client is available.")
      toast.success("Voice transcribed successfully")
    }, 2000)
  }

  const handleSimulateUpload = () => {
    setRawInput("FWD: WhatsApp Conversation\nClient: I need the electrical layout updated by Friday.\nManager: Ok, I will assign it as a high priority task.")
    toast.success("Audio/File transcribed successfully")
  }

  const runExtraction = () => {
    if (!rawInput.trim()) return
    setStep('processing')

    setTimeout(() => {
      const text = rawInput.toLowerCase()
      const data = {
        title: "Extracted Task: " + rawInput.substring(0, 30) + '...',
        description: rawInput,
        priority: 'medium',
        dueDate: '',
        assignee: 'Current User',
        customer: '',
        project: '',
        checklist: [],
      }

      // Very simple heuristic extraction for demonstration
      if (text.includes('urgent') || text.includes('asap')) data.priority = 'urgent'
      else if (text.includes('high')) data.priority = 'high'
      else if (text.includes('low')) data.priority = 'low'

      if (text.includes('tomorrow')) {
        const d = new Date(); d.setDate(d.getDate() + 1); data.dueDate = d.toISOString().split('T')[0]
      } else if (text.includes('friday')) {
        const d = new Date(); d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7); data.dueDate = d.toISOString().split('T')[0]
      }

      if (text.includes('smith project')) data.project = 'Smith Project'
      if (text.includes('electrical layout')) data.title = 'Update Electrical Layout'
      if (text.includes('site visit')) data.title = 'Site Visit'

      if (text.includes('check the foundation')) data.checklist.push({ id: Date.now()+1, title: 'Check foundation', done: false })
      if (text.includes('bring the blueprints')) data.checklist.push({ id: Date.now()+2, title: 'Bring blueprints', done: false })
      if (text.includes('confirm the client')) data.checklist.push({ id: Date.now()+3, title: 'Confirm client availability', done: false })

      setExtractedData(data)
      setStep('preview')
    }, 2000)
  }

  const handleSave = async () => {
    try {
      await createGlobalTask({
        title: extractedData.title,
        description: extractedData.description,
        priority: extractedData.priority,
        dueDate: extractedData.dueDate || null,
        status: 'todo',
        checklist: extractedData.checklist,
        tags: extractedData.project ? [extractedData.project] : []
      })
      toast.success('Task created successfully')
      window.dispatchEvent(new CustomEvent('globalTimeLogged')) // Force a global reload of MyTasksPage
      onClose()
    } catch (err) {
      toast.error('Failed to create task')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✨ AI Task Creator" size="lg">
      <div style={{ padding: '24px', minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
        
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="outline" onClick={handleSimulateRecording} style={{ flex: 1, background: recording ? 'rgba(var(--color-danger-rgb), 0.1)' : '', color: recording ? 'var(--color-danger)' : '' }}>
                {recording ? '🛑 Recording...' : '🎤 Speak Task'}
              </Button>
              <Button variant="outline" onClick={handleSimulateUpload} style={{ flex: 1 }}>
                📁 Upload Audio / File
              </Button>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Or Paste WhatsApp / Email context here:</label>
              <textarea 
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                placeholder="E.g., Forwarded message from client asking for the updated blueprints by tomorrow..."
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="primary" onClick={runExtraction} disabled={!rawInput.trim() || recording}>
                ✨ Extract & Process
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div style={{ margin: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', animation: 'pulse 1s ease-in-out infinite', marginBottom: '16px' }}>🧠</div>
            <h3 style={{ margin: '0 0 8px 0' }}>AI is extracting context...</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Parsing entities, intent, dates, and subtasks.</p>
          </div>
        )}

        {step === 'preview' && extractedData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <div style={{ background: 'rgba(var(--color-primary-rgb), 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(var(--color-primary-rgb), 0.2)', fontSize: '13px', color: 'var(--color-primary)', fontWeight: 500 }}>
              AI has structured your input into the following task format. Feel free to edit before saving.
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Task Title</label>
                  <input type="text" value={extractedData.title} onChange={e => setExtractedData({...extractedData, title: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
                  <textarea value={extractedData.description} onChange={e => setExtractedData({...extractedData, description: e.target.value})} style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px', resize: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Subtasks / Checklist</label>
                  {extractedData.checklist.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>No actionable subtasks detected.</div>
                  ) : (
                    <ul style={{ paddingLeft: '20px', margin: '8px 0 0 0', fontSize: '13px' }}>
                      {extractedData.checklist.map(c => (
                         <li key={c.id}>{c.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Priority</label>
                  <select value={extractedData.priority} onChange={e => setExtractedData({...extractedData, priority: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px' }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Due Date</label>
                  <input type="date" value={extractedData.dueDate} onChange={e => setExtractedData({...extractedData, dueDate: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Assignee</label>
                  <input type="text" value={extractedData.assignee} onChange={e => setExtractedData({...extractedData, assignee: e.target.value})} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Project Context</label>
                  <input type="text" value={extractedData.project} onChange={e => setExtractedData({...extractedData, project: e.target.value})} placeholder="None detected" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', marginTop: '4px' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <Button variant="outline" onClick={() => setStep('input')}>Back to Edit Input</Button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Create Task</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
      `}} />
    </Modal>
  )
}
