const fs = require('fs');
try {
  // Try to find local storage dump or mockData.js changes
  const mockDbPath = 'd:\\Digicloudify softwares\\CRM-Interior-Construction\\client\\src\\api\\mockData.js';
  const content = fs.readFileSync(mockDbPath, 'utf8');
  console.log('Mock contacts:', content.split('contacts: [')[1].split('],')[0]);
} catch (e) {
  console.log('Error', e.message);
}
