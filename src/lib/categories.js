export const CATEGORY_SLUGS = {
  Scholarship: 'scholarships',
  Grant: 'grants',
  Job: 'jobs',
  Internship: 'internships',
  Fellowship: 'fellowships',
  Training: 'training',
  Volunteer: 'volunteer',
};

export function categoryHref(category) {
  if (!category) return null;
  const slug = CATEGORY_SLUGS[category];
  return slug ? `/category/${slug}` : `/search?q=${encodeURIComponent(category)}`;
}