const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const labourAttendanceRepository = require('../repositories/labourAttendanceRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const checkInSchema = z.object({
  workerName: z.string().min(1, 'Worker name is required'),
  trade: z.string().min(1, 'Trade is required'),
  vendorId: z.string().uuid().optional().nullable(),
  contractorName: z.string().optional().nullable(),
  workAssigned: z.string().optional().nullable(),
  attendanceMethod: z.enum(['manual', 'qr', 'otp']).default('manual')
});

const checkOutSchema = z.object({
  checkOutTime: z.string().datetime().optional()
});

// POST /api/projects/:projectId/attendance/check-in
router.post('/check-in', authorize('projects:manage'), validate(checkInSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const mappedData = {
      worker_name: data.workerName,
      trade: data.trade,
      vendor_id: data.vendorId,
      contractor_name: data.contractorName,
      work_assigned: data.workAssigned,
      attendance_method: data.attendanceMethod
    };

    const attendance = await labourAttendanceRepository.checkInWorker(
      req.tenantId,
      req.params.projectId,
      mappedData
    );

    return success(res, attendance, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[LabourAttendance Router] Check-in error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to check in worker.', 500);
  }
});

// PATCH /api/projects/:projectId/attendance/:id/check-out
router.patch('/:id/check-out', authorize('projects:manage'), validate(checkOutSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const checkOutTime = data.checkOutTime || new Date().toISOString();

    const attendance = await labourAttendanceRepository.checkOutWorker(
      req.tenantId,
      req.params.id,
      checkOutTime
    );

    if (!attendance) {
      return fail(res, 'NOT_FOUND', 'Attendance record not found.', 404);
    }

    return success(res, attendance);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[LabourAttendance Router] Check-out error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to check out worker.', 500);
  }
});

// GET /api/projects/:projectId/attendance
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const attendances = await labourAttendanceRepository.findAttendanceByProject(
      req.tenantId,
      req.params.projectId
    );
    return success(res, attendances);
  } catch (err) {
    console.error('[LabourAttendance Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch attendance records.', 500);
  }
});

module.exports = router;
