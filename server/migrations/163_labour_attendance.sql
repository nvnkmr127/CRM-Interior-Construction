-- Migration: 163_labour_attendance.sql
-- Description: Creates labour_attendance table for tracking site workers and contractor/vendor teams.

CREATE TABLE IF NOT EXISTS labour_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_name VARCHAR(255) NOT NULL,
  trade VARCHAR(100) NOT NULL,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  contractor_name VARCHAR(255),
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_assigned TEXT,
  attendance_method VARCHAR(50) DEFAULT 'manual' CHECK (attendance_method IN ('manual', 'qr', 'otp')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labour_attendance_project ON labour_attendance(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_labour_attendance_vendor ON labour_attendance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_labour_attendance_date ON labour_attendance(check_in_time);
