const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const storage = require('../utils/storage');

// Get all site visits for a lead
router.get('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      SELECT sv.*, u.name as assignee_name
      FROM site_visits sv
      LEFT JOIN users u ON sv.assignee_id = u.id
      WHERE sv.tenant_id = $1 AND sv.lead_id = $2
      ORDER BY sv.scheduled_at DESC
    `;
    const result = await pool.query(query, [tenantId, leadId]);
    
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Get all site visits for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      SELECT sv.*, u.name as assignee_name
      FROM site_visits sv
      LEFT JOIN users u ON sv.assignee_id = u.id
      WHERE sv.tenant_id = $1 AND sv.project_id = $2
      ORDER BY sv.scheduled_at DESC
    `;
    const result = await pool.query(query, [tenantId, projectId]);
    
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new site visit for a lead
router.post('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { scheduled_at, assignee_id, notes, checklist, client_invited } = req.body;

    const query = `
      INSERT INTO site_visits (tenant_id, lead_id, assignee_id, scheduled_at, notes, checklist, client_invited)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, leadId, assignee_id || req.user.userId, scheduled_at, notes, JSON.stringify(checklist || []), client_invited || false
    ]);

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Create a new site visit for a project
router.post('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { scheduled_at, assignee_id, notes, checklist, client_invited } = req.body;

    const query = `
      INSERT INTO site_visits (tenant_id, project_id, assignee_id, scheduled_at, notes, checklist, client_invited)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, projectId, assignee_id || req.user.userId, scheduled_at, notes, JSON.stringify(checklist || []), client_invited || false
    ]);

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Update a site visit (Check-in, complete, add measurements, reschedule, reassign, add feedback)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { 
      status, 
      gps_coordinates, 
      measurements, 
      notes, 
      completed_at, 
      customer_signature_url,
      scheduled_at,
      assignee_id,
      checklist,
      client_invited,
      client_feedback
    } = req.body;

    const query = `
      UPDATE site_visits 
      SET status = COALESCE($1, status),
          gps_coordinates = COALESCE($2, gps_coordinates),
          measurements = COALESCE($3, measurements),
          notes = COALESCE($4, notes),
          completed_at = COALESCE($5, completed_at),
          customer_signature_url = COALESCE($6, customer_signature_url),
          scheduled_at = COALESCE($7, scheduled_at),
          assignee_id = COALESCE($8, assignee_id),
          checklist = COALESCE($9, checklist),
          client_invited = COALESCE($10, client_invited),
          client_feedback = COALESCE($11, client_feedback),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND tenant_id = $13
      RETURNING *
    `;
    const result = await pool.query(query, [
      status, 
      gps_coordinates ? JSON.stringify(gps_coordinates) : null,
      measurements ? JSON.stringify(measurements) : null,
      notes, 
      completed_at, 
      customer_signature_url,
      scheduled_at,
      assignee_id,
      checklist ? JSON.stringify(checklist) : null,
      client_invited,
      client_feedback,
      id, tenantId
    ]);

    if (result.rows.length === 0) return fail(res, 'NOT_FOUND', 'Site visit not found', 404);
    
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a site visit
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      DELETE FROM site_visits
      WHERE id = $1 AND tenant_id = $2
    `;
    const result = await pool.query(query, [id, tenantId]);

    if (result.rowCount === 0) return fail(res, 'NOT_FOUND', 'Site visit not found', 404);

    return success(res, { message: 'Site visit deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all photos for a site visit
router.get('/:id/photos', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      SELECT * FROM site_visit_photos
      WHERE site_visit_id = $1 AND tenant_id = $2
      ORDER BY uploaded_at DESC
    `;
    const result = await pool.query(query, [id, tenantId]);

    // Generate download URLs
    const photosWithUrls = await Promise.all(result.rows.map(async (photo) => {
      const url = await storage.getDownloadUrl(photo.file_url);
      return { ...photo, url };
    }));

    return success(res, photosWithUrls);
  } catch (error) {
    next(error);
  }
});

// Upload a photo for a site visit
router.post('/:id/photos', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const { id: siteVisitId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const storageKey = `tenant-${tenantId}/site-visits/${siteVisitId}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    await storage.uploadBuffer(storageKey, req.file.buffer, req.file.mimetype);

    const query = `
      INSERT INTO site_visit_photos (tenant_id, site_visit_id, file_url, caption)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [tenantId, siteVisitId, storageKey, caption || '']);
    
    // Generate download url for the newly created photo
    const downloadUrl = await storage.getDownloadUrl(storageKey);
    const photoWithUrl = { ...result.rows[0], url: downloadUrl };

    return success(res, photoWithUrl, {}, 201);
  } catch (error) {
    next(error);
  }
});

// Delete a photo from a site visit
router.delete('/:id/photos/:photoId', authenticate, async (req, res, next) => {
  try {
    const { id: siteVisitId, photoId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    // Fetch the photo to delete from storage
    const fetchQuery = `
      SELECT file_url FROM site_visit_photos
      WHERE id = $1 AND site_visit_id = $2 AND tenant_id = $3
    `;
    const fetchRes = await pool.query(fetchQuery, [photoId, siteVisitId, tenantId]);
    if (fetchRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Photo not found', 404);
    }

    const { file_url } = fetchRes.rows[0];

    // Delete from storage provider
    try {
      await storage.deleteFile(file_url);
    } catch (e) {
      console.warn('[SiteVisits Router] Failed to delete file from storage:', e);
    }

    // Delete from DB
    const deleteQuery = `
      DELETE FROM site_visit_photos
      WHERE id = $1 AND site_visit_id = $2 AND tenant_id = $3
    `;
    await pool.query(deleteQuery, [photoId, siteVisitId, tenantId]);

    return success(res, { message: 'Photo deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
