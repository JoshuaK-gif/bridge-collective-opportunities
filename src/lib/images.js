const CLOUD_NAME = 'et33rup2';

const SIZE_MAP = { small: 300, medium: 440, large: 800 };
const DISPLAY_SCALE = { card: 1, sidebar: 0.36, thumbnail: 0.34, detail: 2 };

export const CATEGORY_STYLES = {
  Scholarship: { bg: 'from-purple-600 to-purple-800', icon: '🎓' },
  Grant: { bg: 'from-amber-600 to-amber-800', icon: '💰' },
  Job: { bg: 'from-blue-600 to-blue-800', icon: '💼' },
  Internship: { bg: 'from-green-600 to-green-800', icon: '📚' },
  Fellowship: { bg: 'from-teal-600 to-teal-800', icon: '🏆' },
  Training: { bg: 'from-orange-600 to-orange-800', icon: '👥' },
  Volunteer: { bg: 'from-pink-600 to-pink-800', icon: '🤝' },
};

export function cloudinaryUrl(publicId, options = {}) {
  const { crop, width, height, quality = 'auto', format = 'auto' } = options;
  const parts = [];
  if (crop && crop.width && crop.height && crop.imageWidth) {
    parts.push(`c_crop,g_north_west,x_${Math.round(crop.x)},y_${Math.round(crop.y)},w_${Math.round(crop.width)},h_${Math.round(crop.height)}`);
  }
  if (width || height) {
    const dims = [];
    if (width) dims.push(`w_${width}`);
    if (height) dims.push(`h_${height}`);
    dims.push('c_fill');
    parts.push(dims.join(','));
  }
  parts.push(`q_${quality}`, `f_${format}`);
  const transformation = parts.join('/');
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformation}/${publicId}`;
}

export function oppImageSrc(opportunity, display = 'card') {
  if (!opportunity.image_url) return '';
  const crop = opportunity.image_crop;
  const baseSize = SIZE_MAP[opportunity.image_size] || SIZE_MAP.medium;
  const w = Math.round(baseSize * DISPLAY_SCALE[display]);
  if (opportunity.image_public_id && crop) {
    return cloudinaryUrl(opportunity.image_public_id, { crop, width: w });
  }
  if (opportunity.image_public_id) {
    return cloudinaryUrl(opportunity.image_public_id, { width: w });
  }
  return opportunity.image_url;
}
