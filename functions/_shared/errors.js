/**
 * AppError + handler wrapper for Nhost Functions.
 *
 * Nhost Functions have no global error middleware, so each handler is wrapped
 * with handle() which maps AppError → status code and everything else → 500.
 */
import logger from './logger.js';

export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function handle(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      logger.error({ err: err.message, path: req.path, method: req.method }, 'Unhandled error in function');
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export default { AppError, handle };
