const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const { findLeadById } = require('../repositories/leadRepository');

/**
 * AI Service
 * Integrates with Google Gemini for conversational intelligence.
 */
async function analyzeLeadConversations(lead, activities) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY not configured. Falling back to default stub values.');
    return {
      buyIntent: 'medium',
      winProbability: 50,
      aiScoreBreakdown: [{ factor: 'AI disabled (missing API key)', impact: '0' }]
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const activityText = activities.map(a => `Date: ${a.created_at}, Type: ${a.type}, Notes: ${a.notes || a.summary || ''}`).join('\n');

  const prompt = `
    You are an AI sales assistant for an interior design CRM.
    Analyze the following lead and their interaction history to determine their buy intent and win probability.

    Lead Data:
    - Name: ${lead.name}
    - Budget Max: ${lead.budget_max}
    - Scope: ${lead.scope}
    - Possession Date: ${lead.possession_date}
    - Competitor Mentioned: ${lead.competitor_mentioned || 'None'}
    
    Activity History:
    ${activityText || 'No activities logged.'}

    Return a JSON object with the following structure exactly (no markdown formatting, just raw JSON):
    {
      "buyIntent": "high" | "medium" | "low",
      "winProbability": <number between 0 and 100>,
      "aiScoreBreakdown": [
        { "factor": "Reason for positive or negative impact", "impact": "+10" or "-5" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text();
    const result = JSON.parse(resultText);

    return {
      buyIntent: result.buyIntent || 'medium',
      winProbability: result.winProbability || 50,
      aiScoreBreakdown: result.aiScoreBreakdown || []
    };
  } catch (error) {
    console.error('[AI Service] Failed to call Gemini API:', error);
    return {
      buyIntent: 'medium',
      winProbability: 50,
      aiScoreBreakdown: [{ factor: 'AI Analysis Failed', impact: '0' }]
    };
  }
}

/**
 * Summarizes long meeting notes or chat transcripts.
 */
async function summarizeActivity(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text || text.length < 50) return text;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI assistant. Please provide a concise, 1-2 sentence summary of the following activity log/notes for quick reading:
    
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text().trim();
  } catch (error) {
    console.error('[AI Service] Failed to summarize activity:', error);
    return text;
  }
}

/**
 * Generate a drafted message using Gemini
 */
async function draftCommunication(lead, channel, instructions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return `Hello ${lead.name},\n\n[AI disabled - Please configure GEMINI_API_KEY]\n\nBest,`;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI sales assistant for an interior design CRM.
    Write a drafted ${channel} message to the following lead.
    
    Lead Name: ${lead.name}
    Lead Scope: ${lead.scope || 'Interior Design'}
    Instructions from User: ${instructions || 'Write a polite follow-up message asking for a good time to connect.'}
    
    Keep the tone professional and warm. For WhatsApp, keep it brief and conversational. For email, use a proper structure.
    Output ONLY the draft text. Do not output markdown, preambles, or postambles.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text().trim();
  } catch (error) {
    console.error('[AI Service] Failed to draft communication:', error);
    return `Hello ${lead.name},\n\n[Failed to generate draft. Please try again.]\n\nBest,`;
  }
}

/**
 * Parse a document (Floorplan/Notes) using Gemini multimodal to extract scope
 */
async function parseDocument(base64Data, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });
  
  // Extract base64 without the data URI prefix if present
  const base64Clean = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;

  const prompt = `
    Analyze this interior design floorplan or document.
    Extract the following details if present, and return them as a strictly formatted JSON object (NO markdown wrappers, NO backticks).
    
    Required JSON schema:
    {
      "carpet_area": number or null, // in sqft if possible
      "room_count": number or null, // e.g., 3 for 3BHK
      "property_type": string or null, // e.g. "Apartment", "Villa"
      "extracted_scope": string // A brief 1-2 sentence summary of what needs to be designed based on the rooms shown.
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Clean,
            mimeType: mimeType
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let text = response.text().trim();
    if (text.startsWith('\`\`\`json')) {
      text = text.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('[AI Service] Failed to parse document:', error);
    throw new Error('Failed to extract data from document');
  }
}

/**
 * AI Copilot: Analyzes a lead's entire timeline to extract sales intelligence
 */
async function analyzeLeadIntelligence(lead, activities, communications, preferences) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY not configured. Falling back to stub AI intelligence.');
    return {
      sentiment: 'Neutral',
      signals: ['User expressed interest in layout', 'Budget discussed briefly'],
      objections: ['Waiting for spouse approval'],
      nextAction: 'Schedule a showroom visit to build trust.'
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const timelineText = [
    ...activities.map(a => `[Activity] ${a.created_at} - ${a.type}: ${a.notes || a.summary || ''}`),
    ...communications.map(c => `[Comms] ${c.created_at} - ${c.type} (${c.direction}): ${c.content || ''}`)
  ].join('\n');

  const prefsText = preferences ? JSON.stringify(preferences) : 'None';

  const prompt = `
    You are an expert AI Sales Copilot for an interior design CRM.
    Analyze the following lead profile, preferences, and interaction timeline.

    Lead Name: ${lead.name}
    Lead Scope: ${lead.scope || 'N/A'}
    Budget Max: ${lead.budget_max || 'N/A'}
    Preferences: ${prefsText}

    Interaction Timeline:
    ${timelineText || 'No timeline events found.'}

    Extract the following sales intelligence:
    1. Sentiment: A single word representing the overall customer sentiment ('Positive', 'Neutral', 'Negative', 'At-Risk').
    2. Signals: An array of 1-3 short bullet points summarizing positive buying signals (e.g. "Asked for floorplan").
    3. Objections: An array of 1-3 short bullet points summarizing any hesitations or objections (e.g. "Price is too high"). If none, return an empty array.
    4. Next Action: A single, specific 1-sentence recommendation on what the sales rep should do next.

    Return a strictly formatted JSON object exactly matching this schema:
    {
      "sentiment": "Positive|Neutral|Negative|At-Risk",
      "signals": ["signal 1", "signal 2"],
      "objections": ["objection 1"],
      "nextAction": "Action string"
    }
    No markdown formatting, just raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text();
    const result = JSON.parse(resultText);

    return {
      sentiment: result.sentiment || 'Neutral',
      signals: result.signals || [],
      objections: result.objections || [],
      nextAction: result.nextAction || 'Follow up with the customer to understand their needs.'
    };
  } catch (error) {
    console.error('[AI Service] Failed to generate lead intelligence:', error);
    return {
      sentiment: 'Neutral',
      signals: [],
      objections: [],
      nextAction: 'Could not generate AI recommendation due to an error.'
    };
  }
}

/**
 * AI Design Proposal: Generates color palettes, styles, and concepts based on preferences & inspirations
 */
async function generateDesignProposal(lead, preferences, inspirations) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY not configured. Falling back to stub Design Proposal.');
    return {
      recommended_style: 'Modern Minimalist',
      design_concept: 'A clean, uncluttered aesthetic focusing on functionality and open space. Perfect for contemporary living.',
      color_palette: [
        { hex: '#FAFAFA', name: 'Alabaster White' },
        { hex: '#2C3E50', name: 'Midnight Navy' },
        { hex: '#D4AF37', name: 'Muted Gold' }
      ],
      material_suggestions: ['Matte Black Fixtures', 'White Oak Flooring', 'Quartz Countertops']
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prefsText = preferences ? JSON.stringify(preferences) : 'None';
  const inspText = inspirations && inspirations.length > 0 
    ? inspirations.map(i => `[Room: ${i.room_type || 'General'}] Note: ${i.notes || ''}`).join('\n') 
    : 'No inspiration images/notes available.';

  const prompt = `
    You are an expert Interior Designer AI.
    Based on the following lead's data, preferences, and inspiration notes, generate an initial design proposal.

    Lead Name: ${lead.name}
    Scope: ${lead.scope || 'General Interior Design'}
    Budget: ${lead.budget_max ? 'Max ' + lead.budget_max : 'Unspecified'}

    Customer Preferences:
    ${prefsText}

    Inspiration Notes:
    ${inspText}

    Return a strictly formatted JSON object exactly matching this schema:
    {
      "recommended_style": "String (e.g. Modern Minimalist, Japandi, Industrial)",
      "design_concept": "String (A 2-3 sentence engaging description of the design approach)",
      "color_palette": [
        { "hex": "#HEXCODE", "name": "Color Name" }
      ],
      "material_suggestions": ["Material 1", "Material 2", "Material 3"]
    }
    Make sure to provide 3-5 colors in the palette.
    No markdown formatting, just raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = response.text();
    const result = JSON.parse(resultText);

    return {
      recommended_style: result.recommended_style || 'Contemporary',
      design_concept: result.design_concept || 'A balanced, modern design approach.',
      color_palette: result.color_palette || [],
      material_suggestions: result.material_suggestions || []
    };
  } catch (error) {
    console.error('[AI Service] Failed to generate design proposal:', error);
    throw new Error('Failed to generate design proposal');
  }
}

/**
 * AI Meeting Summarizer: Parses raw transcripts into structured summaries and action items.
 */
async function summarizeMeeting(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY missing. Returning stub Meeting Summary.');
    return {
      summary: 'Meeting summary stub. Discussed project timelines and budget.',
      action_items: ['Send revised quote', 'Schedule site visit'],
      customer_sentiment: 'Positive',
      suggested_next_stage: null
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI Sales Assistant. Read the following meeting notes or raw transcript from a sales rep.
    Extract the key points into a summary, a list of actionable tasks, the customer's sentiment, and if obvious, suggest the next pipeline stage.

    TRANSCRIPT:
    """
    ${transcript}
    """

    Return exactly this JSON schema:
    {
      "summary": "A 2-3 sentence summary of what was discussed",
      "action_items": ["Task 1", "Task 2"],
      "customer_sentiment": "Positive, Neutral, or Negative",
      "suggested_next_stage": "Stage name if mentioned (e.g. 'Site Visit Done', 'Quotation Sent') or null"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const result = JSON.parse(response.text());
    return {
      summary: result.summary || 'Summary could not be parsed.',
      action_items: result.action_items || [],
      customer_sentiment: result.customer_sentiment || 'Neutral',
      suggested_next_stage: result.suggested_next_stage || null
    };
  } catch (error) {
    console.error('[AI Service] Failed to summarize meeting:', error);
    throw new Error('Failed to summarize meeting');
  }
}

/**
 * Simulates a customer response using a Digital Customer Twin.
 * @param {string} tenantId 
 * @param {string} leadId 
 * @param {string} prompt 
 * @returns {Promise<string>} 
 */
async function simulateLeadPersona(tenantId, leadId, prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "I'm a simulated customer (API key missing). Let's pretend I asked for a discount!";

  const ai = new GoogleGenAI({ apiKey });

  const lead = await findLeadById(tenantId, leadId);
  if (!lead) throw new Error('Lead not found for AI persona simulation');

  const budget = lead.budget_max ? `₹${lead.budget_max}` : 'Unspecified';
  const notes = lead.notes || 'None';
  const scope = lead.scope || 'Unspecified';
  const type = lead.project_type || 'Unspecified';

  const systemInstruction = `You are a Digital Customer Twin representing an interior design prospective client named ${lead.name || 'Client'}. 
You are speaking to an interior design sales representative.
Your budget is: ${budget}.
Your scope is: ${scope}.
Your project type is: ${type}.
Previous notes about you: ${notes}.
Your goal is to simulate how this specific customer would respond to the sales rep's message.
Respond in the first person ("I", "my"). If the rep suggests something way over your budget, push back. If they suggest something aligned with your scope, be interested but maybe ask a question. Keep it conversational, realistic, and brief (2-3 sentences max).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `System context: ${systemInstruction}\n\nSales Rep: ${prompt}`
    });
    return response.text;
  } catch (error) {
    console.error('Gemini Persona Error:', error);
    return "I'm sorry, I couldn't understand that right now. (Simulation Error)";
  }
}

/**
 * Predicts the buying intent of a lead (Cold, Warm, Hot) based on recent activity and score.
 * @param {string} tenantId 
 * @param {string} leadId 
 */
async function analyzeBuyingIntent(tenantId, leadId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { intent: 'Warm', confidence: 75, reason: 'Mocked intent due to missing API key.' };

  const ai = new GoogleGenAI({ apiKey });
  const lead = await findLeadById(tenantId, leadId);
  if (!lead) throw new Error('Lead not found for Buying Intent analysis');

  const payload = `Analyze this lead and predict their buying intent (Cold, Warm, or Hot).
Lead Profile:
- Score: ${lead.score || 0}/100
- Win Probability: ${lead.win_probability || 0}%
- Budget: ${lead.budget_max || 'Unknown'}
- Project Scope: ${lead.scope || 'Unknown'}

Recent Activities Summary: (Assume high engagement if not provided, for demo purposes)
${lead.notes || ''}

Return a valid JSON object ONLY:
{
  "intent": "Cold" | "Warm" | "Hot",
  "confidence": <number 0-100>,
  "reason": "<one short sentence explaining why>"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: payload
    });
    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini Buying Intent Error:', error);
    return { intent: 'Warm', confidence: 50, reason: 'Failed to analyze intent' };
  }
}

/**
 * Analyzes the sentiment of a lead based on their notes and profile.
 * @param {string} tenantId 
 * @param {string} leadId 
 */
async function analyzeSentiment(tenantId, leadId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { mood: 'Neutral', emoji: '😐', tip: 'Mocked sentiment due to missing API key.' };

  const ai = new GoogleGenAI({ apiKey });
  const lead = await findLeadById(tenantId, leadId);
  if (!lead) throw new Error('Lead not found for Sentiment analysis');

  const payload = `Analyze this lead's profile and notes to determine their current emotional mood/sentiment.
Lead Name: ${lead.name}
Notes/Activities: ${lead.notes || 'No recent notes.'}

Return a valid JSON object ONLY:
{
  "mood": "Positive" | "Neutral" | "Negative" | "Frustrated" | "Excited",
  "emoji": "<one suitable emoji>",
  "tip": "<one actionable short coaching tip for the sales rep>"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: payload
    });
    let text = response.text.trim();
    if (text.startsWith('```json')) text = text.replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini Sentiment Error:', error);
    return { mood: 'Neutral', emoji: '😐', tip: 'Failed to analyze sentiment.' };
  }
}

module.exports = {
  analyzeLeadConversations,
  summarizeActivity,
  parseDocument,
  analyzeLeadIntelligence,
  generateDesignProposal,
  summarizeMeeting,
  simulateLeadPersona,
  analyzeBuyingIntent,
  analyzeSentiment
};
