const evaluateTrigger = require('../../services/automation/evaluateTrigger')

describe('evaluateTrigger', () => {
  const lead = { _entity: 'lead', source:'facebook', score:75, stage_id:'stage-1', custom_fields:{ budget:'>10L' } }

  it('returns true when trigger type matches and no conditions', () => {
    const rule = { trigger:{ type:'record.created', entity:'lead' }, conditions:[] }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(true)
  })

  it('returns false when trigger entity does not match', () => {
    const rule = { trigger:{ type:'record.created', entity:'project' }, conditions:[] }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(false)
  })

  it('evaluates eq condition correctly', () => {
    const rule = {
      trigger: { type:'record.created', entity:'lead' },
      conditions: [{ field:'source', operator:'eq', value:'facebook', logic:'AND' }]
    }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(true)
    const fail = { ...lead, source:'indimart' }
    expect(evaluateTrigger(rule, 'record.created', fail)).toBe(false)
  })

  it('evaluates gt condition on score', () => {
    const rule = {
      trigger: { type:'record.created', entity:'lead' },
      conditions: [{ field:'score', operator:'gt', value:'50', logic:'AND' }]
    }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(true)
    expect(evaluateTrigger(rule, 'record.created', { ...lead, score:30 })).toBe(false)
  })

  it('evaluates dot-notation custom_fields', () => {
    const rule = {
      trigger: { type:'record.created', entity:'lead' },
      conditions: [{ field:'custom_fields.budget', operator:'contains', value:'>10L', logic:'AND' }]
    }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(true)
  })

  it('returns false when trigger event type does not match', () => {
    const rule = { trigger:{ type:'field.changed', entity:'lead' }, conditions:[] }
    expect(evaluateTrigger(rule, 'record.created', lead)).toBe(false)
  })
})
