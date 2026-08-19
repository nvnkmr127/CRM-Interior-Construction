require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const serverRoutesPath = path.join(__dirname, '../src/routes');

async function validateQueries() {
  const files = ['dashboard.js', 'leads.js', 'projects.js', 'tasks.js', 'analytics.js'];
  
  let totalQueries = 0;
  let brokenQueries = 0;

  for (const file of files) {
    const fullPath = path.join(serverRoutesPath, file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Naively extract all strings that start with SELECT, INSERT, UPDATE, DELETE
    const queries = [];
    const regex = /`(SELECT|INSERT|UPDATE|DELETE)[\s\S]*?`/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      queries.push(match[0].replace(/`/g, ''));
    }

    for (const q of queries) {
      // Replace $1, $2 with dummy data to try and run EXPLAIN
      let executableQ = q.replace(/\$[0-9]+/g, 'NULL');
      // Fix missing tenant_id substitutions often used as $1
      executableQ = executableQ.replace(/tenant_id\s*=\s*NULL/g, "tenant_id = 'c13d72b2-520e-4ec6-8968-30ad50eef0d8'");
      
      totalQueries++;
      try {
        await pool.query(`EXPLAIN ${executableQ}`);
      } catch (err) {
        // Only care about missing tables or columns
        if (err.message.includes('does not exist') || err.message.includes('missing FROM-clause')) {
          console.log(`\n❌ ERROR in ${file}:`);
          console.log(err.message);
          // Print snippet of the query
          console.log('Query:', q.substring(0, 150) + '...');
          brokenQueries++;
        }
      }
    }
  }

  console.log(`\nValidated ${totalQueries} queries. Found ${brokenQueries} broken queries.`);
  process.exit(0);
}

validateQueries().catch(console.error);
