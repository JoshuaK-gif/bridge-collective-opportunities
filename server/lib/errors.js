import logger from './logger.js';

export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  // Report to Sentry if configured
  try {
    const Sentry = globalThis.__SENTRY__;
    if (Sentry?.captureException) {
      Sentry.captureException(err, {
        extra: { path: req.path, method: req.method, correlationId: req.correlationId },
      });
    }
  } catch {}

  res.status(500).json({ error: 'Internal server error' });
}
