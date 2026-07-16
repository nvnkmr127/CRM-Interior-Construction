const fs = require('fs');

const content = fs.readFileSync('server/src/routes/dashboard.js', 'utf8');
const stack = [];

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '{') {
    stack.push({ char, idx: i, line: content.slice(0, i).split('\n').length });
  } else if (char === '}') {
    if (stack.length > 0 && stack[stack.length - 1].char === '{') {
      stack.pop();
    } else {
      console.log(`Unmatched closing brace at line ${content.slice(0, i).split('\n').length}`);
    }
  } else if (char === '(') {
    stack.push({ char, idx: i, line: content.slice(0, i).split('\n').length });
  } else if (char === ')') {
    if (stack.length > 0 && stack[stack.length - 1].char === '(') {
      stack.pop();
    } else {
      console.log(`Unmatched closing paren at line ${content.slice(0, i).split('\n').length}`);
    }
  }
}

if (stack.length > 0) {
  console.log('Unclosed brackets found:');
  stack.forEach(b => console.log(`- '${b.char}' at line ${b.line}`));
} else {
  console.log('No unclosed brackets found.');
}
