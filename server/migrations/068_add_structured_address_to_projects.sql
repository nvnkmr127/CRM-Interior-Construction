-- Migration: 068_add_structured_address_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flat_number VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS floor VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Backfill existing site_address into street if street is currently null
UPDATE projects
SET street = site_address
WHERE site_address IS NOT NULL 
  AND flat_number IS NULL 
  AND floor IS NULL 
  AND building_name IS NULL 
  AND street IS NULL 
  AND city IS NULL 
  AND pincode IS NULL 
  AND landmark IS NULL;

-- Trigger to keep site_address updated if structured address is modified
CREATE OR REPLACE FUNCTION sync_project_site_address()
RETURNS TRIGGER AS $$
DECLARE
  parts TEXT[] := '{}';
  has_structured BOOLEAN := FALSE;
BEGIN
  IF NEW.flat_number IS NOT NULL AND TRIM(NEW.flat_number) != '' THEN
    parts := array_append(parts, TRIM(NEW.flat_number));
    has_structured := TRUE;
  END IF;
  IF NEW.floor IS NOT NULL AND TRIM(NEW.floor) != '' THEN
    parts := array_append(parts, TRIM(NEW.floor));
    has_structured := TRUE;
  END IF;
  IF NEW.building_name IS NOT NULL AND TRIM(NEW.building_name) != '' THEN
    parts := array_append(parts, TRIM(NEW.building_name));
    has_structured := TRUE;
  END IF;
  IF NEW.street IS NOT NULL AND TRIM(NEW.street) != '' THEN
    parts := array_append(parts, TRIM(NEW.street));
    has_structured := TRUE;
  END IF;
  IF NEW.landmark IS NOT NULL AND TRIM(NEW.landmark) != '' THEN
    parts := array_append(parts, TRIM(NEW.landmark));
    has_structured := TRUE;
  END IF;
  IF NEW.city IS NOT NULL AND TRIM(NEW.city) != '' THEN
    parts := array_append(parts, TRIM(NEW.city));
    has_structured := TRUE;
  END IF;
  IF NEW.pincode IS NOT NULL AND TRIM(NEW.pincode) != '' THEN
    parts := array_append(parts, TRIM(NEW.pincode));
    has_structured := TRUE;
  END IF;

  IF has_structured THEN
    NEW.site_address := array_to_string(parts, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_project_site_address ON projects;
CREATE TRIGGER trg_sync_project_site_address
BEFORE INSERT OR UPDATE OF flat_number, floor, building_name, street, city, pincode, landmark ON projects
FOR EACH ROW
EXECUTE FUNCTION sync_project_site_address();
