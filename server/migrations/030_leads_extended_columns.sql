-- Add missing columns to leads table that are referenced in the UI
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS property_type      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS scope              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS locality           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS budget_max         NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS carpet_area_sqft   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS dnc_flag           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_whatsapp   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS competitor_mentioned TEXT,
  ADD COLUMN IF NOT EXISTS lead_number        VARCHAR(20);

-- Fix score column: BOOLEAN -> INTEGER (if not already done by migration 027)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'score'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE leads
      ALTER COLUMN score DROP DEFAULT,
      ALTER COLUMN score TYPE INTEGER USING CASE WHEN score THEN 1 ELSE 0 END,
      ALTER COLUMN score SET DEFAULT 0;
  END IF;
END $$;

-- Auto-generate lead_number for existing rows
UPDATE leads SET lead_number = 'LD-' || UPPER(SUBSTRING(id::text, 1, 6))
WHERE lead_number IS NULL;
