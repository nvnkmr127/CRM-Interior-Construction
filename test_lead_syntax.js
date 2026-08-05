const fs = require('fs');
try {
  require('./server/src/controllers/leadController');
  fs.writeFileSync('test_lead_output.txt', 'success');
} catch (e) {
  fs.writeFileSync('test_lead_output.txt', e.stack);
}
