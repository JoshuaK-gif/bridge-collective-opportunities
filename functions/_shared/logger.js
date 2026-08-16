import pino from 'pino';

// stdout only — serverless platforms collect stdout as logs. No file transport.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.body.password'],
});

export default logger;
