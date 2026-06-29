const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../client/src/api/mockInterceptor.js');
const code = fs.readFileSync(filePath, 'utf8');

let stack = [];
let i = 0;
let lines = code.split('\n');

// A quick simplified parser that tokenizes curly braces, ignoring comments and strings
let matches = [];

while (i < code.length) {
  const char = code[i];

  if (char === '/' && code[i + 1] === '/') {
    i += 2;
    while (i < code.length && code[i] !== '\n') i++;
    continue;
  }
  if (char === '/' && code[i + 1] === '*') {
    i += 2;
    while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
    i += 2;
    continue;
  }
  if (char === '"') {
    i++;
    while (i < code.length && code[i] !== '"') {
      if (code[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }
  if (char === "'") {
    i++;
    while (i < code.length && code[i] !== "'") {
      if (code[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }
  if (char === '`') {
    i++;
    while (i < code.length && code[i] !== '`') {
      if (code[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }

  if (char === '{') {
    const lineNum = code.substring(0, i).split('\n').length;
    stack.push({ index: i, line: lineNum, text: lines[lineNum - 1].trim() });
  } else if (char === '}') {
    const lineNum = code.substring(0, i).split('\n').length;
    if (stack.length > 0) {
      const open = stack.pop();
      matches.push({ open, close: { line: lineNum, text: lines[lineNum - 1].trim() } });
    }
  }
  i++;
}

// Print the matches from bottom to top to see where it breaks down
console.log('Last 20 matching braces:');
matches.slice(-20).forEach(m => {
  console.log(`Open Line ${m.open.line} ("${m.open.text}") -> Close Line ${m.close.line} ("${m.close.text}")`);
});
