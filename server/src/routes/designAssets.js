const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createAssetSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  asset_type: z.enum(['mood_board', 'concept_board', 'reference_collection']),
  is_visible_to_client: z.boolean().optional()
});

const updateAssetSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional().nullable(),
  asset_type: z.enum(['mood_board', 'concept_board', 'reference_collection']).optional(),
  is_visible_to_client: z.boolean().optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'revision_requested']).optional()
});

const createItemSchema = z.object({
  image_url: z.string().min(1, 'Image URL/file is required'),
  title: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

// GET /api/projects/:projectId/design-assets
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const { rows: assets } = await pool.query(
      `SELECT * FROM design_assets WHERE project_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [projectId, tenantId]
    );

    if (assets.length === 0) {
      return success(res, []);
    }

    const assetIds = assets.map(a => a.id);
    const { rows: items } = await pool.query(
      `SELECT * FROM design_asset_items WHERE tenant_id = $1 AND design_asset_id = ANY($2) ORDER BY created_at ASC`,
      [tenantId, assetIds]
    );

    const itemsByAssetId = items.reduce((acc, item) => {
      if (!acc[item.design_asset_id]) {
        acc[item.design_asset_id] = [];
      }
      acc[item.design_asset_id].push(item);
      return acc;
    }, {});

    const result = assets.map(asset => ({
      ...asset,
      items: itemsByAssetId[asset.id] || []
    }));

    return success(res, result);
  } catch (err) {
    console.error('[DesignAssets Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch design assets.', 500);
  }
});

// POST /api/projects/:projectId/design-assets
router.post('/', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data = createAssetSchema.parse(req.body);
    const userId = req.user.userId;

    const query = `
      INSERT INTO design_assets (tenant_id, project_id, title, description, asset_type, is_visible_to_client, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      tenantId,
      projectId,
      data.title,
      data.description || null,
      data.asset_type,
      data.is_visible_to_client ?? false,
      userId
    ]);

    const asset = rows[0];
    asset.items = [];

    return success(res, asset, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[DesignAssets Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create design asset.', 500);
  }
});

// GET /api/projects/:projectId/design-assets/:id
router.get('/:id', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const { rows: assets } = await pool.query(
      `SELECT * FROM design_assets WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (assets.length === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset not found.', 404);
    }

    const { rows: items } = await pool.query(
      `SELECT * FROM design_asset_items WHERE tenant_id = $1 AND design_asset_id = $2 ORDER BY created_at ASC`,
      [tenantId, id]
    );

    const asset = assets[0];
    asset.items = items;

    return success(res, asset);
  } catch (err) {
    console.error('[DesignAssets Router] Detail error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch design asset details.', 500);
  }
});

// PUT /api/projects/:projectId/design-assets/:id
router.put('/:id', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;
    const data = updateAssetSchema.parse(req.body);

    const { rows: existCheck } = await pool.query(
      `SELECT * FROM design_assets WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );
    if (existCheck.length === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset not found.', 404);
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.asset_type !== undefined) {
      updates.push(`asset_type = $${idx++}`);
      values.push(data.asset_type);
    }
    if (data.is_visible_to_client !== undefined) {
      updates.push(`is_visible_to_client = $${idx++}`);
      values.push(data.is_visible_to_client);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(data.status);
    }

    if (updates.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No fields to update.', 400);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id, projectId, tenantId);
    const query = `
      UPDATE design_assets 
      SET ${updates.join(', ')} 
      WHERE id = $${idx++} AND project_id = $${idx++} AND tenant_id = $${idx++}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[DesignAssets Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update design asset.', 500);
  }
});

// DELETE /api/projects/:projectId/design-assets/:id
router.delete('/:id', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const { rowCount } = await pool.query(
      `DELETE FROM design_assets WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset not found.', 404);
    }

    return success(res, { message: 'Design asset deleted successfully.' });
  } catch (err) {
    console.error('[DesignAssets Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete design asset.', 500);
  }
});

// POST /api/projects/:projectId/design-assets/:id/items
router.post('/:id/items', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;
    const data = createItemSchema.parse(req.body);

    const { rows: assetCheck } = await pool.query(
      `SELECT id FROM design_assets WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );
    if (assetCheck.length === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset not found.', 404);
    }

    const query = `
      INSERT INTO design_asset_items (tenant_id, design_asset_id, image_url, title, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      tenantId,
      id,
      data.image_url,
      data.title || null,
      data.notes || null
    ]);

    return success(res, rows[0], {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[DesignAssets Router] Add item error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to add item to design asset.', 500);
  }
});

// DELETE /api/projects/:projectId/design-assets/:id/items/:itemId
router.delete('/:id/items/:itemId', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId, id, itemId } = req.params;
    const tenantId = req.tenantId;

    const { rows: assetCheck } = await pool.query(
      `SELECT id FROM design_assets WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );
    if (assetCheck.length === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset not found.', 404);
    }

    const { rowCount } = await pool.query(
      `DELETE FROM design_asset_items WHERE id = $1 AND design_asset_id = $2 AND tenant_id = $3`,
      [itemId, id, tenantId]
    );

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Design asset item not found.', 404);
    }

    return success(res, { message: 'Design asset item deleted successfully.' });
  } catch (err) {
    console.error('[DesignAssets Router] Delete item error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete design asset item.', 500);
  }
});

module.exports = router;
