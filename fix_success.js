const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let changed = false;
      // Using regex to replace res.json(success(...));
      // This regex assumes that there is only one `res.json(success(...));` per block and no weird nested structures that break it.
      // Wait, a better way is to split by "res.json(success("
      let parts = content.split('res.json(success(');
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          // Find the matching closing parenthesis for success(
          let count = 1; // we are already inside success(
          let j = 0;
          for (; j < parts[i].length; j++) {
            if (parts[i][j] === '(') count++;
            if (parts[i][j] === ')') count--;
            if (count === 0) {
              // Found the end of success(...)
              // Now we need to find the end of res.json(...)
              break;
            }
          }
          if (count === 0) {
            // Check if the next char is the closing `)` for res.json
            let k = j + 1;
            while (k < parts[i].length && /\s/.test(parts[i][k])) k++;
            if (parts[i][k] === ')') {
              // We successfully found the `))`
              // parts[i] goes from `data` until `)` (for success), then `)` for res.json
              let inner = parts[i].substring(0, j);
              let after = parts[i].substring(k + 1);
              parts[i] = 'res, ' + inner + ')' + after;
              changed = true;
            }
          }
        }
        if (changed) {
          content = parts.join('return success(');
          fs.writeFileSync(fullPath, content);
          console.log('Fixed', fullPath);
        }
      }
    }
  }
}

processDir('./server/src/routes');
