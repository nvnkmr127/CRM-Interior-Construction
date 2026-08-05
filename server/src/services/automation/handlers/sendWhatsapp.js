const logger = require('../../../utils/logger');
const axios = require('axios');
const _configEnv = require('../../../config/env');
/**
 * WhatsApp Action Handler
 * Integrates with third-party WhatsApp API.
 */
async function handle(config, context) {
  const { templateName, templateId, recipientField } = config;
  const { record } = context;

  const tName = templateName || templateId;

  const phone = record[recipientField] || record.phone;
  if (!phone) {
    logger.info(`[Automation Action] No phone number found to send WhatsApp template '${tName}'`);
    return;
  }

  logger.info(`[Automation Action] Sending WhatsApp to ${phone} using template '${tName}'`);

  try {
    const waApiUrl = process.env.WHATSAPP_API_URL;
    const waApiToken = process.env.WHATSAPP_API_TOKEN;

    if (!waApiUrl || !waApiToken) {
      console.warn('[Automation Action] WHATSAPP_API_URL or WHATSAPP_API_TOKEN not set. Simulating send.');
      return;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: tName,
        language: { code: "en" }
      }
    };

    await axios.post(waApiUrl, payload, {
      headers: {
        'Authorization': `Bearer ${waApiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`[Automation Action] WhatsApp successfully sent to ${phone}`);
  } catch (error) {
    logger.error(`[Automation Action] Failed to send WhatsApp to ${phone}:`, error.message);
  }
}

module.exports = { handle };

