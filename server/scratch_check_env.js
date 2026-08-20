require('dotenv').config();
console.log('ROOT GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log('SERVER GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
console.log('API key length:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
