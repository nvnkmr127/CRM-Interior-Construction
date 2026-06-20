-- Create a Materialized View for Sales Performance to optimize the Manager Dashboard

CREATE MATERIALIZED VIEW IF NOT EXISTS sales_performance_mv AS
SELECT 
  u.tenant_id,
  u.id as rep_id,
  u.name as rep_name,
  COUNT(l.id) FILTER (WHERE l.status = 'active') as active_leads,
  COALESCE(SUM(l.contract_value) FILTER (WHERE l.status = 'active'), 0) as potential_revenue,
  COUNT(l.id) FILTER (WHERE ls.is_won = true AND l.updated_at >= date_trunc('month', NOW())) as won_this_month,
  COALESCE(SUM(l.contract_value) FILTER (WHERE ls.is_won = true AND l.updated_at >= date_trunc('month', NOW())), 0) as won_revenue_this_month
FROM users u
LEFT JOIN leads l ON l.assigned_rep_id = u.id AND l.deleted_at IS NULL
LEFT JOIN lead_stages ls ON ls.id = l.stage_id
WHERE u.role = 'sales'
GROUP BY u.tenant_id, u.id, u.name;

-- Create a unique index to allow CONCURRENTLY refreshes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_performance_mv_tenant_rep ON sales_performance_mv (tenant_id, rep_id);

-- Note: To refresh this view, you can run:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY sales_performance_mv;
