import React, { useState } from 'react'
import { Modal, Button } from '../ui'
import { useTaskAutomation } from '../../store/TaskAutomationContext'

export default function TaskAutomationsModal({ isOpen, onClose }) {
  const { rules, setRules, logs, clearLogs } = useTaskAutomation()
  const [activeTab, setActiveTab] = useState('rules') // 'rules', 'logs'
  const [editingRule, setEditingRule] = useState(null)

  const handleSaveRule = (rule) => {
    if (rule.id) {
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r))
    } else {
      setRules(prev => [{ ...rule, id: Date.now().toString() }, ...prev])
    }
    setEditingRule(null)
  }

  const handleDeleteRule = (id) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ Task Automations" size="lg">
      {!editingRule ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 24px' }}>
            <button 
              style={{ padding: '16px', background: 'none', border: 'none', borderBottom: activeTab === 'rules' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: activeTab === 'rules' ? 600 : 400, cursor: 'pointer' }}
              onClick={() => setActiveTab('rules')}
            >
              My Rules
            </button>
            <button 
              style={{ padding: '16px', background: 'none', border: 'none', borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: activeTab === 'logs' ? 600 : 400, cursor: 'pointer' }}
              onClick={() => setActiveTab('logs')}
            >
              Execution Logs
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--color-background)' }}>
            {activeTab === 'rules' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Active Rules ({rules.length})</h3>
                  <Button variant="primary" size="sm" onClick={() => setEditingRule({ name: 'New Rule', isActive: true, trigger: { type: 'task_updated' }, conditions: [], actions: [] })}>
                    + Create Rule
                  </Button>
                </div>
                
                {rules.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>
                    No automations configured. Create one to save time!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {rules.map(rule => (
                      <div key={rule.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {rule.name}
                            {!rule.isActive && <span style={{ fontSize: '10px', background: 'var(--color-border)', padding: '2px 6px', borderRadius: '10px' }}>Disabled</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            When {rule.trigger.type.replace('_', ' ')} → {rule.actions.length} action(s)
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button variant="outline" size="sm" onClick={() => setEditingRule(rule)}>Edit</Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteRule(rule.id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Logs</h3>
                  <Button variant="ghost" size="sm" onClick={clearLogs}>Clear Logs</Button>
                </div>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}>No logs yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {logs.map(log => (
                      <div key={log.id} style={{ background: 'var(--color-surface)', border: `1px solid ${log.status === 'error' ? 'var(--color-danger)' : 'var(--color-border)'}`, borderRadius: '4px', padding: '12px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{log.ruleName} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>on task</span> {log.taskTitle}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ color: log.status === 'error' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {log.status.toUpperCase()}: {log.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <RuleEditor rule={editingRule} onSave={handleSaveRule} onCancel={() => setEditingRule(null)} />
      )}
    </Modal>
  )
}

function RuleEditor({ rule, onSave, onCancel }) {
  const [draft, setDraft] = useState(rule)

  const updateDraft = (updates) => setDraft(prev => ({ ...prev, ...updates }))

  const handleAddCondition = () => {
    updateDraft({ conditions: [...draft.conditions, { field: 'status', operator: 'equals', value: '' }] })
  }
  
  const handleAddAction = () => {
    updateDraft({ actions: [...draft.actions, { type: 'change_status', value: '' }] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--color-background)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Rule Name</label>
          <input 
            type="text" 
            value={draft.name} 
            onChange={e => updateDraft({ name: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.isActive} onChange={e => updateDraft({ isActive: e.target.checked })} />
            Rule is Active
          </label>
        </div>

        <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <h4 style={{ margin: '0 0 16px 0' }}>WHEN (Trigger)</h4>
          <select 
            value={draft.trigger.type} 
            onChange={e => updateDraft({ trigger: { ...draft.trigger, type: e.target.value } })}
            style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px' }}
          >
            <option value="task_updated">Task is updated</option>
            <option value="status_changed">Status changes</option>
            <option value="schedule">Scheduled Time</option>
          </select>
          {draft.trigger.type === 'schedule' && (
            <input 
              type="time" 
              value={draft.trigger.value || ''}
              onChange={e => updateDraft({ trigger: { ...draft.trigger, value: e.target.value } })}
              style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px', marginTop: '8px' }}
            />
          )}
        </div>

        <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0 }}>IF (Conditions)</h4>
            <Button variant="outline" size="sm" onClick={handleAddCondition}>+ And</Button>
          </div>
          {draft.conditions.length === 0 && <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Always run</div>}
          {draft.conditions.map((cond, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select 
                value={cond.field}
                onChange={e => {
                  const nc = [...draft.conditions]; nc[idx].field = e.target.value; updateDraft({ conditions: nc })
                }}
                style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="status">Status</option>
                <option value="priority">Priority</option>
                <option value="tags">Tags</option>
              </select>
              <select 
                value={cond.operator}
                onChange={e => {
                  const nc = [...draft.conditions]; nc[idx].operator = e.target.value; updateDraft({ conditions: nc })
                }}
                style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Does Not Equal</option>
                <option value="contains">Contains</option>
                <option value="changed_to">Changed To</option>
              </select>
              <input 
                type="text" 
                value={cond.value}
                onChange={e => {
                  const nc = [...draft.conditions]; nc[idx].value = e.target.value; updateDraft({ conditions: nc })
                }}
                placeholder="Value"
                style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
              <Button variant="danger" size="sm" onClick={() => {
                const nc = draft.conditions.filter((_, i) => i !== idx); updateDraft({ conditions: nc })
              }}>×</Button>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0 }}>THEN (Actions)</h4>
            <Button variant="outline" size="sm" onClick={handleAddAction}>+ Action</Button>
          </div>
          {draft.actions.map((act, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select 
                value={act.type}
                onChange={e => {
                  const na = [...draft.actions]; na[idx].type = e.target.value; updateDraft({ actions: na })
                }}
                style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              >
                <option value="change_status">Change Status To</option>
                <option value="change_priority">Change Priority To</option>
                <option value="add_tag">Add Tag</option>
                <option value="notify_manager">Notify Manager</option>
                <option value="create_task">Create Follow-up Task</option>
              </select>
              {act.type !== 'notify_manager' && act.type !== 'create_task' && (
                <input 
                  type="text" 
                  value={act.value}
                  onChange={e => {
                    const na = [...draft.actions]; na[idx].value = e.target.value; updateDraft({ actions: na })
                  }}
                  placeholder="Value"
                  style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                />
              )}
              <Button variant="danger" size="sm" onClick={() => {
                const na = draft.actions.filter((_, i) => i !== idx); updateDraft({ actions: na })
              }}>×</Button>
            </div>
          ))}
        </div>

      </div>
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave(draft)}>Save Rule</Button>
      </div>
    </div>
  )
}
