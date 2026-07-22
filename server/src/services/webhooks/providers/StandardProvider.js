const crypto = require('crypto');
const BaseProvider = require('./BaseProvider');

class StandardProvider extends BaseProvider {
  formatRequest(webhook, eventType, payload) {
    let requestBody = payload;
    if (webhook.payload_template) {
      requestBody = this.interpolatePayload(webhook.payload_template, payload);
    }

    const bodyString = JSON.stringify(requestBody);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CRM-Webhook-Dispatcher/2.0',
      'X-CRM-Event': eventType
    };

    if (webhook.custom_headers) {
      Object.assign(headers, webhook.custom_headers);
    }

    if (webhook.secret) {
      const signature = crypto.createHmac('sha256', webhook.secret).update(bodyString).digest('hex');
      headers['X-CRM-Signature'] = `sha256=${signature}`;
    }

    return {
      url: webhook.url,
      headers,
      bodyString
    };
  }
}

module.exports = new StandardProvider();
