/**
 * Estimator App Service (Stub/Placeholder for client's specific estimator app)
 */

async function sendLeadToEstimator(lead) {
  const apiUrl = process.env.ESTIMATOR_API_URL || 'https://api.your-estimator-app.com/v1/leads';
  const apiKey = process.env.ESTIMATOR_API_KEY;

  if (!apiKey) {
    console.warn('[Estimator Service] API Key missing. Simulating sending lead to estimator app:', lead.id);
    return { success: true, simulated: true, estimator_reference_id: `est_${Date.now()}` };
  }

  try {
    const payload = {
      external_id: lead.id,
      client_name: lead.name,
      client_phone: lead.phone,
      client_email: lead.email,
      project_type: lead.project_type,
      scope_notes: lead.scope
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Estimator API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[Estimator Service] Failed to send lead to estimator:', error);
    throw error;
  }
}

module.exports = {
  sendLeadToEstimator
};
