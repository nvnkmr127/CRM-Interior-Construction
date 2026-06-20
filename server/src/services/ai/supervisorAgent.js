const { GoogleGenAI } = require('@google/genai');

/**
 * Supervisor Agent
 * Routes natural language queries to the appropriate sub-system.
 */
class SupervisorAgent {
  async routeQuery(promptText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { action: 'unknown', confidence: 0 };

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
      You are an AI Supervisor for a CRM.
      Your job is to route the user's natural language command to the correct sub-agent.
      
      Available Actions:
      - "update_lead": The user wants to update a lead's data (e.g. status, budget).
      - "add_note": The user wants to add a timeline note to a lead.
      - "budget_optimizer": The user is asking for budget breakdown recommendations.
      - "sales_coach": The user is asking for sales advice or meeting feedback.
      - "unknown": The request does not match anything.

      Command: "${promptText}"

      Return a JSON object exactly like this:
      {
        "action": "update_lead",
        "parameters": {
          "leadId": "extract if present, else null",
          "field": "extract if present",
          "value": "extract if present"
        },
        "confidence": 95
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      
      let text = typeof response.text === 'function' ? response.text() : response.text;
      text = text.trim();
      if (text.startsWith('\`\`\`json')) text = text.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
      return JSON.parse(text);
    } catch (error) {
      console.error('[Supervisor Agent] Routing error:', error);
      return { action: 'unknown', confidence: 0 };
    }
  }
}

module.exports = new SupervisorAgent();
