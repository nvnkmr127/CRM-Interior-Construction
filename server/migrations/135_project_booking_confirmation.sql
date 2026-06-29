-- Migration: 135_project_booking_confirmation.sql

CREATE TABLE IF NOT EXISTS project_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL, -- bank_transfer, cash, card, upi, cheque
  agreement_file_key VARCHAR(255),
  agreement_file_name VARCHAR(255),
  agreement_file_size INTEGER,
  agreement_file_mime VARCHAR(100),
  agreed_scope_summary TEXT,
  design_freeze_target_date DATE,
  project_start_date DATE,
  assigned_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_bookings_project ON project_bookings(project_id);
