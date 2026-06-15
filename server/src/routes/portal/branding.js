const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Stub: Return hardcoded tenant name and accent color
  res.json({ success: true, data: { name: 'Digicloudify Interiors', accentColor: '#4f46e5' } });
});

module.exports = router;
