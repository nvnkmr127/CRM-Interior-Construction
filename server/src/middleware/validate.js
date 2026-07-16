const { fail } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }
    // Replace req.body with the parsed data to strip unknown fields and apply defaults
    req.body = parsed.data;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = validate;
