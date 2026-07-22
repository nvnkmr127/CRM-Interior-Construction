const BaseProvider = require('./BaseProvider');

class SlackProvider extends BaseProvider {
  formatRequest(webhook, eventType, payload) {
    // Slack incoming webhooks expect a specific payload structure.
    // We convert the CRM event into a Slack Block Kit message.
    
    let textMessage = `*New Event: ${eventType}*\n`;
    
    // Simple fallback stringification if no template is provided
    if (payload && payload.message) {
      textMessage += `> ${payload.message}\n`;
    } else {
      textMessage += `> A new event was triggered in the CRM.`;
    }

    const slackPayload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `CRM Alert: ${eventType}`,
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: textMessage
          }
        }
      ]
    };

    // If user provided a custom template, we assume they wrote custom Slack blocks
    if (webhook.payload_template) {
      const customPayload = this.interpolatePayload(webhook.payload_template, payload);
      Object.assign(slackPayload, customPayload);
    }

    const bodyString = JSON.stringify(slackPayload);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CRM-Slack-Integration/1.0'
      // Notice: No HMAC signature is attached for Slack, as they use secret URLs.
    };

    return {
      url: webhook.url,
      headers,
      bodyString
    };
  }
}

module.exports = new SlackProvider();
