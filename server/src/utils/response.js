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
function paginate(res, data, total, page, limit) {
  return success(res, data, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

module.exports = {
  success,
  fail,
  paginate
};
