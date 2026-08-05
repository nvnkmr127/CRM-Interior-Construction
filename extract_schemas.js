const fs = require('fs');
const path = require('path');

const projectsPath = path.join(__dirname, 'server', 'src', 'routes', 'projects.js');
let content = fs.readFileSync(projectsPath, 'utf8');

const regex = /const (\w+Schema) = z\.object\(\{/g;
let match;
let extractedCode = `const { z } = require('zod');\n\n`;
const schemaNames = [];
const rangesToRemove = [];

while ((match = regex.exec(content)) !== null) {
  const schemaName = match[1];
  schemaNames.push(schemaName);
  
  const startIndex = match.index;
  let braceCount = 1;
  let i = startIndex + match[0].length;
  
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    else if (content[i] === '}') braceCount--;
    i++;
  }
  
  // Find the closing `);`
  while (i < content.length && (content[i] === ' ' || content[i] === '\n' || content[i] === '\r' || content[i] === ')' || content[i] === ';')) {
    i++;
    if (content[i - 1] === ';') break;
  }
  
  const endIndex = i;
  const schemaString = content.substring(startIndex, endIndex);
  extractedCode += schemaString + '\n\n';
  
  rangesToRemove.push({ start: startIndex, end: endIndex });
}

// Write the shared file
extractedCode += `module.exports = {\n  ${schemaNames.join(',\n  ')}\n};\n`;
const outPath = path.join(__dirname, 'shared', 'validators', 'projectSchemas.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, extractedCode, 'utf8');
console.log('Wrote projectSchemas.js');

// Remove from projects.js and inject import
let newContent = '';
let lastIndex = 0;
for (const range of rangesToRemove) {
  newContent += content.substring(lastIndex, range.start);
  lastIndex = range.end;
}
newContent += content.substring(lastIndex);

// Add import at top
const importStatement = `const {\n  ${schemaNames.join(',\n  ')}\n} = require('../../shared/validators/projectSchemas');\n`;
newContent = newContent.replace("const { z } = require('zod');\n", `const { z } = require('zod');\n${importStatement}`);

fs.writeFileSync(projectsPath, newContent, 'utf8');
console.log('Updated projects.js');
