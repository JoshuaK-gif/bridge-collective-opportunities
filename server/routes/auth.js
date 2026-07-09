import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { generateToken, authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

const router = Router();

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError(400, 'Email and password required');

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Check lockout
    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AppError(429, `Account locked. Try again in ${remaining} minute(s).`);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Increment failed attempts
      if (user) {
        const attempts = (user.failed_attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await pool.query(
            'UPDATE users SET failed_attempts = $1, locked_until = now() + interval \'30 minutes\' WHERE id = $2',
            [attempts, user.id]
          );
        } else {
          await pool.query('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, user.id]);
        }
      }
      throw new AppError(401, 'Invalid email or password');
    }

    // Reset on success
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    logger.info({ userId: user.id }, 'User logged in');
    res.json({ access_token: generateToken(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, email, full_name, role, created_date FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) throw new AppError(404, 'Not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
