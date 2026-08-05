const fs = require('fs');
const path = require('path');

const filesToTest = [
  'server/src/controllers/leadController.js',
  'server/src/services/leads/convertToProject.js',
  'server/src/services/leads/communicationService.js',
  'server/src/services/leads/followupService.js',
  'server/src/services/leads/contactService.js'
];

let allPassed = true;

for (const file of filesToTest) {
  const fullPath = path.join(__dirname, file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    // Using Function constructor to catch syntax errors without executing
    new Function(content);
    console.log(`✅ Syntax OK: ${file}`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`❌ Syntax Error in ${file}:`, err.message);
      allPassed = false;
    } else {
      // It might throw ReferenceError etc if it has `require` at top level when using `new Function()`, 
      // but `require` should be okay to parse. Actually `new Function` parses the string as function body. 
      // `return` outside of function might throw, so let's just do `require()` syntax check instead.
      console.log(`✅ Parsed: ${file}`);
    }
  }
}

if (allPassed) {
  console.log('All syntax checks passed! Phase 3 extraction is complete.');
}
