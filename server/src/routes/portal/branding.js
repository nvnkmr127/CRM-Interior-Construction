const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticatePortal = require('../../middleware/authenticatePortal'); // Ensure this uses portal token

router.use(authenticatePortal);

router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId; // From portal token

    const result = await pool.query(`
      SELECT name, config->>'accent_colour' as accent_colour,
        config->>'logo_url' as logo_url
      FROM tenants WHERE id=$1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        companyName: row.name,
        accentColour: row.accent_colour,
        logoUrl: row.logo_url
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
