/**
 * Lead Scoring Service
 */

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates the score for a lead based on predefined rules.
 * Note: Whatsapp and phone call positive rules have been excluded as requested.
 * 
 * @param {Object} lead - The lead object.
 * @returns {{ score: number, tier: string, breakdown: Array<{signal: string, points: number}> }}
 */
function calculateLeadScore(lead) {
  let score = 0;
  const breakdown = [];

  const addPoints = (points, signal) => {
    score += points;
    breakdown.push({ signal, points });
  };

  const now = new Date();

  // --- POSITIVE SIGNALS ---
  
  if (lead.budget_max >= 1000000) {
    addPoints(20, 'budget_max >= 10L');
  } else if (lead.budget_max >= 500000 && lead.budget_max < 1000000) {
    addPoints(12, 'budget_max between 5L and 10L');
  }

  if (lead.possession_date) {
    const possessionDate = new Date(lead.possession_date);
    const daysToPossession = Math.floor((possessionDate - now) / MILLISECONDS_IN_DAY);
    if (daysToPossession >= 0 && daysToPossession <= 60) {
      addPoints(20, 'possession_date within 60 days');
    } else if (daysToPossession >= 61 && daysToPossession <= 180) {
      addPoints(10, 'possession_date within 61-180 days');
    }
  }

  const activities = lead.lead_activities || [];

  if (activities.some(a => a.type === 'site_visit')) {
    addPoints(15, 'site_visit activity logged');
  }

  if (lead.scope === 'full_home') {
    addPoints(10, 'scope is full_home');
  }

  if (lead.source === 'referral') {
    addPoints(10, 'source is referral');
  }

  const files = lead.lead_files || [];
  if (files.some(f => 
    (f.file_type && f.file_type.includes('floor_plan')) || 
    (f.file_name && f.file_name.toLowerCase().includes('floor plan'))
  )) {
    addPoints(8, 'floor plan file uploaded');
  }

  // --- NEGATIVE SIGNALS ---
  
  let lastActivityDate = lead.created_at ? new Date(lead.created_at) : now;
  if (activities.length > 0) {
    const activityDates = activities.map(a => new Date(a.created_at || now).getTime());
    lastActivityDate = new Date(Math.max(...activityDates));
  }
  
  const daysSinceLastActivity = Math.floor((now - lastActivityDate) / MILLISECONDS_IN_DAY);

  if (daysSinceLastActivity >= 7) {
    addPoints(-15, 'no activity for 7+ days');
  }

  const rescheduledCount = activities.filter(a => a.outcome === 'rescheduled').length;
  if (rescheduledCount >= 2) {
    addPoints(-10, '2+ rescheduled activities');
  }

  if (lead.budget_max != null && lead.budget_max < 150000) {
    addPoints(-20, 'budget_max < 1.5L');
  }

  if (lead.dnc_flag === true) {
    addPoints(-30, 'dnc_flag is true');
  }

  if (lead.competitor_mentioned) {
    addPoints(-8, 'competitor_mentioned is not null');
  }

  if (!lead.possession_date) {
    addPoints(-5, 'possession_date is null');
  }

  // --- DECAY RULE ---
  if (daysSinceLastActivity > 7) {
    const decayDays = daysSinceLastActivity - 7;
    const decayPoints = decayDays * -2;
    addPoints(decayPoints, `decay for ${decayDays} days beyond 7`);
  }

  // --- SCORE BOUNDARIES ---
  if (score < 0) {
    score = 0;
  } else if (score > 100) {
    score = 100;
  }

  // --- TIER ASSIGNMENT ---
  let tier = 'dead';
  if (score >= 80) tier = 'hot';
  else if (score >= 50) tier = 'warm';
  else if (score >= 20) tier = 'cold';

  return { score, tier, breakdown };
}

/**
 * Determines routing action based on tier changes.
 * @param {string} oldTier
 * @param {string} newTier
 * @returns {{ action: string, priority: string }}
 */
function shouldRerouteOnScoreChange(oldTier, newTier) {
  if (oldTier === newTier) {
    return { action: 'none', priority: 'low' };
  }

  if (newTier === 'hot') {
    return { action: 'assign_to_senior', priority: 'high' };
  }

  if (oldTier === 'hot' && newTier === 'warm') {
    return { action: 'notify_manager', priority: 'medium' };
  }

  if (newTier === 'dead') {
    return { action: 'move_to_archive', priority: 'low' };
  }

  if (newTier === 'cold') {
    return { action: 'add_to_nurture_campaign', priority: 'low' };
  }

  return { action: 'update_status_only', priority: 'low' };
}

module.exports = {
  calculateLeadScore,
  shouldRerouteOnScoreChange
};
