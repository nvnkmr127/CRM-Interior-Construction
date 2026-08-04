-- Migration: 028_resource_allocations.sql
-- Description: Creates resource_allocations table and related triggers for dynamic workload tracking.

CREATE TABLE IF NOT EXISTS resource_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'project', 'task', 'site_visit', 'leave'
    entity_id UUID NOT NULL,
    allocated_hours NUMERIC(10, 2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_res_allocs_user ON resource_allocations(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_res_allocs_entity ON resource_allocations(entity_type, entity_id);

-- Add estimated_hours to tasks table to support granular capacity planning
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2) DEFAULT 0;


-- Triggers for User Leaves -> Auto-blocking capacity
CREATE OR REPLACE FUNCTION sync_leave_to_allocations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.status = 'approved' OR NEW.status = 'active' OR NEW.status = 'planned') THEN
            -- Calculate hours assuming 8 hours per day of leave
            -- (end_date - start_date + 1) * 8
            INSERT INTO resource_allocations (id, tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date, created_at, updated_at)
            VALUES (gen_random_uuid(), NEW.tenant_id, NEW.user_id, 'leave', NEW.id, 
                   (NEW.end_date - NEW.start_date + 1) * 8, 
                   NEW.start_date, NEW.end_date, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                allocated_hours = EXCLUDED.allocated_hours,
                start_date = EXCLUDED.start_date,
                end_date = EXCLUDED.end_date,
                updated_at = NOW();
        ELSE
            DELETE FROM resource_allocations WHERE entity_type = 'leave' AND entity_id = NEW.id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM resource_allocations WHERE entity_type = 'leave' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_leave_to_allocations ON user_leaves;
CREATE TRIGGER trigger_sync_leave_to_allocations
AFTER INSERT OR UPDATE OR DELETE ON user_leaves
FOR EACH ROW EXECUTE FUNCTION sync_leave_to_allocations();

-- Triggers for Tasks -> Auto-consuming capacity
CREATE OR REPLACE FUNCTION sync_task_to_allocations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.assignee_id IS NOT NULL AND NEW.status != 'completed' AND NEW.status != 'cancelled') THEN
            -- Upsert allocation for the task based on estimated_hours
            -- If task is assigned, consume its estimated hours against the due date
            DELETE FROM resource_allocations WHERE entity_type = 'task' AND entity_id = NEW.id;
            INSERT INTO resource_allocations (id, tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date, created_at, updated_at)
            VALUES (gen_random_uuid(), NEW.tenant_id, NEW.assignee_id, 'task', NEW.id, 
                   COALESCE(NEW.estimated_hours, 2), -- default 2 hours if not set
                   NEW.due_date, NEW.due_date, NOW(), NOW());
        ELSE
            DELETE FROM resource_allocations WHERE entity_type = 'task' AND entity_id = NEW.id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM resource_allocations WHERE entity_type = 'task' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_task_to_allocations ON tasks;
CREATE TRIGGER trigger_sync_task_to_allocations
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION sync_task_to_allocations();

-- Triggers for Projects -> Auto-consuming capacity
CREATE OR REPLACE FUNCTION sync_project_to_allocations()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF (NEW.status IS NULL OR LOWER(NEW.status) NOT IN ('on_hold', 'completed', 'overdue', 'cancelled', 'deleted')) THEN
            -- Delete old allocations for this project
            DELETE FROM resource_allocations WHERE entity_type = 'project' AND entity_id = NEW.id;
            
            -- Insert PM allocation
            IF (NEW.pm_id IS NOT NULL) THEN
                INSERT INTO resource_allocations (id, tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date)
                VALUES (gen_random_uuid(), NEW.tenant_id, NEW.pm_id, 'project', NEW.id, COALESCE(NEW.pm_hours_allocated, 0), NEW.start_date, NEW.target_date);
            END IF;

            -- Insert Designer allocation
            IF (NEW.designer_id IS NOT NULL AND NEW.designer_id != NEW.pm_id) THEN
                INSERT INTO resource_allocations (id, tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date)
                VALUES (gen_random_uuid(), NEW.tenant_id, NEW.designer_id, 'project', NEW.id, COALESCE(NEW.designer_hours_allocated, 0), NEW.start_date, NEW.target_date);
            END IF;
        ELSE
            DELETE FROM resource_allocations WHERE entity_type = 'project' AND entity_id = NEW.id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        DELETE FROM resource_allocations WHERE entity_type = 'project' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_project_to_allocations ON projects;
CREATE TRIGGER trigger_sync_project_to_allocations
AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION sync_project_to_allocations();

-- One-time Data Migration: Populate resource_allocations from existing active projects
DO $$
DECLARE
    proj RECORD;
BEGIN
    FOR proj IN SELECT * FROM projects WHERE (status IS NULL OR LOWER(status) NOT IN ('on_hold', 'completed', 'overdue', 'cancelled', 'deleted')) AND deleted_at IS NULL LOOP
        -- Delete any existing allocations to prevent duplicates
        DELETE FROM resource_allocations WHERE entity_type = 'project' AND entity_id = proj.id;
        
        IF proj.pm_id IS NOT NULL THEN
            INSERT INTO resource_allocations (tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date)
            VALUES (proj.tenant_id, proj.pm_id, 'project', proj.id, COALESCE(proj.pm_hours_allocated, 0), proj.start_date, proj.target_date);
        END IF;
        IF proj.designer_id IS NOT NULL AND proj.designer_id != proj.pm_id THEN
            INSERT INTO resource_allocations (tenant_id, user_id, entity_type, entity_id, allocated_hours, start_date, end_date)
            VALUES (proj.tenant_id, proj.designer_id, 'project', proj.id, COALESCE(proj.designer_hours_allocated, 0), proj.start_date, proj.target_date);
        END IF;
    END LOOP;
END;
$$;
