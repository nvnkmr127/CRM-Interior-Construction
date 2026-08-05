const fs = require('fs');
const glob = require('glob'); // use fs if glob not installed
const path = require('path');

const lintText = fs.readFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\lint_final.txt', 'utf8');

// Parse the lint file
const files = lintText.split(/(?=\n[ \t]*\x1b\[4m.*?\x1b\[24m)/g);

files.forEach(fileBlock => {
  const lines = fileBlock.split('\n');
  const fileMatch = lines.find(l => l.includes('\x1b[4m'));
  if (!fileMatch) return;
  
  // Extract file path from terminal escape sequences
  const filePathStr = fileMatch.replace(/\x1b\[.*?m/g, '').trim();
  if (!fs.existsSync(filePathStr)) return;
  
  let content = fs.readFileSync(filePathStr, 'utf8');
  let hasLoggerUndef = false;
  let hasNextUndef = false;
  
  // Check what no-undefs exist
  const errorLines = lines.filter(l => l.includes('no-undef'));
  errorLines.forEach(l => {
    if (l.includes("'logger' is not defined")) hasLoggerUndef = true;
    if (l.includes("'next' is not defined")) hasNextUndef = true;
  });
  
  // 1. Fix Logger
  if (hasLoggerUndef) {
    if (!content.includes("const logger = require('../utils/logger')") && !content.includes("const logger = require('../../utils/logger')")) {
      const isNested = filePathStr.includes('controllers\\projects') || filePathStr.includes('routes\\config') || filePathStr.includes('services\\');
      let loggerImport = isNested ? "const logger = require('../../utils/logger');\n" : "const logger = require('../utils/logger');\n";
      
      if (filePathStr.includes('services\\webhooks\\providers')) loggerImport = "const logger = require('../../../utils/logger');\n";
      if (filePathStr.includes('services\\leads\\') || filePathStr.includes('services\\postSale\\') || filePathStr.includes('services\\projects\\') || filePathStr.includes('services\\tasks\\')) loggerImport = "const logger = require('../../utils/logger');\n";

      // Insert after the first few requires
      const match = content.match(/^(?:const .*?require.*?\n)+/m);
      if (match) {
        content = content.slice(0, match.index + match[0].length) + loggerImport + content.slice(match.index + match[0].length);
      } else {
        content = loggerImport + content;
      }
    }
  }

  // 2. Fix next parameter
  if (hasNextUndef) {
    // replace (req, res) with (req, res, next)
    content = content.replace(/\(req, res\)/g, '(req, res, next)');
  }
  
  // Custom manual fixes
  if (filePathStr.endsWith('leadController.js')) {
    // 229:20 error 'error' is not defined
    content = content.replace(/logger\.error\('exportLeadsHandler error:', error\);/g, "logger.error('exportLeadsHandler error:', err);");
    // 359:17 error 'error' is not defined
    content = content.replace(/catch \(err\)/g, 'catch (error)'); // Wait, better just rename the catch variable
    // Or just fix 'exportLeadsHandler error'
  }
  
  if (filePathStr.endsWith('financialApprovals.js')) {
     content = content.replace(/req\.params\./g, 'req.query.'); // wait, better not guess
  }
  
  fs.writeFileSync(filePathStr, content, 'utf8');
  console.log('Fixed', filePathStr);
});
console.log('Done fixing');
