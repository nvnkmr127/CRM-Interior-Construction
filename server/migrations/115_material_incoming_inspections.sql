-- Migration: 115_material_incoming_inspections.sql
-- Description: Adds incoming inspection workflow columns to material deliveries and items.

-- Alter material_deliveries table
ALTER TABLE material_deliveries
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS vendor_notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_notification_sent_at TIMESTAMP;

-- Alter material_delivery_items table
ALTER TABLE material_delivery_items
ADD COLUMN IF NOT EXISTS specification_conformance_status VARCHAR(50) DEFAULT 'conforming' CHECK (specification_conformance_status IN ('conforming', 'non-conforming')),
ADD COLUMN IF NOT EXISTS specification_variance_details TEXT,
ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'accepted', 'rejected')),
ADD COLUMN IF NOT EXISTS rejected_quantity DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
