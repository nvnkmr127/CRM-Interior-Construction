-- Migration 030: Add enhancements for webhook logs and debug mode

-- Outbound webhook logs
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS request_headers TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS response_headers TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

-- Outbound webhooks
ALTER TABLE outbound_webhooks ADD COLUMN IF NOT EXISTS is_debug_mode BOOLEAN DEFAULT false;

-- Ensure attempt_number is integer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_logs' AND column_name = 'attempt_number' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE webhook_logs ALTER COLUMN attempt_number DROP DEFAULT;
    ALTER TABLE webhook_logs ALTER COLUMN attempt_number TYPE INTEGER USING (CASE WHEN attempt_number THEN 1 ELSE 1 END);
    ALTER TABLE webhook_logs ALTER COLUMN attempt_number SET DEFAULT 1;
  END IF;
END $$;

-- Inbound webhook logs
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS payload TEXT;
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS matched_lead_id UUID;
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS provider_name VARCHAR(100);
ALTER TABLE inbound_webhook_logs ADD COLUMN IF NOT EXISTS source_key VARCHAR(255);

-- API Keys and Developer Tokens compatibility
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS secret_hash VARCHAR(255);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(45),
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed a default Website Contact Form source for existing tenants if they have none
DO $$
DECLARE
  t_record RECORD;
BEGIN
  FOR t_record IN SELECT id FROM tenants LOOP
    IF NOT EXISTS (SELECT 1 FROM webhook_sources WHERE tenant_id = t_record.id) THEN
      INSERT INTO webhook_sources (
        tenant_id, name, source_key, secret, field_mapping, dedup_field, provider_name, is_active
      ) VALUES (
        t_record.id,
        'Website Contact Form Lead Ingest',
        'default_website_leads_' || replace(t_record.id::text, '-', ''),
        NULL,
        '[{"sourceField":"name","targetField":"name","transform":"trim"},{"sourceField":"phone","targetField":"phone","transform":"trim"},{"sourceField":"email","targetField":"email","transform":"lowercase"},{"sourceField":"city","targetField":"city","transform":"trim"},{"sourceField":"project_type","targetField":"project_type","transform":"trim"},{"sourceField":"budget","targetField":"budget","transform":"trim"}]',
        'phone',
        'Website',
        true
      ) ON CONFLICT (source_key) DO NOTHING;
    END IF;
  END LOOP;
END $$;
