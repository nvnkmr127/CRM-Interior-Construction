const { getPaymentMilestones } = require('../../services/projects/paymentMilestoneService');
const pool = require('../../db/pool');

jest.mock('../../db/pool', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/finance', () => ({
  getTenantThreshold: jest.fn(),
  isUserSuperadmin: jest.fn()
}));

jest.mock('../../services/auditLog', () => ({
  logAction: jest.fn()
}));

describe('paymentMilestoneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPaymentMilestones', () => {
    it('should return a list of payment milestones for a project', async () => {
      const mockMilestones = [
        { id: '1', name: 'Advance', amount: 1000 },
        { id: '2', name: 'Completion', amount: 5000 }
      ];
      
      pool.query.mockResolvedValueOnce({ rows: mockMilestones });
      
      const tenantId = 'tenant-123';
      const projectId = 'proj-456';
      
      const result = await getPaymentMilestones({ tenantId, projectId });
      
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT pm.*, m.name as linked_milestone_name'),
        [tenantId, projectId]
      );
      expect(result).toEqual(mockMilestones);
    });
  });
});
