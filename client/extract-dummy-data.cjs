const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
const content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('// Dummy Revenue Data for Demo');
const endIdx = content.indexOf('// Filter Options');

if (startIdx !== -1 && endIdx !== -1) {
  const dummyData = content.substring(startIdx, endIdx);
  
  const varRegex = /const (DUMMY_[A-Z_]+)/g;
  let match;
  const exports = [];
  while ((match = varRegex.exec(dummyData)) !== null) {
    exports.push(match[1]);
  }
  
  const newFileContent = dummyData.replace(/const (DUMMY_[A-Z_]+)/g, 'export const $1');
  
  fs.mkdirSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/data', { recursive: true });
  fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/data/dummyAnalyticsData.js', newFileContent);
  
  let newContent = content.substring(0, startIdx) + content.substring(endIdx);
  
  const importString = `import { \n  ${exports.join(',\n  ')}\n} from '../../data/dummyAnalyticsData';\n\n`;

  const lastImportIdx = newContent.lastIndexOf('import ');
  const insertIdx = newContent.indexOf('\n', lastImportIdx) + 1;
  newContent = newContent.slice(0, insertIdx) + importString + newContent.slice(insertIdx);
  
  fs.writeFileSync(file, newContent);
  console.log('Successfully extracted dummy data!');
} else {
  console.log('Could not find dummy data section');
}
