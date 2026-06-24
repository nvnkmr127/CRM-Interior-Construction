const pool = require('../db/pool');
const { success, fail, paginate } = require('../utils/response');
const { changeStage } = require('../services/leads/changeStage');

function getTenantAndUser(req) {
  return {
    tenantId: req.tenantId || (req.user && req.user.tenantId),
    userId: req.userId || (req.user && req.user.id)
  };
}

exports.changeStageHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { stageId } = req.body;
    if (!stageId) return fail(res, 'VALIDATION_ERROR', 'stageId is required', 400);
    const updatedLead = await changeStage({ tenantId, userId, leadId, newStageId: stageId });
    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') return res.status(422).json({ success: false, error: { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields', missing: error.missing } });
    next(error);
  }
};

exports.convertToProjectHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
