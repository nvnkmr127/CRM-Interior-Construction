const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'client', 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function getRelativePathToStore(filePath) {
  const storePath = path.join(__dirname, 'client', 'src', 'store', 'confirmContext');
  let rel = path.relative(path.dirname(filePath), storePath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

let filesModified = 0;

walkDir(SRC_DIR, function(filePath) {
  if (!filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('window.confirm')) {
    // 1. Add import statement
    const importStatement = `import { useConfirm } from '${getRelativePathToStore(filePath)}';\n`;
    if (!content.includes('useConfirm')) {
      // Find the last import statement
      const importMatches = [...content.matchAll(/^import.*?;?\s*$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertIndex = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex);
      } else {
        content = importStatement + content;
      }
    }

    // 2. Replace window.confirm with await confirm
    content = content.replace(/window\.confirm\(/g, 'await confirm(');
    
    // 3. Inject useConfirm hook into components
    // We will look for component definitions (functions starting with uppercase letter, or default exports)
    const compRegex = /((?:export\s+(?:default\s+)?)?(?:function\s+[A-Z]\w*\s*\([^)]*\)\s*\{|const\s+[A-Z]\w*\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>\s*\{))/g;
    content = content.replace(compRegex, (match) => {
      return match + '\n  const { confirm } = useConfirm();\n';
    });

    // 4. Ensure functions wrapping await confirm are async
    // Basic heuristics:
    content = content.replace(/onClick=\{\s*\(\)\s*=>/g, 'onClick={async () =>');
    content = content.replace(/onClick=\{\s*([a-zA-Z0-9_]+)\s*=>/g, 'onClick={async ($1) =>');
    
    // Convert named arrow functions to async if they contain await confirm
    content = content.replace(/(const\s+\w+\s*=\s*)(\([^)]*\)\s*=>\s*\{)(?=(?:[^}]*await confirm))/g, '$1async $2');
    
    // Convert inline functions to async if they aren't already
    content = content.replace(/(?<!async\s+)(\(\s*[^)]*\s*\)\s*=>\s*\{)(?=(?:[^}]*await confirm))/g, 'async $1');
    content = content.replace(/(?<!async\s+)(function\s+\w*\s*\([^)]*\)\s*\{)(?=(?:[^}]*await confirm))/g, 'async $1');

    fs.writeFileSync(filePath, content);
    console.log(`Modified ${filePath}`);
    filesModified++;
  }
});

console.log(`Total files modified: ${filesModified}`);
