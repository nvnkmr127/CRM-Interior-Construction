-- Migration: 110_alter_budget_expense_category.sql
-- Description: Alter check constraints on project_budgets and project_expenses to add 'overhead'.

ALTER TABLE project_budgets DROP CONSTRAINT IF EXISTS project_budgets_category_check;
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_category_check;

ALTER TABLE project_budgets ADD CONSTRAINT project_budgets_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead'));
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead'));
