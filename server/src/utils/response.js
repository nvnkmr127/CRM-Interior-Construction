/**
 * Standardize successful API responses.
 */
function success(res, data, meta = {}, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString()
  });
}

/**
 * Standardize failed API responses.
 */
function fail(res, code, message, status = 400, details = null) {
  const body = {
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString()
  };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

/**
 * Standardize paginated API responses.
 */
function paginate(res, data, total, page, limit, nextCursor = null) {
  const meta = {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
  if (nextCursor) meta.nextCursor = nextCursor;
  
  return success(res, data, meta);
}

module.exports = {
  success,
  fail,
  paginate
};
