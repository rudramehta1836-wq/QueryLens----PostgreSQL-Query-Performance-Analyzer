/**
 * Centralized error handler.
 * Produces consistent { success, data, error } responses.
 * Never exposes stack traces or internal details in production.
 */
function errorHandler(err, _req, res, _next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Determine status code
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';

  const response = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: statusCode === 500 && !isDev
        ? 'An internal server error occurred.'
        : err.message || 'Unknown error'
    }
  };

  if (isDev && statusCode === 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json(response);
}

/**
 * Helper to create throwable errors with status codes.
 */
function createError(message, statusCode = 400, errorCode = 'BAD_REQUEST') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
}

module.exports = { errorHandler, createError };
