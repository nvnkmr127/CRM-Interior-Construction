const { v4: uuidv4 } = require('uuid');

/**
 * Global response formatter middleware.
 * Ensures every endpoint returns a consistent JSON structure.
 */
function responseFormatter(req, res, next) {
  // Store the original res.json function
  const originalJson = res.json;

  // Add request ID to the request object if not already present
  req.id = req.id || req.headers['x-request-id'] || uuidv4();

  // Override res.json
  res.json = function (body) {
    // If the response is already in the standard format (e.g. from errorHandler or already wrapped), skip wrapping
    if (body && (body.hasOwnProperty('success') && body.hasOwnProperty('meta'))) {
      return originalJson.call(this, body);
    }
    
    // If it's an error response that hasn't been formatted (rare if we use errorHandler), format it
    if (res.statusCode >= 400) {
      if (body && body.hasOwnProperty('success') && body.hasOwnProperty('error')) {
         if (!body.meta) {
           body.meta = {
             requestId: req.id,
             timestamp: new Date().toISOString(),
             version: 'v1'
           };
         }
         return originalJson.call(this, body);
      }
      return originalJson.call(this, {
        success: false,
        error: {
          code: 'API_ERROR',
          message: body?.message || 'An error occurred',
          details: body?.details || body
        },
        meta: {
          requestId: req.id,
          timestamp: new Date().toISOString(),
          version: 'v1'
        }
      });
    }

    // Wrap successful responses
    const formattedResponse = {
      success: true,
      message: body?.message || 'Request successful',
      data: body?.data !== undefined ? body.data : (body?.message ? undefined : body),
      meta: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
        version: 'v1'
      }
    };

    // If body has its own meta (like pagination), merge it
    if (body?.meta) {
      formattedResponse.meta = { ...formattedResponse.meta, ...body.meta };
      // Remove meta from data if it was at the root
      if (formattedResponse.data && formattedResponse.data.meta) {
        delete formattedResponse.data.meta;
      }
    }

    return originalJson.call(this, formattedResponse);
  };

  next();
}

module.exports = responseFormatter;
