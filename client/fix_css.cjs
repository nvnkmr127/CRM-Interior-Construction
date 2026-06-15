const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
  { regex: /color:\s*(#333|black);?/gi, replacement: 'color: var(--color-text);' },
  { regex: /background:\s*(#fff|#ffffff);?/gi, replacement: 'background: var(--color-surface);' },
  { regex: /background-color:\s*(#fff|#ffffff);?/gi, replacement: 'background-color: var(--color-surface);' },
  { regex: /background:\s*(#f5f5f5|#eee);?/gi, replacement: 'background: var(--color-surface-2);' },
  { regex: /border:\s*1px solid #e0e0e0;?/gi, replacement: 'border: 1px solid var(--color-border);' },
  { regex: /font-family:\s*sans-serif;?/gi, replacement: 'font-family: var(--font-sans);' },
  { regex: /font-size:\s*14px;?/gi, replacement: 'font-size: var(--text-base);' },
  { regex: /font-size:\s*16px;?/gi, replacement: 'font-size: var(--text-md);' },
  { regex: /border-radius:\s*4px;?/gi, replacement: 'border-radius: var(--radius-sm);' },
  { regex: /border-radius:\s*8px;?/gi, replacement: 'border-radius: var(--radius-md);' },
  { regex: /border-radius:\s*50%;?/gi, replacement: 'border-radius: var(--radius-full);' },
  { regex: /padding:\s*16px;?/gi, replacement: 'padding: var(--space-4);' },
  { regex: /margin-bottom:\s*8px;?/gi, replacement: 'margin-bottom: var(--space-2);' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.css') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const { regex, replacement } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
console.log('Consistency sweep completed.');
