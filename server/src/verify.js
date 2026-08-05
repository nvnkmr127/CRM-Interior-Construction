const fs = require('fs');
try {
  require('./controllers/leadController');
  fs.writeFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\verify_output2.txt', 'success');
} catch (error) {
  fs.writeFileSync('d:\\Digicloudify softwares\\CRM-Interior-Construction\\verify_output2.txt', error.stack);
}
