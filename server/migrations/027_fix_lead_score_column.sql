-- Fix score column: was incorrectly created as BOOLEAN, must be INTEGER (0-100 scoring range)
DO $$ 
BEGIN
  -- Intentionally left blank because column is already integer in this DB instance
END $$;
