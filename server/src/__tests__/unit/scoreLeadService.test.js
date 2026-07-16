const { scoreLead } = require('../../services/leads/scoreLeadService')

const rules = [
  { field:'source', operator:'eq',         value:'referral',    weight:20, is_active:true },
  { field:'source', operator:'eq',         value:'facebook',    weight:5,  is_active:true },
  { field:'phone',  operator:'is_not_empty',value:null,         weight:15, is_active:true },
  { field:'custom_fields.budget', operator:'contains', value:'>10L', weight:25, is_active:true },
  { field:'source', operator:'eq',         value:'cold_call',   weight:-10,is_active:true },
  { field:'email',  operator:'is_not_empty',value:null,         weight:5,  is_active:false }, // inactive
]

describe('scoreLead', () => {
  it('scores 0 for empty lead', () => {
    expect(scoreLead({}, rules).score).toBe(0)
  })

  it('adds weight for matching source', () => {
    expect(scoreLead({ source:'referral', phone:'9876543210' }, rules).score).toBe(35) // 20+15
  })

  it('adds weight for facebook source', () => {
    expect(scoreLead({ source:'facebook' }, rules).score).toBe(5)
  })

  it('adds weight for non-empty phone', () => {
    expect(scoreLead({ phone:'9876543210' }, rules).score).toBe(15)
  })

  it('adds weight for budget custom field containing >10L', () => {
    const lead = { source:'referral', phone:'9876543210', custom_fields:{ budget:'>10L' } }
    expect(scoreLead(lead, rules).score).toBe(60) // 20+15+25
  })

  it('subtracts weight for cold_call source', () => {
    expect(scoreLead({ source:'cold_call', phone:'9876543210' }, rules).score).toBe(5) // 15-10
  })

  it('does not apply inactive rules', () => {
    // email rule is inactive — email should not add 5
    const lead = { email:'test@test.com', phone:'9876543210' }
    expect(scoreLead(lead, rules).score).toBe(15) // only phone
  })

  it('clamps score to 0 minimum', () => {
    const negRules = [{ field:'source', operator:'eq', value:'spam', weight:-200, is_active:true }]
    expect(scoreLead({ source:'spam' }, negRules).score).toBe(0)
  })

  it('clamps score to 100 maximum', () => {
    const bigRules = [{ field:'source', operator:'eq', value:'vip', weight:999, is_active:true }]
    expect(scoreLead({ source:'vip' }, bigRules).score).toBe(100)
  })
})
