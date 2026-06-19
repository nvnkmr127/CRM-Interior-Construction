/**
 * WhatsApp Business API Service (Stub/Placeholder for client's specific provider)
 * Replace the endpoint URL and Auth headers with your actual provider (e.g., WATI, Interakt, Meta Cloud API).
 */

async function sendWhatsAppMessage(toPhone, messageBody, mediaUrl = null) {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.your-whatsapp-provider.com/v1/messages';
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!apiKey) {
    console.warn('[WhatsApp] API Key missing. Simulating message send to:', toPhone);
    console.log('[WhatsApp] Message:', messageBody);
    return { success: true, simulated: true };
  }

  try {
    const payload = {
      to: toPhone,
      type: 'text',
      text: { body: messageBody }
    };

    if (mediaUrl) {
      payload.type = 'document';
      payload.document = { link: mediaUrl, caption: messageBody };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[WhatsApp Service] Failed to send message:', error);
    throw error;
  }
}

module.exports = {
  sendWhatsAppMessage
};
