const aiService = require('../../../services/aiService');
const pool = require('../../../db/pool');

/**
 * Invokes AI operations (e.g., generating summary, next steps, extracting insights)
 */
async function handle(config, context) {
  const { actionType, prompt, outputField } = config; // config from DB
  const { record, _tenantId } = context;

  console.log(`[Automation - AI] Invoking AI Action '${actionType}' for record ${record.id}`);

  try {
    if (actionType === 'generate_summary') {
      const summary = await aiService.generateSummary(record); // Example function
      if (outputField && summary) {
        const safeOutputField = outputField.replace(/[^a-zA-Z0-9_]/g, '');
        // Assume record is a lead for now
        await pool.query(`UPDATE leads SET ${safeOutputField} = $1 WHERE id = $2`, [summary, record.id]);
      }
    } else if (actionType === 'custom_prompt') {
       // Could be used for custom evaluation
       const result = await aiService.generateCustom(prompt, record);
       if (outputField && result) {
         const safeOutputField = outputField.replace(/[^a-zA-Z0-9_]/g, '');
         await pool.query(`UPDATE leads SET ${safeOutputField} = $1 WHERE id = $2`, [result, record.id]);
       }
    }
  } catch (error) {
    console.error(`[Automation - AI] Failed AI action:`, error);
  }
}

module.exports = { handle };
