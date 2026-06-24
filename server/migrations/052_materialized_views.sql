-- Migration: 052_materialized_views.sql

DROP MATERIALIZED VIEW IF EXISTS pipeline_summary CASCADE;

CREATE MATERIALIZED VIEW pipeline_summary AS
SELECT 
    tenant_id,
    stage_id,
    COUNT(id) as total_leads,
    AVG(score) as average_score,
    COALESCE(SUM(budget_max), 0) as total_pipeline_value
FROM leads
WHERE deleted_at IS NULL
GROUP BY tenant_id, stage_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_summary_tenant_stage ON pipeline_summary(tenant_id, stage_id);

CREATE OR REPLACE FUNCTION refresh_pipeline_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pipeline_summary;
END;
$$ LANGUAGE plpgsql;
