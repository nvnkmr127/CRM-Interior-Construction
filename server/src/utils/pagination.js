/**
 * Safely parses pagination parameters and provides fallbacks.
 *
 * @param {string|number} pageParam - The page parameter from request
 * @param {string|number} limitParam - The limit parameter from request
 * @param {number} defaultLimit - Default limit if invalid or missing
 * @returns {{ page: number, limit: number, offset: number }}
 */
function getPagination(pageParam, limitParam, defaultLimit = 20) {
  let page = parseInt(pageParam, 10);
  if (isNaN(page) || page < 1) {
    page = 1;
  }

  let limit = parseInt(limitParam, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }

  // Cap limit to a reasonable maximum to prevent DB strain
  if (limit > 100) {
    limit = 100;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function getCursorPagination(cursorParam, limitParam, defaultLimit = 20) {
  let limit = parseInt(limitParam, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > 100) limit = 100;

  let cursor = null;
  if (cursorParam && typeof cursorParam === 'string') {
    // Basic base64 decoding for cursors
    try {
      const decoded = Buffer.from(cursorParam, 'base64').toString('ascii');
      cursor = parseInt(decoded, 10);
      if (isNaN(cursor)) cursor = null;
    } catch (e) {
      cursor = null;
    }
  }

  return { cursor, limit };
}

function encodeCursor(id) {
  if (!id) return null;
  return Buffer.from(id.toString()).toString('base64');
}

module.exports = { getPagination, getCursorPagination, encodeCursor };
