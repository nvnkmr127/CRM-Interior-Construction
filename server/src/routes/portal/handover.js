const express = require('express');
const { z } = require('zod');
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { success, fail } = require('../../utils/response');
const { getChecklistByProjectId, clientSignOff } = require('../../services/postSale/handoverService');
const portalAuthService = require('../../services/portal/portalAuthService');
const storage = require('../../utils/storage');

const router = express.Router();

router.use(authenticatePortal);

// GET /api/portal/handover
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const checklist = await getChecklistByProjectId(projectId, tenantId);
    if (!checklist) {
      return fail(res, 'NOT_FOUND', 'Handover checklist not found', 404);
    }

    const downloadUrl = checklist.pdf_key ? await storage.getDownloadUrl(checklist.pdf_key) : null;

    // Check outstanding payment milestones
    const unpaidResult = await pool.query(
      `SELECT COUNT(*) FROM payment_milestones 
       WHERE project_id = $1 AND tenant_id = $2 
       AND status != 'paid' AND is_deferred = false`,
      [projectId, tenantId]
    );
    const hasOutstandingPayments = parseInt(unpaidResult.rows[0].count) > 0;

    return success(res, { ...checklist, downloadUrl, hasOutstandingPayments });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/handover/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, tenantId } = req.portalUser;

    // Rate limit check: max 3 OTP requests per phone per 10 minutes
    if (process.env.NODE_ENV !== 'test') {
      const rateLimitResult = await pool.query(
        `SELECT COUNT(*) FROM portal_otp_requests 
         WHERE phone = $1 AND tenant_id = $2 
         AND requested_at > NOW() - INTERVAL '10 minutes'`,
        [phone, tenantId]
      );
      if (parseInt(rateLimitResult.rows[0].count) >= 3) {
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
      }
    }

    // Track request for rate limiting
    await pool.query(
      `INSERT INTO portal_otp_requests (phone, tenant_id) VALUES ($1, $2)`,
      [phone, tenantId]
    );

    await portalAuthService.sendOtp(tenantId, phone);
    return success(res, { message: 'OTP sent to your WhatsApp/SMS' });
  } catch (error) {
    if (error.message === 'CLIENT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Client not found', 404);
    }
    next(error);
  }
});

// POST /api/portal/handover/sign-off
const signOffSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits')
});

router.post('/sign-off', async (req, res, next) => {
  try {
    const { otp } = signOffSchema.parse(req.body);
    const { projectId, tenantId, phone, name: clientName, id: portalUserId } = req.portalUser;

    // 1. Verify OTP first
    try {
      await portalAuthService.verifyOtpOnly(tenantId, phone, otp);
    } catch (err) {
      if (err.message === 'OTP_EXPIRED') {
        return fail(res, 'UNAUTHORIZED', 'OTP expired', 401);
      }
      if (err.message === 'OTP_INVALID') {
        return fail(res, 'UNAUTHORIZED', 'Invalid OTP', 401);
      }
      throw err;
    }

    // 2. Fetch active checklist
    const checklist = await getChecklistByProjectId(projectId, tenantId);
    if (!checklist) {
      return fail(res, 'NOT_FOUND', 'Handover checklist not found', 404);
    }

    // 3. Complete sign off
    const updatedChecklist = await clientSignOff({
      checklistId: checklist.id,
      tenantId,
      clientPortalUserId: portalUserId,
      clientName
    });

    return success(res, updatedChecklist, { message: 'Handover signed off successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    }
    if (error.message === 'ITEMS_INCOMPLETE') {
      return fail(res, 'BAD_REQUEST', 'All checklist items must be checked before sign-off', 400);
    }
    if (error.message === 'FINANCIAL_CLEARANCE_PENDING') {
      return fail(res, 'BAD_REQUEST', 'Financial Clearance Pending: Please clear all outstanding payment milestones or contact finance for written deferral.', 400);
    }
    next(error);
  }
});

module.exports = router;
