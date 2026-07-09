import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import SEO from '@/components/SEO';
import SearchResultsView from '@/components/SearchResults';

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setListings([]);
      return;
    }
    setLoading(true);
    api.opportunities.list({ search: query })
      .then(setListings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  const pageTitle = query ? `Search: ${query}` : 'Search Opportunities';
  const pageDesc = query
    ? `Search results for "${query}" — browse opportunities matching your search on Bridge Collective Opportunities.`
    : 'Search for scholarships, grants, jobs, internships and more for youth in Uganda and East Africa.';

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDesc}
        noindex={!!query}
      />
      <SearchResultsView
        listings={listings}
        query={query}
        loading={loading}
      />
    </>
  );
}
