const fs = require('fs');
try {
  fs.unlinkSync('./server/src/validators/leadValidators.js');
} catch (e) {}
