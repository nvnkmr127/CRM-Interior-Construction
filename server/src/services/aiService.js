const { GoogleGenAI } = require('@google/genai');
let _pdfParse;
try {
  _pdfParse = require('pdf-parse');
} catch (e) {
  _pdfParse = null;
}
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
async function draftCommunication(lead, channel, instructions) {
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
async function parseDocument(base64Data, mimeType, fileName = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY not configured. Using rule-based fallback parser.');
    const nameLower = (fileName || '').toLowerCase();
    let roomCount = 3;
    let carpetArea = 1350;
    let propertyType = '3bhk';
    let scope = 'Standard modern design layout including living room woodwork, modular kitchen cabinets, and bedroom wardrobes.';

    if (nameLower.includes('2bhk') || nameLower.includes('2_bhk') || nameLower.includes('2-bhk') || nameLower.includes('2 bhk')) {
      roomCount = 2;
      carpetArea = 1100;
      scope = 'Living room entertainment unit, space-saving kitchen layout, and modular wardrobes for two bedrooms.';
    } else if (nameLower.includes('3bhk') || nameLower.includes('3_bhk') || nameLower.includes('3-bhk') || nameLower.includes('3 bhk') || nameLower.includes('floor_plan') || nameLower.includes('floorplan')) {
      roomCount = 3;
      carpetArea = 1450;
      scope = 'Living room partition and TV unit, modular parallel kitchen, and premium wardrobes for three bedrooms.';
    } else if (nameLower.includes('4bhk') || nameLower.includes('4_bhk') || nameLower.includes('4-bhk') || nameLower.includes('4 bhk')) {
      roomCount = 4;
      carpetArea = 2200;
      scope = 'L-shaped living room furniture, open-plan kitchen, master bedroom walk-in closet, and interior work for four bedrooms.';
    } else if (nameLower.includes('villa') || nameLower.includes('house') || nameLower.includes('duplex')) {
      roomCount = 5;
      carpetArea = 3200;
      propertyType = 'Villa';
      scope = 'Luxury villa design layout including multi-level false ceiling, premium bar cabinet, full kitchen, and high-end wooden paneling.';
    }

    return {
      carpet_area: carpetArea,
      room_count: roomCount,
      property_type: propertyType,
      extracted_scope: `[AI Fallback Extraction] ${scope}`
    };
  }

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
    console.error('[AI Service] Failed to generate design proposal via Gemini, returning smart fallback:', error);
    
    // Tailor fallback proposal to lead's actual scope
    const scopeStr = String(lead.scope || '').toLowerCase();
    const hasKitchen = scopeStr.includes('kitchen') || scopeStr.includes('fullhouse');
    const hasWardrobe = scopeStr.includes('wardrobe') || scopeStr.includes('bedroom') || scopeStr.includes('fullhouse');

    let recommended_style = 'Modern Contemporary';
    let design_concept = 'A balanced, modern design approach optimizing for space utilization, natural light, and premium ergonomics.';
    let color_palette = [
      { hex: '#F5F5F7', name: 'Alabaster Gray' },
      { hex: '#1C1C1E', name: 'Charcoal Black' },
      { hex: '#D2B48C', name: 'Light Oak' }
    ];
    let material_suggestions = ['Matte Black Accents', 'Engineered Wood Rafters', 'Indirect LED Strips'];

    if (hasKitchen && !hasWardrobe) {
      recommended_style = 'Sleek Modular Kitchen';
      design_concept = 'An ergonomic kitchen layout emphasizing clean lines, high storage volume, and an optimized work triangle.';
      color_palette = [
        { hex: '#FAFAFA', name: 'Crisp White' },
        { hex: '#5A6065', name: 'Steel Gray' },
        { hex: '#C5A059', name: 'Champagne Gold' }
      ];
      material_suggestions = ['Quartz Countertop', 'High-Gloss Acrylic Shutters', 'Soft-close Tandem Boxes'];
    } else if (hasWardrobe && !hasKitchen) {
      recommended_style = 'Modern Minimalist Wardrobe';
      design_concept = 'Floor-to-ceiling sleek storage designs maximizing closet volume with premium integrated lighting and accessory organizers.';
      color_palette = [
        { hex: '#EAE6DF', name: 'Warm Warm White' },
        { hex: '#7D7065', name: 'Muted Bronze' },
        { hex: '#2A2A2A', name: 'Ebony Wood' }
      ];
      material_suggestions = ['Tinted Fluted Glass', 'Soft-Touch Matte Laminate', 'Anodized Aluminium Profiles'];
    } else if (hasKitchen && hasWardrobe) {
      recommended_style = 'Luxury Japandi Fusion';
      design_concept = 'Combining Japanese minimalism with Scandinavian warmth to create functional, cozy, and highly organized living spaces.';
      color_palette = [
        { hex: '#F9F6F0', name: 'Oatmeal' },
        { hex: '#4A5D4E', name: 'Sage Green' },
        { hex: '#8B7355', name: 'Natural Oak' }
      ];
      material_suggestions = ['Terrazzo Countertop', 'Oak Veneer Paneling', 'Linen-Textured Wardrobes'];
    }

    return {
      recommended_style,
      design_concept,
      color_palette,
      material_suggestions
    };
  }
}

/**
 * Local rule-based analyzer for fallback when GEMINI_API_KEY is not available.
 */
function localAnalyzeMeeting(transcript) {
  const content = transcript || '';
  const lowercase = content.toLowerCase();

  // Keyword analysis for sentiment
  const negativeWords = [
    'expensive', 'unhappy', 'angry', 'bad', 'late', 'delay', 'cancel',
    'not satisfied', 'issue', 'problem', 'difficult', 'disappointed',
    'complained', 'poor', 'waste', 'too high', 'underperform', 'reject',
    'refuse', 'frustrated', 'complaint', 'mistake', 'error', 'wrong',
    'worry', 'concerned', 'dissatisfied', 'annoyed'
  ];

  const positiveWords = [
    'great', 'happy', 'good', 'satisfied', 'perfect', 'awesome', 'excellent',
    'love', 'excited', 'agree', 'yes', 'perfectly', 'wonderful', 'helpful',
    'nice', 'pleased', 'impressed', 'glad', 'fantastic'
  ];

  let negCount = 0;
  let posCount = 0;

  for (const word of negativeWords) {
    const regex = new RegExp('\\b' + word + '\\b', 'gi');
    const matches = content.match(regex);
    if (matches) negCount += matches.length;
  }

  for (const word of positiveWords) {
    const regex = new RegExp('\\b' + word + '\\b', 'gi');
    const matches = content.match(regex);
    if (matches) posCount += matches.length;
  }

  let sentiment = 'Neutral';
  if (negCount > posCount) {
    sentiment = 'Negative';
  } else if (posCount > negCount) {
    sentiment = 'Positive';
  }

  // Generate dynamic notes summary
  const sentences = content.split(/[.!?\n]/).map(s => s.trim()).filter(s => s.length > 5);
  let summary = '';
  if (sentences.length > 0) {
    summary = `Parsed Meeting Summary: ${sentences.slice(0, 3).join('. ') + '.'}`;
  } else {
    summary = 'Meeting notes parsed successfully, but no detailed discussion text was provided.';
  }

  // Extract task/action items
  const actionItems = [];
  const actionKeywords = ['will', 'need to', 'should', 'have to', 'must', 'please', 'task', 'todo', 'send', 'schedule', 'follow up', 'check', 'call', 'email', 'review', 'prepare'];
  
  for (const sentence of sentences) {
    const lowerSent = sentence.toLowerCase();
    const hasKeyword = actionKeywords.some(keyword => lowerSent.includes(keyword));
    if (hasKeyword && sentence.length < 100) {
      const cleanTask = sentence.replace(/^[^a-zA-Z0-9]+/, '').replace(/[^a-zA-Z0-9]+$/, '');
      if (cleanTask.length > 10 && !actionItems.some(item => item.title.toLowerCase() === cleanTask.toLowerCase())) {
        actionItems.push({
          title: cleanTask,
          due_in_days: lowerSent.includes('tomorrow') || lowerSent.includes('urgent') ? 1 : 3
        });
      }
    }
    if (actionItems.length >= 4) break;
  }

  if (actionItems.length === 0) {
    actionItems.push({ title: 'Follow up on discussion points', due_in_days: 2 });
    if (lowercase.includes('quote') || lowercase.includes('pricing') || lowercase.includes('cost')) {
      actionItems.push({ title: 'Send revised quote and financial estimate', due_in_days: 1 });
    }
    if (lowercase.includes('site') || lowercase.includes('visit') || lowercase.includes('measurement')) {
      actionItems.push({ title: 'Schedule site visit and measurements', due_in_days: 3 });
    }
  }

  // Dynamic coaching feedback
  let feedback = 'Overall positive interaction. The client seems receptive and interested. Keep up the momentum!';
  const missedQuestions = [];
  const strengths = [];

  if (sentiment === 'Negative') {
    feedback = 'The client expressed significant concerns or objections during this meeting. Focus on showing empathy, identifying root causes, and systematically addressing their hesitation.';
    missedQuestions.push('What specific part of the proposal is causing the most concern?');
    missedQuestions.push('How can we adjust our scope or timelines to better align with your expectations?');
    strengths.push('Promptly documented client dissatisfaction/objections.');
  } else {
    strengths.push('Maintained a collaborative and positive tone.');
    strengths.push('Clearly established next steps.');
  }

  if (lowercase.includes('budget') || lowercase.includes('price') || lowercase.includes('cost') || lowercase.includes('expensive')) {
    strengths.push('Discussed budget constraints and financial parameters.');
  } else {
    missedQuestions.push('Do you have an established budget range or financial target for this project?');
  }

  if (lowercase.includes('timeline') || lowercase.includes('schedule') || lowercase.includes('when') || lowercase.includes('move')) {
    strengths.push('Addressed project timelines and delivery schedules.');
  } else {
    missedQuestions.push('What is your ideal move-in or project completion timeline?');
  }

  return {
    summary,
    action_items: actionItems,
    customer_sentiment: sentiment,
    suggested_next_stage: lowercase.includes('quote') ? 'Quotation Sent' : lowercase.includes('site') ? 'Site Visit Done' : null,
    sales_coach: {
      feedback,
      missed_questions: missedQuestions,
      strengths: strengths.slice(0, 3)
    }
  };
}

/**
 * AI Meeting Summarizer: Parses raw transcripts into structured summaries and action items.
 */
async function summarizeMeeting(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY missing. Returning dynamic fallback Meeting Summary.');
    const localResult = localAnalyzeMeeting(transcript);
    return {
      summary: localResult.summary,
      action_items: localResult.action_items,
      customer_sentiment: localResult.customer_sentiment,
      suggested_next_stage: localResult.suggested_next_stage
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
  const lead = await findLeadById(tenantId, leadId);
  if (!lead) throw new Error('Lead not found for Sentiment analysis');

  const pool = require('../db/pool');
  const notesRes = await pool.query(
    "SELECT notes FROM activities WHERE lead_id = $1 AND tenant_id = $2 AND type = 'note' ORDER BY created_at DESC LIMIT 5",
    [leadId, tenantId]
  );
  const recentNotes = notesRes.rows.map(r => r.notes).join(' | ');
  const combinedNotes = `${lead.notes || ''} | ${recentNotes}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const text = combinedNotes.toLowerCase();
    
    if (text.includes('excited') || text.includes('fantastic') || text.includes('love') || text.includes('dream') || text.includes('speed up')) {
      return {
        mood: 'Excited',
        emoji: '🔥',
        tip: 'The prospect is highly motivated. Follow up immediately to lock in the design agreement before enthusiasm cools down.'
      };
    }
    if (text.includes('unhappy') || text.includes('inflated') || text.includes('too high') || text.includes('expensive') || text.includes('doubt')) {
      return {
        mood: 'Negative',
        emoji: '📉',
        tip: 'Show budget flexibility. Offer value-engineering alternatives (e.g. laminate finishes instead of acrylic) to rebuild trust.'
      };
    }
    if (text.includes('frustrated') || text.includes('disappointed') || text.includes('delay') || text.includes('deadline') || text.includes('missed')) {
      return {
        mood: 'Frustrated',
        emoji: '😤',
        tip: 'Acknowledge delays immediately and apologize. Give them a realistic delivery timeline and deliver drawings priority.'
      };
    }
    if (text.includes('anxious') || text.includes('worried') || text.includes('leakage') || text.includes('guarantee') || text.includes('warranty') || text.includes('hesitant')) {
      return {
        mood: 'Negative',
        emoji: '😰',
        tip: 'Address safety concerns. Provide written catalog specifications, product warranty sheets, and testimonial proofs.'
      };
    }
    if (text.includes('positive') || text.includes('smoothly') || text.includes('approve') || text.includes('visit') || text.includes('agree')) {
      return {
        mood: 'Positive',
        emoji: '😊',
        tip: 'The client is pleased. Maintain momentum by confirming the next steps and sending the layout adjustments today.'
      };
    }

    return {
      mood: 'Neutral',
      emoji: '😐',
      tip: 'The prospect is in information-gathering mode. Keep providing valuable materials and structure your next follow-up call.'
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const payload = `Analyze this lead's profile and notes to determine their current emotional mood/sentiment.
Lead Name: ${lead.name}
Notes/Activities: ${combinedNotes || 'No recent notes.'}

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
    const localResult = localAnalyzeMeeting(transcript);
    return localResult.sales_coach;
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
  draftCommunication,
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
