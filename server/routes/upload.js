import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// Rate limiter for public CV photo uploads (20 per hour per IP)
const cvPhotoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  message: { error: 'Upload limit reached. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

// Rate limiter for public opportunity image uploads (10 per hour per IP)
const opportunityImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  message: { error: 'Upload limit reached. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Public opportunity image upload — no auth required, rate limited
router.post('/opportunity-image', opportunityImageLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max 5MB.' });
    }
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bridge-submissions', resource_type: 'image' },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    logger.info({ publicId: result.public_id }, 'Opportunity image uploaded');
    res.json({ url: result.secure_url, public_id: result.public_id, width: result.width, height: result.height });
  } catch (err) {
    logger.error({ err, message: err.message }, 'Opportunity image upload failed');
    res.status(500).json({ error: 'Upload failed. Try again.' });
  }
});

// Public CV photo upload — no auth required, rate limited
router.post('/cv-photo', cvPhotoLimiter, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max 2MB.' });
    }
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bridge-cv-photos', resource_type: 'image', transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto', fetch_format: 'auto' }] },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    logger.info({ publicId: result.public_id }, 'CV photo uploaded');
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    logger.error({ err, message: err.message }, 'CV photo upload failed');
    res.status(500).json({ error: 'Upload failed. Try again.' });
  }
});

router.post('/image', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' });
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bridge-jobs', resource_type: 'image' },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });
    logger.info({ publicId: result.public_id }, 'Image uploaded');
    res.json({ url: result.secure_url, public_id: result.public_id, width: result.width, height: result.height });
  } catch (err) {
    logger.error({ err, message: err.message, http_code: err.http_code }, 'Cloudinary upload failed');
    next(err);
  }
});

export default router;
