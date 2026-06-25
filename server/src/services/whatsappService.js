async function sendWhatsAppMessage(toPhone, messageBody, mediaUrl = null) {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.your-whatsapp-provider.com/v1/messages';
  const apiKey = process.env.WHATSAPP_API_KEY;
  const mockMessageId = 'wa_msg_' + Math.random().toString(36).substr(2, 9);

  if (!apiKey) {
    console.warn('[WhatsApp] API Key missing. Simulating message send to:', toPhone);
    console.log('[WhatsApp] Message:', messageBody);
    return { success: true, simulated: true, messageId: mockMessageId };
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
    return { success: true, data, messageId: data?.messageId || data?.id || mockMessageId };
  } catch (error) {
    console.error('[WhatsApp Service] Failed to send message:', error);
    throw error;
  }
}

async function pullWhatsAppChatStatus(toPhone, existingMessages = []) {
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (apiKey) {
    try {
      const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.your-whatsapp-provider.com/v1';
      const response = await fetch(`${apiUrl}/chats/${toPhone}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          statusUpdates: data.statusUpdates || [],
          newMessages: data.newMessages || []
        };
      }
    } catch (err) {
      console.error('[WhatsApp Service] Failed to fetch real chat status, falling back to simulation:', err);
    }
  }

  // Simulation mode
  const statusUpdates = [];
  const newMessages = [];

  const outboundMessages = existingMessages.filter(m => {
    const metadata = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
    const direction = metadata?.direction || 'outbound';
    return direction === 'outbound';
  });

  for (const msg of outboundMessages) {
    const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
    const currentStatus = metadata?.status || 'sent';
    const messageId = metadata?.messageId || msg.id;

    if (currentStatus === 'sent') {
      statusUpdates.push({
        messageId,
        status: 'delivered'
      });
    } else if (currentStatus === 'delivered') {
      statusUpdates.push({
        messageId,
        status: 'read'
      });
    } else if (currentStatus === 'read') {
      const rand = Math.random();
      if (rand < 0.4) {
        statusUpdates.push({
          messageId,
          status: 'reacted',
          reaction: ['❤️', '👍', '🔥', '👏', '😊'][Math.floor(Math.random() * 5)]
        });
      } else if (rand < 0.8) {
        statusUpdates.push({
          messageId,
          status: 'replied'
        });

        const simulatedReplies = [
          "Thank you for sharing, I will review this.",
          "This looks nice! Can you share the pricing sheet?",
          "Hi, I'm interested. Let's schedule a call tomorrow.",
          "Looks interesting. What materials do you use?",
          "Great design! Can we make some changes in the living room layout?"
        ];
        const body = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

        newMessages.push({
          messageId: 'wa_msg_in_' + Math.random().toString(36).substr(2, 9),
          direction: 'inbound',
          body,
          timestamp: new Date()
        });
      }
    }
  }

  return { success: true, statusUpdates, newMessages, simulated: true };
}

module.exports = {
  sendWhatsAppMessage,
  pullWhatsAppChatStatus
};
