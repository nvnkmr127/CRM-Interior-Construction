const pool = require('../config/db');

// In a real application, we might want to ensure consistent tenant access
// but we'll use a local helper just like leadController
const getTenantAndUser = (req) => {
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user && req.user.userId;
  if (!tenantId) throw new Error('Tenant context missing');
  return { tenantId, userId };
};

exports.searchLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { filters, sort, cursor, limit = 20 } = req.body;
    
    // Base query
    let query = `
      SELECT 
        l.*,
        (SELECT name FROM lead_stages WHERE id = l.stage_id) as stage_name,
        (SELECT name FROM users WHERE id = l.assigned_rep_id) as assignee_name
      FROM leads l
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
    `;
    const params = [tenantId];
    let paramIndex = 2;
    
    // Apply Filters
    if (filters) {
      if (filters.stage && filters.stage.length > 0) {
        // Here we could join or map stage names to ids, assuming stage names are passed
        query += ` AND (SELECT name FROM lead_stages WHERE id = l.stage_id) = ANY($${paramIndex++})`;
        params.push(filters.stage);
      }
      
      if (filters.budget) {
        if (filters.budget.min !== undefined) {
          query += ` AND l.budget_max >= $${paramIndex++}`; // Assuming budget_max holds the budget estimate
          params.push(filters.budget.min);
        }
        if (filters.budget.max !== undefined) {
          query += ` AND l.budget_min <= $${paramIndex++}`; 
          params.push(filters.budget.max);
        }
      }
      
      if (filters.city && filters.city.length > 0) {
        query += ` AND l.city = ANY($${paramIndex++})`;
        params.push(filters.city);
      }
      
      if (filters.assignedTo && filters.assignedTo.length > 0) {
        query += ` AND l.assigned_rep_id = ANY($${paramIndex++})`;
        params.push(filters.assignedTo);
      }
      
      if (filters.createdAfter) {
        query += ` AND l.created_at >= $${paramIndex++}`;
        params.push(filters.createdAfter);
      }
      
      if (filters.scoreMin !== undefined) {
        query += ` AND l.score >= $${paramIndex++}`;
        params.push(filters.scoreMin);
      }

      if (filters.scoreMax !== undefined) {
        query += ` AND l.score <= $${paramIndex++}`;
        params.push(filters.scoreMax);
      }
      
      if (filters.noActivitySinceDays !== undefined) {
        // e.g., leads with no activity in the last 7 days
        query += ` AND l.updated_at <= (NOW() - ($${paramIndex++} || ' days')::interval)`;
        params.push(filters.noActivitySinceDays);
      }
    }
    
    // Cursor Pagination (Assuming sorting by id ascending if no sort specified for simplicity, but let's handle dynamic sort)
    let sortField = 'created_at';
    let sortDir = 'desc';
    if (sort && sort.field) {
      // Basic sanitization
      const allowedSortFields = ['created_at', 'updated_at', 'score', 'budget_max', 'name'];
      if (allowedSortFields.includes(sort.field)) {
        sortField = sort.field;
      }
    }
    if (sort && sort.direction && sort.direction.toLowerCase() === 'asc') {
      sortDir = 'asc';
    }
    
    // Applying Cursor
    // If we have a cursor, it's typically the ID of the last seen item.
    // To properly support cursor pagination with dynamic sort, we'd need to know the value of the sort field for that cursor.
    // For simplicity, we assume cursor is the last item's ID and we filter based on ID.
    // In a production app with dynamic sorting, we use a tuple comparison: (sortField, id) > (cursor.sortValue, cursor.id).
    // Let's implement a simple ID-based cursor for 'created_at' desc.
    if (cursor) {
      if (sortDir === 'desc') {
        query += ` AND l.id < $${paramIndex++}`;
      } else {
        query += ` AND l.id > $${paramIndex++}`;
      }
      params.push(cursor);
    }
    
    // Order and Limit
    // Always use id as a tie-breaker
    query += ` ORDER BY l.${sortField} ${sortDir.toUpperCase()}, l.id ${sortDir.toUpperCase()}`;
    query += ` LIMIT $${paramIndex++}`;
    params.push(limit + 1); // Fetch one extra to determine if there's a next page
    
    const { rows } = await pool.query(query, params);
    
    const hasNextPage = rows.length > limit;
    const results = hasNextPage ? rows.slice(0, limit) : rows;
    
    const nextCursor = hasNextPage ? results[results.length - 1].id : null;
    
    // We rely on responseFormatter to wrap this!
    return res.status(200).json({
      success: true,
      data: results,
      meta: {
        pagination: {
          nextCursor,
          hasNextPage,
          limit
        }
      }
    });
    
  } catch (error) {
    next(error);
  }
};
