const fs = require('fs');
const path = require('path');

const clientSrcPath = path.join(__dirname, '../../client/src');
let missingKeys = [];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Find .map(...) returning a JSX tag
      // Regex tries to find .map followed by arrow function returning <Tag without key=
      const regex = /\.map\s*\(\s*(?:\([^)]+\)|[a-zA-Z0-9_]+)\s*=>\s*(?:\{[^}]*return\s*)?<\s*([a-zA-Z0-9_]+)(?![^>]*key=)/g;
      
      let match;
      while ((match = regex.exec(content)) !== null) {
        // If it's a Fragment shorthand <>, we can't add key. Check if it's <>
        if (match[1] === '') continue; // < >
        
        // Find line number
        const lineNumber = content.substring(0, match.index).split('\n').length;
        missingKeys.push(`${fullPath.replace(clientSrcPath, '')}:${lineNumber}`);
      }
    }
  }
}
walk(clientSrcPath);
console.log('Missing keys found:', missingKeys.length);
if (missingKeys.length > 0) {
  console.log(missingKeys.slice(0, 50).join('\n'));
}
