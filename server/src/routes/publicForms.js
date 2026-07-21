const express = require('express');
const router = express.Router();
const publicFormController = require('../controllers/publicFormController');
const rateLimit = require('express-rate-limit');

// Rate limiting for public form endpoints
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' }
});

router.use(formLimiter);

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.get('/:slug', publicFormController.getFormBySlug);
router.post('/:slug/submit', upload.any(), publicFormController.submitForm);

module.exports = router;
