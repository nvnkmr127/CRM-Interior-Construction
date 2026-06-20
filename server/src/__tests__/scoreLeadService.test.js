const { calculateAIScore } = require('../services/leads/scoreLeadService');

describe('scoreLeadService - Dynamic Health Score', () => {
  it('should calculate budget fit score correctly', () => {
    const lead = { budget_max: 500000, loan_approved: true };
    const result = calculateAIScore(lead);
    
    // Budget fit base is 10. Max > 0 adds 40. Loan adds 40.
    expect(result.ai_score_breakdown['Budget Fit']).toBe(90);
    // Base probability is 10 + 10 (budget) + 10 (loan) = 30
    // Then +20 for engagement default, etc.
  });

  it('should calculate timeline score based on possession date', () => {
    const today = new Date();
    const twoMonthsAway = new Date(today.getTime() + 60 * 24 * 3600 * 1000);
    const lead = { possession_date: twoMonthsAway.toISOString() };
    
    const result = calculateAIScore(lead);
    expect(result.ai_score_breakdown['Timeline']).toBe(80); // 10 base + 70
  });

  it('should calculate property readiness', () => {
    const lead = { house_status: 'ready' };
    const result = calculateAIScore(lead);
    
    expect(result.ai_score_breakdown['Property Readiness']).toBe(80); // 10 base + 70
  });

  it('should adjust for high engagement (low days_in_stage)', () => {
    const lead = { days_in_stage: 1 };
    const result = calculateAIScore(lead);
    
    expect(result.ai_score_breakdown['Engagement']).toBe(70); // 10 base + 60
    expect(result.ai_score_breakdown['Responsiveness']).toBe(70);
  });

  it('should apply risk penalties for competitors', () => {
    const lead = { competitor_mentioned: true };
    const result = calculateAIScore(lead);
    
    expect(result.ai_score_breakdown['Risk Level']).toBe(60); // 10 + 50
  });
});
