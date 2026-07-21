/**
 * Standardize successful API responses for v1 routes.
 */
function success(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data
  });
}

/**
 * Standardize failed API responses for v1 routes.
 */
function fail(res, message, errors = [], status = 400) {
  return res.status(status).json({
    success: false,
    message,
    errors
  });
}

/**
 * Helper to extract common pagination, sorting, and filtering from req.query
 */
function getQueryParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  // sort format: sort=created_at:desc or sort=name:asc
  let sortColumn = 'created_at';
  let sortDirection = 'DESC';
  if (req.query.sort) {
    const [col, dir] = req.query.sort.split(':');
    if (col) sortColumn = col.replace(/[^a-zA-Z0-9_]/g, ''); // prevent sql injection
    if (dir && dir.toLowerCase() === 'asc') sortDirection = 'ASC';
  }

  const search = req.query.search || null;
  const startDate = req.query.startDate || null;
  const endDate = req.query.endDate || null;

  return { page, limit, offset, sortColumn, sortDirection, search, startDate, endDate };
}

module.exports = {
  success,
  fail,
  getQueryParams
};
