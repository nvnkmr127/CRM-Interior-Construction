const ProjectProfitabilityService = require('../services/projects/projectProfitabilityService');
const AppError = require('../utils/AppError');

class ProjectProfitabilityController {
  static getProjectProfitability = async (req, res, next) => {
    try {
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
    } catch (err) {
      next(err);
    }
  };

  static getProjectLedger = async (req, res, next) => {
    try {
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
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ProjectProfitabilityController;
