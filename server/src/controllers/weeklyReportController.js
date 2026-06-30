const weeklyReportService = require('../services/projects/weeklyReportService');

exports.getWeeklyReports = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.user.tenantId;

    const reports = await weeklyReportService.getReportsByProject(tenantId, projectId);

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};
