const fs = require('fs');
const path = require('path');

const DIRECTORIES_TO_SCAN = [
  path.join(__dirname, 'server', 'src', 'services'),
  path.join(__dirname, 'server', 'src', 'controllers'),
  path.join(__dirname, 'server', 'src', 'routes'),
  path.join(__dirname, 'server', 'src', 'utils')
];

function processFile(filePath) {
  if (!filePath.endsWith('.js')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace console.log and console.error
  let hasChanges = false;
  
  if (content.includes('console.log(')) {
    content = content.replace(/console\.log\(/g, 'logger.info(');
    hasChanges = true;
  }
  if (content.includes('console.error(')) {
    content = content.replace(/console\.error\(/g, 'logger.error(');
    hasChanges = true;
  }

  // If we made changes and there is no logger imported, inject it at the top
  if (hasChanges && !content.includes("require('../utils/logger')") && !content.includes("require('../../utils/logger')") && !content.includes("require('../../../utils/logger')")) {
    
    // Calculate relative path to logger
    const loggerPathAbsolute = path.join(__dirname, 'server', 'src', 'utils', 'logger');
    let relativePath = path.relative(path.dirname(filePath), loggerPathAbsolute).replace(/\\/g, '/');
    if (!relativePath.startsWith('.')) relativePath = './' + relativePath;

    const importStatement = `const logger = require('${relativePath}');\n`;
    content = importStatement + content;
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else {
      processFile(fullPath);
    }
  }
}

console.log('Starting logging refactor...');
for (const dir of DIRECTORIES_TO_SCAN) {
  scanDir(dir);
}
console.log('Finished logging refactor.');
