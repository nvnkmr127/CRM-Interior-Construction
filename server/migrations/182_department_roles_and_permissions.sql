-- Migration: 182_department_roles_and_permissions
-- Description: Introduces department-wise default roles with strict permission bundles

DO $$ 
DECLARE
  t RECORD;
  superadmin_perms TEXT := '["*"]';
  
  -- Default permissions for new roles
  designer_perms TEXT := '["projects:read", "design:read", "design:manage", "design:approve"]';
  procurement_perms TEXT := '["projects:read", "procurement:read", "procurement:manage", "procurement:approve"]';
  finance_perms TEXT := '["projects:read", "finance:read", "finance:invoices", "finance:payments", "finance:discounts", "finance:manage"]';
  qc_perms TEXT := '["projects:read", "qc:read", "qc:manage", "qc:approve"]';
  handover_perms TEXT := '["projects:read", "handover:read", "handover:authorize"]';
  warranty_perms TEXT := '["projects:read", "warranty:read", "warranty:manage"]';
  support_perms TEXT := '["projects:read", "support:read", "support:manage"]';

BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    -- 1. Ensure Superadmin has wildcard
    UPDATE roles 
    SET permissions = superadmin_perms
    WHERE tenant_id = t.id AND name = 'superadmin';

    -- 2. Insert Designer
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Designer') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Designer', designer_perms);
    END IF;

    -- 3. Insert Procurement Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Procurement Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Procurement Manager', procurement_perms);
    END IF;

    -- 4. Insert Finance Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Finance Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Finance Manager', finance_perms);
    END IF;

    -- 5. Insert QC Inspector
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'QC Inspector') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'QC Inspector', qc_perms);
    END IF;

    -- 6. Insert Handover Specialist
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Handover Specialist') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Handover Specialist', handover_perms);
    END IF;

    -- 7. Insert Warranty Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Warranty Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Warranty Manager', warranty_perms);
    END IF;

    -- 8. Insert Customer Support
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Customer Support Rep') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Customer Support Rep', support_perms);
    END IF;

  END LOOP;
END $$;
