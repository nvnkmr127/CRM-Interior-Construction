const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchFiles(fullPath);
        } else if (fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('logActivity') && content.includes('insert into activities') || content.toLowerCase().includes('insert into activities')) {
                fs.appendFileSync('search_output.txt', fullPath + '\n');
            }
        }
    }
}

fs.writeFileSync('search_output.txt', '');
searchFiles('server/src');
