const pool = require('../../db/pool');

class DashboardStats {
  static async getFinancialApprovalStats(tenantId) {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as "pendingApprovals",
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as "pendingAmount",
        COUNT(*) FILTER (WHERE status = 'approved' AND updated_at::date = CURRENT_DATE) as "approvedToday",
        COUNT(*) FILTER (WHERE status = 'approved' AND updated_at::date = CURRENT_DATE - INTERVAL '1 day') as "approvedYesterday",
        COUNT(*) FILTER (WHERE status = 'rejected' AND updated_at::date = CURRENT_DATE) as "rejectedToday",
        COUNT(*) FILTER (WHERE status = 'rejected' AND updated_at::date = CURRENT_DATE - INTERVAL '1 day') as "rejectedYesterday",
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as "totalApprovedAmount",
        COALESCE(SUM(amount) FILTER (WHERE status = 'rejected'), 0) as "totalRejectedAmount",
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600) FILTER (WHERE status = 'approved') as "averageApprovalTime",
        COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '48 hours') as "overdueApprovals"
      FROM financial_approvals
      WHERE tenant_id = $1
    `;
    
    const { rows } = await pool.query(query, [tenantId]);
    const stats = rows[0] || {};
    
    return {
      pendingApprovals: parseInt(stats.pendingApprovals || 0, 10),
      pendingAmount: parseFloat(stats.pendingAmount || 0),
      approvedToday: parseInt(stats.approvedToday || 0, 10),
      approvedYesterday: parseInt(stats.approvedYesterday || 0, 10),
      rejectedToday: parseInt(stats.rejectedToday || 0, 10),
      rejectedYesterday: parseInt(stats.rejectedYesterday || 0, 10),
      totalApprovedAmount: parseFloat(stats.totalApprovedAmount || 0),
      totalRejectedAmount: parseFloat(stats.totalRejectedAmount || 0),
      averageApprovalTime: parseFloat(stats.averageApprovalTime || 0),
      overdueApprovals: parseInt(stats.overdueApprovals || 0, 10)
    };
  }
}

module.exports = DashboardStats;
