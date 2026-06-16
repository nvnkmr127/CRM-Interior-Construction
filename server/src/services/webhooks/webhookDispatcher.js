const pool = require('../../config/db');
const axios = require('axios');
const crypto = require('crypto');

function interpolatePayload(templateObj, payload) {
  let templateStr = JSON.stringify(templateObj);
  templateStr = templateStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let val = payload;
    for (const k of keys) {
      if (val === undefined || val === null) break;
      val = val[k];
    }
    if (typeof val === 'string') {
      return val.replace(/"/g, '\\"');
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }
    return val === undefined || val === null ? '' : JSON.stringify(val).replace(/"/g, '\\"');
  });
  
  try {
    return JSON.parse(templateStr);
  } catch (e) {
    return payload;
  }
}

async function dispatchEvent(tenantId, eventType, payload) {
  processEvents(tenantId, eventType, payload).catch(err => {
    console.error('Unhandled webhook dispatcher error:', err);
  });
}

async function processEvents(tenantId, eventType, payload) {
  try {
    const query = `
      SELECT * FROM outbound_webhooks 
      WHERE tenant_id = $1 
        AND events @> $2::jsonb 
        AND is_active = true
    `;
    const result = await pool.query(query, [tenantId, JSON.stringify([eventType])]);
    const webhooks = result.rows;

    await Promise.all(webhooks.map(webhook => sendWebhook(tenantId, webhook, eventType, payload)));
  } catch (error) {
    console.error(`Failed to fetch webhooks for event ${eventType}:`, error);
  }
}

async function sendWebhook(tenantId, webhook, eventType, payload) {
  let requestBody = payload;
  if (webhook.payload_template) {
    requestBody = interpolatePayload(webhook.payload_template, payload);
  }

  const bodyString = JSON.stringify(requestBody);
  
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'CRM-Webhook-Dispatcher/1.0',
    'X-CRM-Event': eventType
  };

  if (webhook.custom_headers) {
    Object.assign(headers, webhook.custom_headers);
  }

  if (webhook.secret) {
    const signature = crypto.createHmac('sha256', webhook.secret).update(bodyString).digest('hex');
    headers['X-CRM-Signature'] = `sha256=${signature}`;
  }

  const maxRetries = webhook.retry_count || 3;
  let attempt = 0;
  let success = false;
  let lastError = null;

  while (attempt < maxRetries && !success) {
    attempt++;
    const startTime = Date.now();
    let statusCode = 0;
    let responseBodyText;

    try {
      const response = await axios.post(webhook.url, bodyString, {
        headers,
        timeout: 10000
      });

      success = true;
      statusCode = response.status;
      responseBodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    } catch (error) {
      if (error.response) {
        statusCode = error.response.status;
        responseBodyText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      } else {
        responseBodyText = error.message;
      }
      lastError = error;
    }

    const latencyMs = Date.now() - startTime;

    try {
      const logQuery = `
        INSERT INTO webhook_logs (webhook_id, tenant_id, event, payload, status_code, response_body, latency_ms, attempt_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await pool.query(logQuery, [
        webhook.id,
        tenantId,
        eventType,
        bodyString,
        statusCode,
        (responseBodyText || '').substring(0, 5000),
        latencyMs,
        attempt
      ]);
    } catch (logErr) {
      console.error('Failed to log webhook attempt:', logErr);
    }

    if (!success && attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(res => setTimeout(res, delay));
    }
  }

  if (!success && lastError) {
    console.error(`[Webhook] All ${maxRetries} attempts failed for webhook ${webhook.id} (event: ${eventType}):`, lastError.message);
  }
}

async function retryLog(tenantId, logId) {
  const logQuery = `SELECT * FROM webhook_logs WHERE id = $1 AND tenant_id = $2`;
  const logRes = await pool.query(logQuery, [logId, tenantId]);
  if (logRes.rowCount === 0) throw new Error('NOT_FOUND');
  const log = logRes.rows[0];

  const whQuery = `SELECT * FROM outbound_webhooks WHERE id = $1 AND tenant_id = $2`;
  const whRes = await pool.query(whQuery, [log.webhook_id, tenantId]);
  if (whRes.rowCount === 0) throw new Error('WEBHOOK_NOT_FOUND');
  const webhook = whRes.rows[0];

  const bodyString = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'CRM-Webhook-Dispatcher/1.0',
    'X-CRM-Event': log.event
  };

  if (webhook.custom_headers) {
    Object.assign(headers, webhook.custom_headers);
  }

  if (webhook.secret) {
    const signature = crypto.createHmac('sha256', webhook.secret).update(bodyString).digest('hex');
    headers['X-CRM-Signature'] = `sha256=${signature}`;
  }

  const startTime = Date.now();
  let statusCode = 0;
  let success = false;
  let responseBodyText;

  try {
    const response = await axios.post(webhook.url, bodyString, { headers, timeout: 10000 });
    success = true;
    statusCode = response.status;
    responseBodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  } catch (error) {
    if (error.response) {
      statusCode = error.response.status;
      responseBodyText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
    } else {
      responseBodyText = error.message;
    }
  }

  const latencyMs = Date.now() - startTime;

  const newLogQuery = `
    INSERT INTO webhook_logs (webhook_id, tenant_id, event, payload, status_code, response_body, latency_ms, attempt_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  await pool.query(newLogQuery, [
    webhook.id,
    tenantId,
    log.event,
    bodyString,
    statusCode,
    responseBodyText.substring(0, 5000),
    latencyMs,
    (log.attempt_number || 1) + 1
  ]);

  return { success, statusCode };
}

module.exports = { dispatchEvent, retryLog };
