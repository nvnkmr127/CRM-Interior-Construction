-- Migration: 168_stage_qc_checklists.sql
-- Description: Configurable QC checklists per execution stage.

CREATE TABLE IF NOT EXISTS qc_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL, -- e.g. 'Civil ready check'
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES qc_stage_templates(id) ON DELETE CASCADE,
  item_text VARCHAR(255) NOT NULL,
  is_photo_mandatory BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Project instances of QC Checklists
CREATE TABLE IF NOT EXISTS project_qc_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, 
  stage_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
  qc_engineer_id UUID REFERENCES users(id),
  signed_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_qc_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES project_qc_stages(id) ON DELETE CASCADE,
  item_text VARCHAR(255) NOT NULL,
  is_photo_mandatory BOOLEAN DEFAULT true,
  is_passed BOOLEAN,
  photo_url VARCHAR(255),
  notes TEXT,
  checked_by UUID REFERENCES users(id),
  checked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_stage_proj_phase ON project_qc_stages(project_id, phase_id);

-- Seed default templates for demo tenant
DO $$
DECLARE
  v_tenant_id UUID;
  v_template_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    
    -- 1. Civil ready check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Civil ready check', 'Pre-requisite for starting electrical rough-in', 10) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Walls are plastered and cured properly', true, 1),
    (v_template_id, 'Floor hacking is complete and debris removed', true, 2),
    (v_template_id, 'Brickwork partitions are according to plan', true, 3);

    -- 2. Electrical rough-in check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Electrical rough-in check', 'Check conduits and boxes before plastering/closing', 20) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Conduits laid as per electrical layout drawing', true, 1),
    (v_template_id, 'Metal backboxes fixed at correct heights', true, 2),
    (v_template_id, 'No damage to structural columns during chasing', true, 3);

    -- 3. False ceiling check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'False ceiling check', 'Check framing and boarding before painting', 30) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Level check of the framing grids', true, 1),
    (v_template_id, 'Gypsum boards screwed properly without sagging', true, 2),
    (v_template_id, 'Light cutouts made accurately', true, 3);

    -- 4. Painting check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Painting check', 'Check primer and first coat finishes', 40) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Wall putty is smooth and sanded properly', true, 1),
    (v_template_id, 'Primer coat applied evenly without patches', true, 2),
    (v_template_id, 'First coat of emulsion is consistent', true, 3);

    -- 5. Modular installation check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Modular installation check', 'Check alignment and fixing of modular units', 50) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Carcass units are leveled and plumb', true, 1),
    (v_template_id, 'All wall units are securely anchored', true, 2),
    (v_template_id, 'Shutters are aligned with uniform gaps', true, 3);

    -- 6. Hardware installation check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Hardware installation check', 'Check smooth operation of accessories', 60) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Hinges soft-close is working smoothly', true, 1),
    (v_template_id, 'Drawers and channels operate without friction', true, 2),
    (v_template_id, 'Handles and knobs fixed straight and tight', true, 3);

    -- 7. Final finishing check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Final finishing check', 'Pre-handover comprehensive check', 70) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Final coat of paint has no defects or scratches', true, 1),
    (v_template_id, 'Site is thoroughly cleaned', true, 2),
    (v_template_id, 'All electrical and plumbing fixtures tested and working', true, 3);

  END IF;
END $$;
