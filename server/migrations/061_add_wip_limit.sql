-- Add wip_limit to lead_stages to restrict the number of active leads in a stage
ALTER TABLE lead_stages
ADD COLUMN wip_limit INTEGER DEFAULT NULL;
