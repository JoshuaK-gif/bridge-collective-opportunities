import logger from './logger.js';

const USE_PGLITE = process.env.USE_PGLITE === 'true';
const REQUIRED = USE_PGLITE ? ['JWT_SECRET'] : ['DATABASE_URL', 'JWT_SECRET'];
const DEFAULTS = {
  PORT: '3000',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  DB_SSL: 'false',
  REDIS_URL: '',
  FRONTEND_URL: 'http://localhost:5173',
};

export function validateEnv() {
  const missing = [];
  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const [key, val] of Object.entries(DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }

  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables');
    console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MISSING REQUIRED ENVIRONMENT VARIABLES:
  ${missing.join(', ')}

  Create a .env file in server/ with:
${REQUIRED.map(k => `  ${k}=your_value`).join('\n')}
  Or set them in your shell before starting.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'change-this-to-a-long-random-string') {
    logger.error('JWT_SECRET is still set to the default value — change it in production');
    process.exit(1);
  }

  logger.info({ env: process.env.NODE_ENV }, 'Environment validated');
}
