const fs = require('fs');
const path = require('path');
const dir = 'client/src/components/analytics';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let original = content;
  
  // Replace ResponsiveContainer height="100%" with height={280}
  content = content.replace(/height="100%"/g, 'height={280}');
  
  // Also strip height: '100%' and overflowY: 'auto' from inline wrappers 
  // since this was requested by the user
  content = content.replace(/height:\s*'100%',?\s*/g, '');
  content = content.replace(/overflowY:\s*'auto',?\s*/g, '');
  
  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log('Fixed', f);
  }
});
console.log('Done');
