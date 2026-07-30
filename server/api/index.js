const app = require('../src/app');

module.exports = (req, res) => {
  console.log(`[VERCEL SERVERLESS] ${req.method} ${req.url} (originalUrl: ${req.originalUrl || 'N/A'})`);
  try {
    return app(req, res);
  } catch (err) {
    console.error('[VERCEL ENTRYPOINT CRASH]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'SERVERLESS_CRASH',
        message: err.message || String(err),
        stack: err.stack || String(err)
      }
    }));
  }
};
