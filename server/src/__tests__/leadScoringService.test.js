const { calculateLeadScore, shouldRerouteOnScoreChange } = require('../services/leadScoringService');

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

describe('Lead Scoring Service', () => {
  const getDaysAgoDate = (days) => new Date(Date.now() - days * MILLISECONDS_IN_DAY).toISOString();
  const getDaysFromNowDate = (days) => new Date(Date.now() + days * MILLISECONDS_IN_DAY).toISOString();

  it('Scenario 1: new hot lead', () => {
    // budget 10L+, full_home, referral, possession within 60 days, site_visit, floor plan
    const lead = {
      budget_max: 1200000, // +20
      scope: 'full_home', // +10
      source: 'referral', // +10
      possession_date: getDaysFromNowDate(30), // +20
      lead_activities: [
        { type: 'site_visit', created_at: new Date().toISOString() } // +15
      ],
      lead_files: [
        { file_type: 'floor_plan', file_name: 'layout_floor_plan.pdf' } // +8
      ],
      created_at: new Date().toISOString()
    };
    
    // Total expected: 20 + 10 + 10 + 20 + 15 + 8 = 83 -> hot
    const result = calculateLeadScore(lead);
    expect(result.score).toBe(83);
    expect(result.tier).toBe('hot');
    expect(result.breakdown.length).toBe(6);
  });

  it('Scenario 2: decayed hot→warm', () => {
    // Was hot but no activity for 10 days
    // 10 days ago -> 7+ days = -15, and 3 days decay = -6.
    // Total negative = -21
    // Let's give it initial base of 83 like previous test
    const lead = {
      budget_max: 1200000, // +20
      scope: 'full_home', // +10
      source: 'referral', // +10
      possession_date: getDaysFromNowDate(30), // +20
      lead_activities: [
        { type: 'site_visit', created_at: getDaysAgoDate(10) } // +15, but triggers 10 days decay
      ],
      lead_files: [
        { file_type: 'floor_plan', file_name: 'layout_floor_plan.pdf' } // +8
      ],
      created_at: getDaysAgoDate(15)
    };
    
    // Initial: 83. -15 (7+ days no activity) - 6 (decay) = 62 -> warm
    const result = calculateLeadScore(lead);
    expect(result.score).toBe(62);
    expect(result.tier).toBe('warm');
  });

  it('Scenario 3: dead lead with DNC', () => {
    // dnc_flag true (-30), budget < 1.5L (-20), no possession date (-5)
    const lead = {
      dnc_flag: true,
      budget_max: 100000,
      possession_date: null,
      lead_activities: [
        { type: 'email', created_at: new Date().toISOString() } // recent activity, so no decay penalty
      ],
      created_at: new Date().toISOString()
    };
    
    // Score expected: 0 (floored)
    const result = calculateLeadScore(lead);
    expect(result.score).toBe(0);
    expect(result.tier).toBe('dead');
  });

  it('Scenario 4: referral full-home lead', () => {
    // referral (+10), full home (+10), budget 6L (+12)
    const lead = {
      source: 'referral',
      scope: 'full_home',
      budget_max: 600000,
      possession_date: getDaysFromNowDate(200), // > 180 days -> 0 points, but no -5 penalty
      lead_activities: [
        { type: 'note', created_at: new Date().toISOString() } // recent activity
      ],
      created_at: new Date().toISOString()
    };
    
    // Score expected: 10 + 10 + 12 = 32 -> cold
    const result = calculateLeadScore(lead);
    expect(result.score).toBe(32);
    expect(result.tier).toBe('cold');
  });

  it('Scenario 5: cold nurture lead', () => {
    // some positive, but older activity
    // possession date within 61-180 days (+10)
    // 8 days since last activity (-15 for 7+ days, -2 for decay) = -17
    const lead = {
      possession_date: getDaysFromNowDate(100),
      budget_max: 400000, // 0 pts
      lead_activities: [
        { type: 'email', created_at: getDaysAgoDate(8) }
      ],
      created_at: getDaysAgoDate(20)
    };
    
    // Base: 10. Penalty: -17. Floored at 0 -> dead
    const result = calculateLeadScore(lead);
    expect(result.score).toBe(0);
    expect(result.tier).toBe('dead');
  });

  describe('shouldRerouteOnScoreChange', () => {
    it('returns appropriate actions for tier changes', () => {
      expect(shouldRerouteOnScoreChange('cold', 'hot').action).toBe('assign_to_senior');
      expect(shouldRerouteOnScoreChange('hot', 'warm').action).toBe('notify_manager');
      expect(shouldRerouteOnScoreChange('warm', 'cold').action).toBe('add_to_nurture_campaign');
      expect(shouldRerouteOnScoreChange('warm', 'dead').action).toBe('move_to_archive');
      expect(shouldRerouteOnScoreChange('warm', 'warm').action).toBe('none');
    });
  });
});
