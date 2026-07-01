const projectHealthService = require('../../services/projects/projectHealthService');

exports.generateHealthReport = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.user;

    const report = await projectHealthService.generateHealthReport(tenantId, projectId);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error('generateHealthReport error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getHealthReports = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.user;

    const reports = await projectHealthService.getReports(tenantId, projectId);
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    console.error('getHealthReports error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
