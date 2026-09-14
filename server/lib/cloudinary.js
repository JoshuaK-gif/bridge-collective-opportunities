import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Build a Cloudinary upload signature for a given folder.
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
export function createUploadSignature({ folder, timestamp = Math.floor(Date.now() / 1000), uploadPreset } = {}) {
  const config = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)');
  }

  const params = {
    timestamp,
    folder: folder || 'bridge-jobs',
  };
  if (uploadPreset) params.upload_preset = uploadPreset;

  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  // Cloudinary: SHA1 of the sorted params string WITH the api_secret appended
  const signature = createHash('sha1').update(toSign + config.api_secret).digest('hex');

  return {
    cloud_name: config.cloud_name,
    api_key: config.api_key,
    signature,
    timestamp,
    folder: params.folder,
    upload_preset: uploadPreset || undefined,
  };
}

export default cloudinary;
