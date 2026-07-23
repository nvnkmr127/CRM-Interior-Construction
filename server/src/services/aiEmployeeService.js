const { GoogleGenAI } = require('@google/genai');

/**
 * AI Employee Service
 * Integrates with Google Gemini for employee management insights and NLP operations.
 */

const FALLBACK_INSIGHTS = {
  anomalies: [
    { type: 'inactive', severity: 'low', message: 'AI Analysis disabled: Check users manually for inactivity.' }
  ]
};

async function detectAnomalies(users) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK_INSIGHTS;

  const ai = new GoogleGenAI({ apiKey });

  // Only send minimal data to avoid huge token counts
  const userData = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role || u.role_name,
    lastActive: u.lastActive,
    status: u.status
  }));

  const prompt = `
    You are an AI Security and HR Assistant. Analyze the following list of active and pending employees.
    Look for:
    1. Duplicate Employees: Users with very similar names or slightly mispelled emails.
    2. Inactive Accounts: Users whose lastActive date is very old (assume current date is 2026-07-23).
    3. Security Risks: Any weird data points (e.g. multiple superadmins with generic emails like "admin@").

    Return a JSON object exactly matching this schema:
    {
      "anomalies": [
        { "type": "duplicate" | "inactive" | "security", "severity": "low" | "medium" | "high", "message": "Description of the issue." }
      ]
    }

    Employee Data:
    ${JSON.stringify(userData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    
    return JSON.parse(text);
  } catch (error) {
    console.error('[AI Employee Service] Failed anomaly detection:', error);
    return FALLBACK_INSIGHTS;
  }
}

async function naturalLanguageSearch(query, users) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Basic fallback: simple string match
    const q = query.toLowerCase();
    const ids = users.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.status && u.status.toLowerCase().includes(q))
    ).map(u => u.id);
    return { matchingIds: ids };
  }

  const ai = new GoogleGenAI({ apiKey });

  const userData = users.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role || u.role_name,
    status: u.status,
    dept: u.department_name
  }));

  const prompt = `
    You are an AI filter engine.
    User Query: "${query}"
    
    Filter the following array of employees to match the user's natural language query.
    Return ONLY a JSON array of the matching employee IDs exactly matching this schema:
    {
      "matchingIds": [1, 5, 12]
    }

    Employee Data:
    ${JSON.stringify(userData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    let text = typeof response.text === 'function' ? response.text() : response.text;
    text = text.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    return JSON.parse(text);
  } catch (error) {
    console.error('[AI Employee Service] NLP search failed:', error);
    return { matchingIds: [] };
  }
}

async function generateEmployeeSummary(user) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "AI Summary disabled. Missing GEMINI_API_KEY.";

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    Write a 1-2 sentence professional summary of this employee based on their profile data:
    Name: ${user.name}
    Role: ${user.role_name || user.role}
    Status: ${user.status}
    Joined: ${user.created_at || 'Unknown'}
    Last Active: ${user.lastActive || 'Never'}
    
    Keep it very brief and objective.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return (typeof response.text === 'function' ? response.text() : response.text).trim();
  } catch (error) {
    console.error('[AI Employee Service] Summary failed:', error);
    return "Failed to generate AI summary.";
  }
}

async function generateOnboardingChecklist(roleName, deptName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return ['Set up email account', 'Assign to manager', 'Provide system access'];

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    Generate a 3-5 item onboarding task checklist for a new employee joining as a "${roleName || 'Employee'}" in the "${deptName || 'General'}" department of an interior design firm.
    Return a JSON array of strings exactly matching this schema:
    [
      "Task 1",
      "Task 2"
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
    if (text.startsWith('```json')) text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    return JSON.parse(text);
  } catch (error) {
    console.error('[AI Employee Service] Checklist failed:', error);
    return ['Set up email', 'Provide CRM access'];
  }
}

module.exports = {
  detectAnomalies,
  naturalLanguageSearch,
  generateEmployeeSummary,
  generateOnboardingChecklist
};
