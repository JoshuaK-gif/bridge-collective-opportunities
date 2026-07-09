import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import SEO from '@/components/SEO';
import SearchResultsView from '@/components/SearchResults';

const CATEGORY_MAP = {
  scholarships: 'Scholarship',
  grants: 'Grant',
  jobs: 'Job',
  internships: 'Internship',
  fellowships: 'Fellowship',
  training: 'Training',
  volunteer: 'Volunteer',
};

const CATEGORY_DESCRIPTIONS = {
  Scholarship: 'Browse scholarships for youth in Uganda and East Africa. Find fully funded opportunities to study abroad and locally.',
  Grant: 'Discover grants for youth, entrepreneurs, and organizations in Uganda and Africa. Funding for projects, research, and business.',
  Job: 'Find job opportunities for youth in Uganda and East Africa. Browse the latest employment openings across various sectors.',
  Internship: 'Explore internship opportunities for students and graduates in Uganda and Africa. Gain valuable work experience.',
  Fellowship: 'Discover fellowship programs for young professionals and leaders in Uganda and East Africa.',
  Training: 'Find training programs, workshops, and skill development opportunities for youth in Uganda and Africa.',
  Volunteer: 'Explore volunteer opportunities in Uganda and East Africa. Give back to your community and gain experience.',
};

export default function CategoryListingsPage() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiCategory = CATEGORY_MAP[category?.toLowerCase()] || category;
  const displayName = apiCategory || category || 'Opportunities';

  useEffect(() => {
    setLoading(true);
    api.opportunities.list({ category: apiCategory, all: true })
      .then(setListings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiCategory]);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://bridgejobs.ug/' },
      { '@type': 'ListItem', 'position': 2, 'name': `${displayName} Opportunities`, 'item': `https://bridgejobs.ug/category/${category}` }
    ]
  };

  const itemListSchema = listings.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': `${displayName} Opportunities`,
    'description': CATEGORY_DESCRIPTIONS[apiCategory] || `Browse ${displayName} opportunities for youth in Uganda and East Africa.`,
    'numberOfItems': listings.length,
    'itemListElement': listings.slice(0, 10).map((item, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'url': `https://bridgejobs.ug/opportunities/${item.id}`
    }))
  } : null;

  return (
    <>
      <SEO
        title={`${displayName} Opportunities`}
        description={CATEGORY_DESCRIPTIONS[apiCategory] || `Browse ${displayName} opportunities for youth in Uganda and East Africa.`}
        keywords={`${apiCategory?.toLowerCase() || 'opportunities'}, scholarships Uganda, youth opportunities, East Africa careers`}
        schema={[breadcrumbSchema, itemListSchema].filter(Boolean)}
      />
      <SearchResultsView
        listings={listings}
        query={searchQuery || undefined}
        category={apiCategory}
        loading={loading}
      />
    </>
  );
}
