-- Migration: 064_alter_documents_version_to_integer.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'documents' 
      AND column_name = 'version' 
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE documents ALTER COLUMN version DROP DEFAULT;
    ALTER TABLE documents ALTER COLUMN version TYPE INTEGER USING (CASE WHEN version IS FALSE THEN 0 WHEN version IS TRUE THEN 1 ELSE 1 END);
    ALTER TABLE documents ALTER COLUMN version SET DEFAULT 1;
  END IF;
END $$;
