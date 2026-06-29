const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../client/src/api/mockInterceptor.js');
const code = fs.readFileSync(filePath, 'utf8');

let stack = [];
let i = 0;
while (i < code.length) {
  const char = code[i];

  // Ignore single-line comments
  if (char === '/' && code[i + 1] === '/') {
    i += 2;
    while (i < code.length && code[i] !== '\n') i++;
    continue;
  }

  // Ignore multi-line comments
  if (char === '/' && code[i + 1] === '*') {
    i += 2;
    while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
    i += 2;
    continue;
  }

  // Ignore double quote string
  if (char === '"') {
    i++;
    while (i < code.length && code[i] !== '"') {
      if (code[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }

  // Ignore single quote string
  if (char === "'") {
    i++;
    while (i < code.length && code[i] !== "'") {
      if (code[i] === '\\') i++;
      i++;
    }
    i++;
    continue;
  }

  // Ignore template literal
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
    const line = code.substring(0, i).split('\n').length;
    stack.push({ char, index: i, line });
  } else if (char === '}') {
    if (stack.length === 0) {
      const line = code.substring(0, i).split('\n').length;
      console.log(`Unmatched closing brace at line ${line}`);
    } else {
      stack.pop();
    }
  }
  i++;
}

console.log('Unclosed braces left in stack:', stack.length);
stack.forEach(b => {
  const snippet = code.substring(b.index, b.index + 80).replace(/\n/g, ' ');
  console.log(`Line ${b.line}: ${snippet}`);
});
