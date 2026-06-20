const fs = require('fs'); 
const path = require('path'); 

function walk(dir) { 
  let results = []; 
  const list = fs.readdirSync(dir); 
  list.forEach(file => { 
    file = path.join(dir, file); 
    const stat = fs.statSync(file); 
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file)); 
    } else { 
      if (file.endsWith('.js')) results.push(file); 
    } 
  }); 
  return results; 
} 

const files = walk('./src'); 
let errors = 0; 
files.forEach(f => { 
  try { 
    require('./' + f); 
  } catch (e) { 
    // Ignore db connections dying or missing env vars since we are just checking syntax/requires
    if (e.message.includes('relation') || e.message.includes('password') || e.message.includes('role') || e.message.includes('listen')) {
      return;
    }
    console.error('Error in ' + f + ':', e.message); 
    errors++; 
  } 
}); 
console.log('Total specific require errors:', errors);
