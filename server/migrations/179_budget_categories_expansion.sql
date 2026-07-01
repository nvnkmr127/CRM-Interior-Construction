-- Migration: 179_budget_categories_expansion.sql
-- Description: Expands budget categories to include civil, electrical, plumbing, carpentry as per audit requirements.

ALTER TABLE project_budgets DROP CONSTRAINT IF EXISTS project_budgets_category_check;
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_category_check;

ALTER TABLE project_budgets ADD CONSTRAINT project_budgets_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry'));
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry'));
