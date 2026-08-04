const { createError } = require('./errorHandler');

/**
 * Creates a middleware that validates req.body against a Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
function validateRequest(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      return next(createError(message, 400, 'VALIDATION_ERROR'));
    }
    req.validatedBody = result.data;
    next();
  };
}

module.exports = { validateRequest };
