const logger = require('../../utils/logger');
const projectHealthService = require('../../services/projects/projectHealthService');
exports.generateHealthReport = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.user;

    const report = await projectHealthService.generateHealthReport(tenantId, projectId);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    logger.error('generateHealthReport error:', error);
    return next(error);
  }
};

exports.getHealthReports = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.user;

    const reports = await projectHealthService.getReports(tenantId, projectId);
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    logger.error('getHealthReports error:', error);
    return next(error);
  }
};
