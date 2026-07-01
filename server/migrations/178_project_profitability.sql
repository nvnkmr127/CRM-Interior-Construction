-- Migration: 178_project_profitability.sql
-- Description: Adds views for project cost ledger and profitability tracking.

-- 1. Create the project_cost_ledger_view to aggregate all costs
CREATE OR REPLACE VIEW project_cost_ledger_view AS
-- 1. Material Cost from Purchase Orders (excluding drafts/cancelled)
SELECT 
    po.id AS source_id,
    po.tenant_id,
    po.project_id,
    'material' AS cost_category,
    'Purchase Order' AS source_type,
    po.po_number AS reference,
    po.total_amount AS amount,
    po.created_at AS incurred_date
FROM purchase_orders po
WHERE po.status NOT IN ('draft', 'cancelled')

UNION ALL

-- 2. Vendor Cost from Vendor Payment Milestones
SELECT 
    vpm.id AS source_id,
    vpm.tenant_id,
    vpm.project_id,
    'vendor' AS cost_category,
    'Vendor Payment' AS source_type,
    vpm.name AS reference,
    vpm.amount AS amount,
    COALESCE(vpm.paid_at, vpm.created_at) AS incurred_date
FROM vendor_payment_milestones vpm

UNION ALL

-- 3. Site Expenses (mapped to categories)
SELECT 
    se.id AS source_id,
    se.tenant_id,
    se.project_id,
    CASE 
        WHEN se.expense_type = 'material' THEN 'material'
        WHEN se.expense_type = 'labour_advance' THEN 'labour'
        ELSE 'overhead'
    END AS cost_category,
    'Site Expense' AS source_type,
    se.description AS reference,
    se.amount AS amount,
    se.submitted_at AS incurred_date
FROM site_expenses se
WHERE se.status = 'approved'

UNION ALL

-- 4. Direct Project Expenses (Overhead, Labour, etc.)
SELECT 
    pe.id AS source_id,
    pe.tenant_id,
    pe.project_id,
    pe.category AS cost_category,
    'Direct Expense' AS source_type,
    pe.description AS reference,
    pe.amount AS amount,
    pe.incurred_date AS incurred_date
FROM project_expenses pe;

-- 2. Create the project_profitability_view
CREATE OR REPLACE VIEW project_profitability_view AS
WITH project_costs AS (
    SELECT 
        project_id,
        tenant_id,
        SUM(CASE WHEN cost_category = 'material' THEN amount ELSE 0 END) AS total_material_cost,
        SUM(CASE WHEN cost_category = 'labour' THEN amount ELSE 0 END) AS total_labour_cost,
        SUM(CASE WHEN cost_category = 'vendor' THEN amount ELSE 0 END) AS total_vendor_cost,
        SUM(CASE WHEN cost_category = 'overhead' THEN amount ELSE 0 END) AS total_overhead_cost,
        SUM(amount) AS total_cost
    FROM project_cost_ledger_view
    GROUP BY project_id, tenant_id
)
SELECT 
    p.id AS project_id,
    p.tenant_id,
    p.name AS project_name,
    COALESCE(p.contract_value, 0) AS revenue,
    COALESCE(pc.total_material_cost, 0) AS total_material_cost,
    COALESCE(pc.total_labour_cost, 0) AS total_labour_cost,
    COALESCE(pc.total_vendor_cost, 0) AS total_vendor_cost,
    COALESCE(pc.total_overhead_cost, 0) AS total_overhead_cost,
    COALESCE(pc.total_cost, 0) AS total_cost,
    (COALESCE(p.contract_value, 0) - COALESCE(pc.total_cost, 0)) AS gross_margin,
    CASE 
        WHEN COALESCE(p.contract_value, 0) > 0 
        THEN ROUND(((COALESCE(p.contract_value, 0) - COALESCE(pc.total_cost, 0)) / p.contract_value * 100), 2)
        ELSE 0 
    END AS gross_margin_percentage
FROM projects p
LEFT JOIN project_costs pc ON p.id = pc.project_id AND p.tenant_id = pc.tenant_id;
