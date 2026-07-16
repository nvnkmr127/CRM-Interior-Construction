const { GoogleGenAI } = require('@google/genai');
const _pdfParse = require('pdf-parse');
const { findLeadById } = require('../repositories/leadRepository');
const { sanitizePrompt, _validateOutput } = require('../utils/aiSecurity');

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

    let resultText = typeof response.text === 'function' ? response.text() : response.text;
    resultText = resultText.trim();
    if (resultText.startsWith('```json')) resultText = resultText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
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
    const text = typeof response.text === 'function' ? response.text() : response.text;
    return text.trim();
  } catch (error) {
    console.error('[AI Service] Failed to summarize activity:', error);
    return text;
  }
}

/**
 * Generate a drafted message using Gemini
 */
async function _draftCommunication(lead, channel, instructions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return `Hello ${lead.name},\n\n[AI disabled - Please configure GEMINI_API_KEY]\n\nBest,`;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI sales assistant for an interior design CRM.
    Write a drafted ${channel} message to the following lead.
    
    Lead Name: ${lead.name}
    Lead Scope: ${lead.scope || 'Interior Design'}
    Instructions from User: ${sanitizePrompt(instructions || 'Write a polite follow-up message asking for a good time to connect.')}
    
    Keep the tone professional and warm. For WhatsApp, keep it brief and conversational. For email, use a proper structure.
    Output ONLY the draft text. Do not output markdown, preambles, or postambles.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = typeof response.text === 'function' ? response.text() : response.text;
    return text.trim();
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
    
    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
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
      nextAction: 'Schedule a showroom visit to build trust.',
      buyIntent: 'medium',
      winProbability: 50,
      aiScoreBreakdown: { "Base Score": "+50" }
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const timelineText = [
    ...(activities || []).map(a => `[Activity] ${a.created_at} - ${a.type}: ${a.notes || a.summary || ''}`),
    ...(communications || []).map(c => `[Comms] ${c.created_at} - ${c.type} (${c.direction}): ${c.content || ''}`)
  ].join('\n');

  const prefsText = preferences ? JSON.stringify(preferences) : 'None';

  const prompt = `
    You are an expert AI Sales Copilot for an interior design CRM.
    Analyze the following lead profile, preferences, and interaction timeline to extract deep sales intelligence, including win probability and lead scoring.

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
    5. Buy Intent: "high", "medium", or "low".
    6. Win Probability: An integer from 0 to 100 representing the likelihood to close.
    7. AI Score Breakdown: A JSON object of factors that added or subtracted to the score (e.g. {"Responsive": "+10", "Budget concern": "-5"}).
    8. Suggested Follow-Up Date: Calculate the optimal date and time (ISO 8601 string) to follow up next based on their engagement. For hot leads, suggest within 24 hours. For cold leads, suggest 1 week out. Ensure the timestamp is in the future. Today's date is: ${new Date().toISOString()}.

    Return a strictly formatted JSON object exactly matching this schema:
    {
      "sentiment": "Positive|Neutral|Negative|At-Risk",
      "signals": ["signal 1", "signal 2"],
      "objections": ["objection 1"],
      "nextAction": "Action string",
      "buyIntent": "high|medium|low",
      "winProbability": 75,
      "aiScoreBreakdown": { "Factor Name": "+10" },
      "suggestedFollowupDate": "YYYY-MM-DDTHH:mm:ssZ"
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

    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    const result = JSON.parse(text);

    return {
      sentiment: result.sentiment || 'Neutral',
      signals: result.signals || [],
      objections: result.objections || [],
      nextAction: result.nextAction || 'Follow up with the customer to understand their needs.',
      buyIntent: result.buyIntent || 'medium',
      winProbability: typeof result.winProbability === 'number' ? result.winProbability : 50,
      aiScoreBreakdown: result.aiScoreBreakdown || {},
      suggestedFollowupDate: result.suggestedFollowupDate || null
    };
  } catch (error) {
    console.error('[AI Service] Failed to generate lead intelligence:', error);
    return {
      sentiment: 'Neutral',
      signals: [],
      objections: [],
      nextAction: 'Could not generate AI recommendation due to an error.',
      buyIntent: 'medium',
      winProbability: 50,
      aiScoreBreakdown: { "Error": "0" }
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

    let resultText = typeof response.text === 'function' ? response.text() : response.text;
    resultText = resultText.trim();
    if (resultText.startsWith('```json')) resultText = resultText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
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
      action_items: [{ title: 'Send revised quote', due_in_days: 1 }, { title: 'Schedule site visit', due_in_days: 2 }],
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
      "action_items": [
        { "title": "Task name", "due_in_days": 1 }
      ],
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

    const text = typeof response.text === 'function' ? response.text() : response.text;
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    const result = JSON.parse(cleanText);
    
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
    const sanitizedPrompt = sanitizePrompt(prompt);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `System context: ${systemInstruction}\n\nSales Rep: ${sanitizedPrompt}`
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

/**
 * Analyzes the gap between customer budget and expected design budget, suggesting optimizations.
 * @param {string} tenantId 
 * @param {string} leadId 
 * @param {number} customerBudget 
 * @param {number} expectedBudget 
 * @param {string} scope 
 */
async function analyzeBudgetVariance(tenantId, leadId, customerBudget, expectedBudget, scope) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      variance: expectedBudget - customerBudget,
      status: 'Over Budget',
      recommendations: [
        'Switch from Acrylic to Laminate finishes in the kitchen.',
        'Reduce the number of custom false ceiling elements.',
        'Use standard modular wardrobes instead of custom built-ins.'
      ]
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const payload = `Analyze the budget variance for an interior design project.
Customer Budget: ₹${customerBudget}
Expected Budget (Planner): ₹${expectedBudget}
Project Scope/Rooms: ${scope || 'General Home Interior'}

The expected budget is higher than the customer budget. Give exactly 3 actionable, professional interior design recommendations on how to bridge this gap by value-engineering or changing materials/scope, without losing the premium feel.

Return a valid JSON object ONLY:
{
  "variance": ${expectedBudget - customerBudget},
  "status": "Over Budget",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
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
    console.error('Gemini Budget Variance Error:', error);
    return {
      variance: expectedBudget - customerBudget,
      status: 'Over Budget',
      recommendations: ['Failed to generate AI budget recommendations.']
    };
  }
}

/**
 * Generates an executive proposal summary for the bottom of the funnel.
 */
async function generateExecutiveProposal(tenantId, leadId, lead, requirements, targetBudget) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      proposal_text: `### Executive Summary\n\nDear ${lead.name},\n\nBased on our discussions, we have structured a design plan for your ${lead.property_type || 'home'}. The scope includes ${requirements?.length || 'several'} rooms, tailored to a budget of ₹${targetBudget?.toLocaleString() || lead.budget_max}. \n\nWe look forward to transforming your space into a Modern Minimalist masterpiece.`
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const payload = `You are a top-tier interior design sales executive.
Write a 1-page executive summary proposal (in markdown format) for a prospective client.
Client Name: ${lead.name}
Property: ${lead.property_type || 'Residential'} - ${lead.locality || ''}
Target Budget: ₹${targetBudget || lead.budget_max}
Requirements/Scope: ${JSON.stringify(requirements)}

The proposal should have:
1. A warm opening thanking them.
2. An 'Executive Summary' of the design vision.
3. A 'Scope of Work' high-level breakdown.
4. A 'Financial Investment' section.
5. A professional closing.

Return a valid JSON object ONLY:
{
  "proposal_text": "<the markdown formatted proposal text>"
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
    console.error('Gemini Proposal Error:', error);
    return {
      proposal_text: 'Failed to generate proposal due to an error.'
    };
  }
}

/**
 * AI Task Generation: Parses an activity and recommends follow-up tasks.
 */
async function generateTasksFromActivity(activityText, activityType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return [
      { title: 'Follow up on ' + activityType, due_in_days: 1 }
    ];
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI sales assistant. Based on the following logged activity (${activityType}), suggest 1 to 3 logical follow-up tasks for the sales rep.
    
    Activity Notes:
    ${activityText}

    Return a valid JSON array ONLY, where each object has:
    - title: "Short task description (e.g., Send Quote, Schedule Site Visit)"
    - due_in_days: number (e.g. 0 for today, 1 for tomorrow)

    Example:
    [
      { "title": "Send updated quotation based on new measurements", "due_in_days": 1 }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini Task Generation Error:', error);
    return [];
  }
}

/**
 * AI Follow-up Suggestions: Recommends specific follow-up actions and drafts.
 */
async function generateFollowupRecommendations(lead, lastActivityDate) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      recommendedAction: 'Call',
      reason: 'No contact recently.',
      draftMessage: 'Hi ' + lead.name + ', following up on our last conversation.'
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI sales assistant. Recommend a follow-up action for this lead.
    
    Lead Name: ${lead.name}
    Status/Stage: ${lead.stage || 'Active'}
    Budget: ${lead.budget_max || 'Unknown'}
    Last Contacted: ${lastActivityDate || 'Unknown'}
    Notes: ${lead.notes || 'No notes.'}
    
    Return a valid JSON object ONLY:
    {
      "recommendedAction": "Call" | "WhatsApp" | "Email" | "Meeting",
      "reason": "A short sentence explaining why.",
      "draftMessage": "A short drafted message for the rep to use (if WhatsApp or Email)."
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
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini Follow-up Recommendation Error:', error);
    return { recommendedAction: 'Call', reason: 'Error generating recommendation.', draftMessage: '' };
  }
}

/**
 * AI Sales Coach: Analyzes a meeting transcript and provides constructive feedback
 */
async function analyzeMeetingForCoaching(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      feedback: 'You missed asking about their strict timeline.',
      missed_questions: ['What is the hard deadline for move-in?'],
      strengths: ['Built great rapport early on.']
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an expert AI Sales Coach for interior design.
    Analyze this meeting transcript and give constructive feedback to the sales rep.
    
    Transcript:
    """
    ${transcript}
    """
    
    Return exactly this JSON schema:
    {
      "feedback": "A 2-3 sentence overview of the rep's performance.",
      "missed_questions": ["Important question 1 that the rep forgot to ask", "Important question 2"],
      "strengths": ["Thing 1 the rep did well", "Thing 2"]
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
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('AI Sales Coach Error:', error);
    return { feedback: 'Failed to analyze.', missed_questions: [], strengths: [] };
  }
}

/**
 * AI Knowledge Assistant: Answers questions about a lead's history
 */
async function chatWithLeadContext(lead, activities, question) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "API Key missing. Cannot answer context questions.";

  const ai = new GoogleGenAI({ apiKey });
  
  const timelineText = activities.map(a => `[${a.created_at}] ${a.type}: ${a.notes || a.summary || ''}`).join('\n');

  const prompt = `
    You are an AI Knowledge Assistant for a CRM.
    Answer the sales rep's question based strictly on the lead's history below. Keep it concise and actionable.

    Lead Name: ${lead.name}
    Lead Profile: Budget ${lead.budget_max || 'Unknown'}, Scope ${lead.scope || 'Unknown'}
    
    History:
    ${timelineText || 'No history.'}

    Question: ${question}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    let text = typeof response.text === 'function' ? response.text() : response.text;
    return text.trim();
  } catch (error) {
    console.error('AI Knowledge Assistant Error:', error);
    return "Sorry, I encountered an error while searching the lead's history.";
  }
}

/**
 * AI Voice-to-CRM: Processes an uploaded audio file (voice note), returning transcript, summary, sentiment, and action items.
 */
async function processVoiceNote(base64Audio, mimeType, leadContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      transcript: "Audio transcription simulated (no API key).",
      summary: "Simulated summary of a voice note about following up on pricing.",
      sentiment: "Positive",
      actionItems: [{ title: "Send simulated quote", due_in_days: 1 }]
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Clean = base64Audio.includes('base64,') ? base64Audio.split('base64,')[1] : base64Audio;

  const prompt = `
    You are an expert AI sales assistant for an interior design CRM.
    Listen to the following audio recording (a field sales rep's voice note).
    The lead context is: Name: ${leadContext?.name || 'Unknown'}, Scope: ${leadContext?.scope || 'Unknown'}.

    Return a strictly formatted JSON object exactly matching this schema (no markdown, just raw JSON):
    {
      "transcript": "A clean, punctuated transcription of what was said.",
      "summary": "A 1-2 sentence concise summary.",
      "sentiment": "Positive|Neutral|Negative",
      "actionItems": [
        { "title": "Extracted task name", "due_in_days": 1 }
      ]
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
    
    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Gemini Task Generation Error:', error);
    return [];
  }
}
/**
 * Analyzes communication transcript for sales objections.
 */
async function analyzeObjections(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI Sales Coach. Analyze the following conversation transcript.
    Identify if the customer raised any objections (e.g., Price, Timeline, Competitor, Trust).
    If so, return a JSON array of objects with the following schema:
    [
      { "category": "Price", "description": "Customer said it's too expensive", "suggested_rebuttal": "Focus on ROI and the long-term durability of materials." }
    ]
    If no objections, return an empty array [].

    TRANSCRIPT:
    """
    ${transcript}
    """
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = typeof response.text === 'function' ? response.text() : response.text;
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('[AI Service] Failed to analyze objections:', error);
    return [];
  }
}

/**
 * AI Budget Optimizer: Breaks down a total budget into a logical room-by-room split.
 */
async function optimizeBudgetBreakdown(totalBudget, requirements) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    You are an AI Budget Optimizer for an interior design firm.
    The customer has a total budget of ${totalBudget}.
    Their requirements are: ${requirements}.
    
    Allocate this budget realistically across the necessary rooms/areas based on standard interior design costs (e.g. Kitchens and Master Bedrooms take a larger chunk).
    
    Return a JSON array of objects exactly like this:
    [
      { "room": "Kitchen", "allocated_amount": 15000, "reason": "Custom cabinetry and appliances" },
      { "room": "Master Bedroom", "allocated_amount": 10000, "reason": "Wardrobe and premium finishes" }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = typeof response.text === 'function' ? response.text() : response.text;
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('[AI Service] Failed to optimize budget:', error);
    return [];
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
  analyzeSentiment,
  analyzeBudgetVariance,
  generateExecutiveProposal,
  generateTasksFromActivity,
  generateFollowupRecommendations,
  analyzeMeetingForCoaching,
  chatWithLeadContext,
  processVoiceNote,
  analyzeObjections,
  optimizeBudgetBreakdown
};
