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
      const before = content;

      if (/erroror+/.test(content)) {
        content = content.replace(/erroror+/g, 'error');
      }
      
      content = content.replace(/catch\s*\(\s*err\s*\)/g, 'catch (error)');
      content = content.replace(/catch\s*\(\s*e\s*\)/g, 'catch (error)');
      content = content.replace(/\.catch\(\s*err\s*=>/g, '.catch(error =>');
      content = content.replace(/\.catch\(\s*e\s*=>/g, '.catch(error =>');
      content = content.replace(/\(err, req/g, '(error, req');
      content = content.replace(/function\s*\(err\)/g, 'function(error)');
      content = content.replace(/function\s*\(e\)/g, 'function(error)');
      
      content = content.replace(/\bnext\(err\)/g, 'next(error)');
      content = content.replace(/\bnext\(e\)/g, 'next(error)');
      
      content = content.replace(/\berr\./g, 'error.');
      content = content.replace(/\be\./g, 'error.');
      
      content = content.replace(/,\s*err\)/g, ', error)');
      content = content.replace(/,\s*e\)/g, ', error)');
      content = content.replace(/:\s*err\b/g, ': error');
      content = content.replace(/:\s*e\b/g, ': error');
      
      content = content.replace(/\bthrow err;/g, 'throw error;');
      content = content.replace(/\bthrow e;/g, 'throw error;');
      
      content = content.replace(/logger\.error\(\s*err\b/g, 'logger.error(error');
      content = content.replace(/logger\.error\(\s*e\b/g, 'logger.error(error');
      
      content = content.replace(/\bconst err\s*=/g, 'const error =');
      content = content.replace(/\blet err\s*=/g, 'let error =');
      content = content.replace(/\bvar err\s*=/g, 'var error =');
      
      if (content !== before) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
processDir(path.join(__dirname, 'server', 'src'));

const loggerPath = path.join(__dirname, 'server', 'src', 'utils', 'logger.js');
const loggerContent = `const logger = {
  info: (...args) => console.log(new Date().toISOString(), '[INFO]', ...args),
  warn: (...args) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  error: (...args) => console.error(new Date().toISOString(), '[ERROR]', ...args),
  debug: (...args) => console.debug(new Date().toISOString(), '[DEBUG]', ...args),
};

module.exports = logger;
`;
fs.writeFileSync(loggerPath, loggerContent);
