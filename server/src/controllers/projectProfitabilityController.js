const ProjectProfitabilityService = require('../services/projects/projectProfitabilityService');
const { catchAsync } = require('../utils/errorHandler');
const AppError = require('../utils/appError');

class ProjectProfitabilityController {
  static getProjectProfitability = catchAsync(async (req, res) => {
    const { tenantId } = req.user;
    const { projectId } = req.params;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    const profitability = await ProjectProfitabilityService.getProjectProfitability(tenantId, projectId);

    res.status(200).json({
      status: 'success',
      data: profitability || null
    });
  });

  static getProjectLedger = catchAsync(async (req, res) => {
    const { tenantId } = req.user;
    const { projectId } = req.params;

    if (!projectId) {
      throw new AppError('Project ID is required', 400);
    }

    const ledger = await ProjectProfitabilityService.getProjectLedger(tenantId, projectId);

    res.status(200).json({
      status: 'success',
      results: ledger.length,
      data: ledger
    });
  });
}

module.exports = ProjectProfitabilityController;
