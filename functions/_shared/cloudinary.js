/**
 * Cloudinary helpers for the consolidated backend.
 *
 * Nhost Functions can't reliably receive multipart file uploads, so uploads
 * move to direct-to-Cloudinary browser uploads: the client asks this endpoint
 * for a signed upload (signature + timestamp), then POSTs the file straight to
 * Cloudinary. The signature restricts uploads to a single folder.
 */
import { createHmac } from 'crypto';

export function getCloudinaryConfig() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  };
}

/**
 * Build a Cloudinary upload signature for a given folder (and optional preset).
 * https://cloudinary.com/documentation/upload_images#generating_authentication_signatures
 */
export function createUploadSignature({ folder, timestamp = Math.floor(Date.now() / 1000), uploadPreset } = {}) {
  const config = getCloudinaryConfig();
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
  const signature = createHmac('sha1', config.api_secret).update(toSign).digest('hex');

  return {
    cloud_name: config.cloud_name,
    api_key: config.api_key,
    signature,
    timestamp,
    folder: params.folder,
    upload_preset: uploadPreset || undefined,
  };
}

export default { getCloudinaryConfig, createUploadSignature };
