-- Fix score column: was incorrectly created as BOOLEAN, must be INTEGER (0-100 scoring range)
ALTER TABLE leads
  ALTER COLUMN score DROP DEFAULT,
  ALTER COLUMN score TYPE INTEGER USING CASE WHEN score THEN 1 ELSE 0 END,
  ALTER COLUMN score SET DEFAULT 0;
