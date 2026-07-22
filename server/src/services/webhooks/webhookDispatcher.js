const pool = require('../../config/db');
const axios = require('axios');
const providerRegistry = require('./providerRegistry');

class WebhookDeliveryService {
  constructor() {
    this.dispatchEvent = this.dispatchEvent.bind(this);
    this.retryLog = this.retryLog.bind(this);
    this.testWebhook = this.testWebhook.bind(this);
  }

  /**
   * Queries the database for active webhooks subscribed to the event.
   */
  async _findMatchingWebhooks(tenantId, eventType) {
    try {
      const query = `
        SELECT * FROM outbound_webhooks 
        WHERE tenant_id = $1 
          AND events @> $2::jsonb 
          AND is_active = true
      `;
      const result = await pool.query(query, [tenantId, JSON.stringify([eventType])]);
      return result.rows;
    } catch (error) {
      console.error(`[WebhookDeliveryService] Failed to fetch webhooks for event ${eventType}:`, error);
      return [];
    }
  }

  /**
   * Captures the HTTP response (success or failure) and stores the log.
   */
  async _logResponse(webhookId, tenantId, eventType, bodyString, statusCode, responseBodyText, latencyMs, attempt, debugData = null) {
    try {
      // Assuming a DB migration has added request_headers and response_headers columns
      const logQuery = `
        INSERT INTO webhook_logs (webhook_id, tenant_id, event, payload, status_code, response_body, latency_ms, attempt_number, request_headers, response_headers)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await pool.query(logQuery, [
        webhookId,
        tenantId,
        eventType,
        bodyString,
        statusCode,
        (responseBodyText || '').substring(0, 5000),
        latencyMs,
        attempt,
        debugData ? debugData.reqHeaders : null,
        debugData ? debugData.resHeaders : null
      ]);
    } catch (logErr) {
      console.error('[WebhookDeliveryService] Failed to log webhook attempt:', logErr);
    }
  }

  /**
   * Handles the HTTP request, timeouts, custom headers, and retries.
   * Designed to be easily ported to a native Queue Worker (e.g., BullMQ) where delays are handled by the queue.
   */
  async _sendRequest(tenantId, webhook, eventType, requestConfig) {
    // Retry schedule: Immediate (0), 1m, 5m, 15m, 1h
    const RETRY_SCHEDULE = [0, 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
    const maxRetries = Math.min(webhook.retry_count || 5, RETRY_SCHEDULE.length);
    let attempt = 0;
    let success = false;
    let lastError = null;

    while (attempt < maxRetries && !success) {
      // For in-memory fallback: wait before the attempt if it's a retry
      if (attempt > 0) {
        const delay = RETRY_SCHEDULE[attempt];
        await new Promise(res => setTimeout(res, delay));
      }

      attempt++;
      const startTime = Date.now();
      let statusCode = 0;
      let responseBodyText = '';
      let resHeaders = null;

      try {
        const response = await axios.post(requestConfig.url, requestConfig.bodyString, {
          headers: requestConfig.headers,
          timeout: 10000
        });

        success = true;
        statusCode = response.status;
        responseBodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        resHeaders = response.headers;

      } catch (error) {
        if (error.response) {
          statusCode = error.response.status;
          responseBodyText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
          resHeaders = error.response.headers;
        } else {
          responseBodyText = error.message;
        }
        lastError = error;
      }

      const latencyMs = Date.now() - startTime;
      
      let debugData = null;
      if (webhook.is_debug_mode) {
        debugData = {
          reqHeaders: this._sanitizeHeaders(requestConfig.headers),
          resHeaders: this._sanitizeHeaders(resHeaders)
        };
      }

      await this._logResponse(webhook.id, tenantId, eventType, requestConfig.bodyString, statusCode, responseBodyText, latencyMs, attempt, debugData);
    }

    if (!success) {
      console.error(`[WebhookDeliveryService] Webhook ${webhook.id} (event: ${eventType}) permanently failed after ${maxRetries} attempts. Last error: ${lastError ? lastError.message : 'Unknown'}`);
      
      // Optionally update the webhook status to inactive if we wanted to completely disable it on permanent failure.
      // await pool.query('UPDATE outbound_webhooks SET is_active = false WHERE id = $1', [webhook.id]);
    }

    return { success, statusCode: lastError && lastError.response ? lastError.response.status : 0 };
  }

  /**
   * Internal processor logic for a single webhook.
   */
  async _processSingleWebhook(tenantId, webhook, eventType, payload) {
    // Determine provider (Slack, Teams, Standard, etc.)
    const provider = providerRegistry.getProvider(webhook.integration_type);
    
    // Provider formats the exact HTTP request config
    const requestConfig = provider.formatRequest(webhook, eventType, payload);

    return await this._sendRequest(tenantId, webhook, eventType, requestConfig);
  }

  /**
   * Entry point for business logic. 
   * Designed to easily integrate with a job queue in the future.
   */
  async dispatchEvent(tenantId, eventType, payload) {
    // In a queue-based system, we would enqueue the job here.
    // For now, we process immediately in the background.
    this._processEvent(tenantId, eventType, payload).catch(err => {
      console.error('[WebhookDeliveryService] Unhandled dispatcher error:', err);
    });
  }

  async _processEvent(tenantId, eventType, payload) {
    const webhooks = await this._findMatchingWebhooks(tenantId, eventType);
    await Promise.all(webhooks.map(webhook => this._processSingleWebhook(tenantId, webhook, eventType, payload)));
  }

  /**
   * Retry a specific log manually.
   */
  async retryLog(tenantId, logId) {
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
      const signature = this._generateSignature(webhook.secret, bodyString);
      headers['X-CRM-Signature'] = `sha256=${signature}`;
    }

    const startTime = Date.now();
    let statusCode = 0;
    let success = false;
    let responseBodyText = '';
    let resHeaders = null;

    try {
      const response = await axios.post(webhook.url, bodyString, { headers, timeout: 10000 });
      success = true;
      statusCode = response.status;
      responseBodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      resHeaders = response.headers;
    } catch (error) {
      if (error.response) {
        statusCode = error.response.status;
        responseBodyText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
        resHeaders = error.response.headers;
      } else {
        responseBodyText = error.message;
      }
    }

    const latencyMs = Date.now() - startTime;
    
    let debugData = null;
    if (webhook.is_debug_mode) {
      debugData = {
        reqHeaders: this._sanitizeHeaders(headers),
        resHeaders: this._sanitizeHeaders(resHeaders)
      };
    }

    await this._logResponse(webhook.id, tenantId, log.event, bodyString, statusCode, responseBodyText, latencyMs, (log.attempt_number || 1) + 1, debugData);

    return { success, statusCode };
  }

  /**
   * Dispatches a test webhook immediately and records it.
   */
  async testWebhook(tenantId, webhookId) {
    const query = `SELECT * FROM outbound_webhooks WHERE id = $1 AND tenant_id = $2`;
    const result = await pool.query(query, [webhookId, tenantId]);
    if (result.rowCount === 0) throw new Error('WEBHOOK_NOT_FOUND');
    
    const webhook = result.rows[0];
    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook payload from CRM',
      test_data: { id: 'test-123', status: 'active' }
    };
    
    // Process it through the provider
    const provider = providerRegistry.getProvider(webhook.integration_type);
    const requestConfig = provider.formatRequest(webhook, 'webhook.test', payload);

    // Since this is a test, we don't retry. We just send once.
    const startTime = Date.now();
    let statusCode = 0;
    let success = false;
    let responseBodyText = '';
    let resHeaders = null;
    let lastError = null;

    try {
      const response = await axios.post(requestConfig.url, requestConfig.bodyString, { 
        headers: requestConfig.headers, 
        timeout: 10000 
      });
      success = true;
      statusCode = response.status;
      responseBodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      resHeaders = response.headers;
    } catch (error) {
      lastError = error;
      if (error.response) {
        statusCode = error.response.status;
        responseBodyText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
        resHeaders = error.response.headers;
      } else {
        responseBodyText = error.message;
      }
    }

    const latencyMs = Date.now() - startTime;
    
    let debugData = null;
    if (webhook.is_debug_mode) {
      debugData = {
        reqHeaders: this._sanitizeHeaders(requestConfig.headers),
        resHeaders: this._sanitizeHeaders(resHeaders)
      };
    }

    await this._logResponse(webhook.id, tenantId, 'webhook.test', requestConfig.bodyString, statusCode, responseBodyText, latencyMs, 1, debugData);

    return { 
      success, 
      statusCode, 
      latencyMs,
      error: lastError ? lastError.message : null
    };
  }
  /**
   * Sanitizes headers to prevent storing sensitive information.
   */
  _sanitizeHeaders(headers) {
    if (!headers) return null;
    const sanitized = { ...headers };
    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'authorization' || lowerKey.includes('secret') || lowerKey.includes('signature') || lowerKey.includes('token')) {
        sanitized[key] = '***REDACTED***';
      }
    }
    return JSON.stringify(sanitized);
  }
}

module.exports = new WebhookDeliveryService();
