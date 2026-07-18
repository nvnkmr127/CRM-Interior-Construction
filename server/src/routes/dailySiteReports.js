const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const dailySiteReportRepository = require('../repositories/dailySiteReportRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createReportSchema = z.object({
  reportDate: z.string().optional(),
  workDone: z.string().min(1, 'Work done description is required'),
  manpower: z.array(z.object({
    trade: z.string().min(1, 'Trade is required'),
    count: z.number().int().nonnegative('Count must be non-negative')
  })).optional(),
  materials: z.array(z.object({
    material: z.string().min(1, 'Material name is required'),
    quantity: z.string().min(1, 'Quantity is required')
  })).optional(),
  issuesEncountered: z.string().optional().nullable(),
  photos: z.array(z.string()).min(3, 'At least three progress photo uploads are required'),
  tomorrowsPlan: z.string().min(1, 'Tomorrow\'s plan is required'),
  supervisorSignature: z.string().min(1, 'Supervisor signature is required')
});

// GET /api/projects/:projectId/daily-reports
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const reports = await dailySiteReportRepository.findReportsByProject(
      req.tenantId,
      req.params.projectId
    );
    return success(res, reports);
  } catch (err) {
    console.error('[DailySiteReports Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch daily site reports.', 500);
  }
});

// GET /api/projects/:projectId/daily-reports/:id
router.get('/:id', authorize('projects:read'), async (req, res) => {
  try {
    const report = await dailySiteReportRepository.findReportById(
      req.tenantId,
      req.params.id
    );
    if (!report) return fail(res, 'NOT_FOUND', 'Daily report not found.', 404);
    return success(res, report);
  } catch (err) {
    console.error('[DailySiteReports Router] Get error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch daily site report details.', 500);
  }
});

// POST /api/projects/:projectId/daily-reports
router.post('/', authorize('projects:manage'), validate(createReportSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    
    const pool = require('../db/pool');

    // End-of-day cutoff check
    const tenantRes = await pool.query('SELECT config FROM tenants WHERE id = $1', [req.tenantId]);
    const configStr = tenantRes.rows[0]?.config || '{}';
    const config = typeof configStr === 'string' ? JSON.parse(configStr) : configStr;
    const cutoffTime = config.dsr_cutoff_time || '23:59';

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);
    
    if (currentHour > cutoffHour || (currentHour === cutoffHour && currentMinute > cutoffMinute)) {
      return fail(res, 'PAST_CUTOFF_TIME', `Daily site reports must be submitted before ${cutoffTime}.`, 400);
    }

    // Check if report already exists for this project on this date
    const reportDate = data.reportDate || new Date().toISOString().split('T')[0];
    const existingCheck = await pool.query(
      'SELECT id FROM daily_site_reports WHERE project_id = $1 AND report_date = $2 AND tenant_id = $3',
      [req.params.projectId, reportDate, req.tenantId]
    );

    if (existingCheck.rows.length > 0) {
      return fail(res, 'DUPLICATE_REPORT', 'A daily site report has already been submitted for this date.', 400);
    }

    const mappedData = {
      project_id: req.params.projectId,
      report_date: reportDate,
      work_done: data.workDone,
      manpower: data.manpower,
      materials: data.materials,
      issues_encountered: data.issuesEncountered,
      photos: data.photos,
      tomorrows_plan: data.tomorrowsPlan,
      supervisor_signature: data.supervisorSignature
    };

    const report = await dailySiteReportRepository.createReport(
      req.tenantId,
      req.user?.userId,
      mappedData
    );

    // Automatically compile and archive Daily Site Report PDF (runs in try/catch to protect API response)
    try {
      const pdfService = require('../services/projects/dailySiteReportPdfService');
      await pdfService.archiveDailySiteReport(req.tenantId, report.id, req.user?.userId);
    } catch (pdfErr) {
      console.error('[DailySiteReports Router] PDF Archiving failed:', pdfErr);
    }

    return success(res, report, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[DailySiteReports Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to submit daily site report.', 500);
  }
});

module.exports = router;
