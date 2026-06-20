const { findLeadById } = require('../repositories/leadRepository');
const { listActivities } = require('../services/activities/activityService');
const aiService = require('../services/aiService');

const getTenantAndUser = (req) => {
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user && req.user.userId;
  if (!tenantId) throw new Error('Tenant context missing');
  return { tenantId, userId };
};

exports.getLeadSummaryHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    const { data: activities } = await listActivities({ tenantId, leadId, limit: 20 });
    
    // Using analyzeLeadIntelligence as it provides a comprehensive summary
    const intel = await aiService.analyzeLeadIntelligence(lead, activities, [], lead.custom_fields || {});

    // Standardize to requested format
    res.json({
      summary: `Lead shows ${intel.sentiment} sentiment with ${intel.buyIntent} buying intent. Objections: ${intel.objections?.join(', ') || 'None'}.`,
      nextAction: intel.nextAction,
      sentiment: intel.sentiment,
      risk: intel.objections?.length > 0 ? 'medium' : 'low',
      confidence: (intel.winProbability / 100) || 0.50
    });
  } catch (error) {
    next(error);
  }
};

exports.getLeadScoreHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    const { data: activities } = await listActivities({ tenantId, leadId, limit: 10 });
    
    const intel = await aiService.analyzeLeadIntelligence(lead, activities, [], lead.custom_fields || {});

    res.json({
      score: intel.winProbability,
      buyIntent: intel.buyIntent,
      breakdown: intel.aiScoreBreakdown
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecommendationsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    const { data: activities } = await listActivities({ tenantId, leadId, limit: 1 });
    const lastActivityDate = activities.length > 0 ? activities[0].created_at : null;

    const recommendations = await aiService.generateFollowupRecommendations(lead, lastActivityDate);

    res.json(recommendations);
  } catch (error) {
    next(error);
  }
};

exports.copilotChatHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { leadId, message } = req.body;
    
    if (!message) return res.status(400).json({ success: false, error: { message: 'message is required' } });

    if (leadId) {
      const lead = await findLeadById(tenantId, leadId);
      if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
      const { data: activities } = await listActivities({ tenantId, leadId, limit: 20 });
      
      const response = await aiService.chatWithLeadContext(lead, activities, message);
      res.json({ reply: response });
    } else {
      // General CRM queries (stub for now, assuming Copilot can also answer general stats if built out)
      res.json({ reply: 'General CRM copilot chat not fully implemented. Please provide a leadId for context.' });
    }
  } catch (error) {
    next(error);
  }
};
