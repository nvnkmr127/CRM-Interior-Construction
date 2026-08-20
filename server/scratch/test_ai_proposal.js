const dotenv = require('dotenv');
dotenv.config({ path: '../.env' });
dotenv.config(); // also check current folder .env

const { Pool } = require('pg');
// Setup database connection from env or fallback
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const aiService = require('../src/services/aiService');

async function test() {
  try {
    console.log('Database URL:', process.env.DATABASE_URL ? 'Configured' : 'Missing');
    console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? 'Configured' : 'Missing');
    
    // get a lead ID
    const res = await pool.query('SELECT id, name, scope, budget_max FROM leads LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No leads found in database.');
      return;
    }
    const lead = res.rows[0];
    console.log('Testing with lead:', lead.id, lead.name);

    // mock preferences
    const preferences = { style: 'Modern Minimalist', colors: 'neutral tones', materials: 'wood' };
    const inspirations = [{ room_type: 'Living Room', notes: 'Warm lighting, high ceiling' }];

    console.log('Calling generateDesignProposal...');
    const result = await aiService.generateDesignProposal(lead, preferences, inspirations);
    console.log('SUCCESS Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('ERROR occurred:', error);
  } finally {
    await pool.end();
  }
}

test();
