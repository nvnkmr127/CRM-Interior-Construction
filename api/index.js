const app = require('../server/src/app');

module.exports = (req, res) => {
  return app(req, res);
};
