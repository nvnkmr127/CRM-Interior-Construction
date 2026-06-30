const qcService = require('../services/projects/qcService');

async function getTemplates(req, res, next) {
  try {
    const templates = await qcService.getTemplates(req.user.tenant_id);
    res.json(templates);
  } catch (error) {
    next(error);
  }
}

async function getProjectQcStages(req, res, next) {
  try {
    const stages = await qcService.getProjectQcStages(req.user.tenant_id, req.params.projectId);
    res.json(stages);
  } catch (error) {
    next(error);
  }
}

async function initializeQcStage(req, res, next) {
  try {
    const { phaseId, templateId } = req.body;
    const stages = await qcService.initializeQcStage(
      req.user.tenant_id, 
      req.params.projectId, 
      phaseId, 
      templateId
    );
    res.status(201).json(stages);
  } catch (error) {
    if (error.message === 'Template not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

async function updateChecklistItem(req, res, next) {
  try {
    const { stageId, itemId } = req.params;
    const payload = {
      is_passed: req.body.is_passed,
      photo_url: req.body.photo_url,
      notes: req.body.notes,
      userId: req.user.id
    };
    const updatedItem = await qcService.updateChecklistItem(req.user.tenant_id, stageId, itemId, payload);
    res.json(updatedItem);
  } catch (error) {
    if (error.message === 'Item not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

async function signOffStage(req, res, next) {
  try {
    const { projectId, stageId } = req.params;
    const signedOffStage = await qcService.signOffStage(
      req.user.tenant_id, 
      projectId, 
      stageId, 
      req.user.id
    );
    res.json(signedOffStage);
  } catch (error) {
    if (error.message.startsWith('Cannot sign off')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Stage not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  getTemplates,
  getProjectQcStages,
  initializeQcStage,
  updateChecklistItem,
  signOffStage
};
