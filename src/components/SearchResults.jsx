import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import ResultCard from './ResultCard';
import Pagination from './Pagination';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, X } from 'lucide-react';

const PAGE_SIZE = 5;

function CardSkeleton() {
  return (
    <div className="mb-10">
      <Skeleton className="w-full aspect-[16/9.6] rounded-md" />
      <Skeleton className="h-7 w-3/4 mt-3 mb-1" />
      <Skeleton className="h-4 w-2/3 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-5/6 mb-1" />
      <Skeleton className="h-4 w-24 mt-2" />
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded" />
      <Skeleton className="h-5 w-24 mb-3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

function formatSidebarDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix =
    ['th', 'st', 'nd', 'rd'][
      (day > 3 && day < 21) || day > 20
        ? day % 10 > 3
          ? 0
          : day % 10
        : 0
    ];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function Sidebar({ query, recentPosts, showRecentVideos }) {
  const [searchInput, setSearchInput] = useState(query || '');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <aside className="space-y-8">
      {/* Search box */}
      <form onSubmit={handleSubmit}>
        <label
          htmlFor="sidebar-search"
          className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1 block"
        >
          Search for:
        </label>
        <div className="flex border border-gray-300 rounded overflow-hidden">
          <input
            id="sidebar-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search..."
            className="flex-1 px-3 py-2 text-sm outline-none bg-white"
          />
          <button
            type="submit"
            className="px-3 bg-gray-100 hover:bg-gray-200 transition-colors border-l border-gray-300"
            aria-label="Search"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>
      </form>

      {/* Recent Posts */}
      {recentPosts && recentPosts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Recent Posts
          </h3>
          <ul className="space-y-4">
            {recentPosts.slice(0, 5).map((post) => (
              <li key={post.id}>
                <a
                  href={`/opportunities/${post.id}`}
                  className="text-sm font-medium text-gray-800 hover:text-blue-700 hover:underline leading-snug block"
                >
                  {post.title}
                </a>
                <span className="text-xs text-gray-400 mt-0.5 block">
                  {formatSidebarDate(post.created_date || post.published_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Videos (optional) */}
      {showRecentVideos && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Recent Videos
          </h3>
          <div className="aspect-video rounded-md overflow-hidden bg-gray-100">
            <iframe
              width="100%"
              height="100%"
              src={showRecentVideos}
              title="Recent video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </aside>
  );
}

const FILTER_CATEGORIES = ['', 'Scholarship', 'Grant', 'Job', 'Internship', 'Fellowship', 'Training', 'Volunteer', 'Award', 'Competition'];

export default function SearchResults({
  listings = [],
  query,
  category,
  loading = false,
  recentVideosUrl,
  basePaginationUrl,
}) {
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCat, setFilterCat] = useState(category || '');
  const [filterDeadline, setFilterDeadline] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const filtered = useMemo(() => {
    let items = [...listings];
    if (filterCat) {
      items = items.filter(
        (item) =>
          item.category?.toLowerCase() === filterCat.toLowerCase()
      );
    }
    if (filterDeadline) {
      const cutoff = new Date(filterDeadline);
      items = items.filter((item) => item.deadline && new Date(item.deadline) <= cutoff);
    }
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          (item.description &&
            new DOMParser()
              .parseFromString(item.description, 'text/html')
              .body.textContent?.toLowerCase()
              .includes(q)) ||
          item.category?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'deadline') {
      items.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    }
    return items;
  }, [listings, query, filterCat, filterDeadline, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const heading = query
    ? `Search Results for: ${query}`
    : category
      ? category
      : 'Listings';

  // Build pagination URL base if query is available
  const paginationUrl =
    basePaginationUrl ||
    (query ? `/search/${encodeURIComponent(query)}/page` : '');

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto lg:flex lg:gap-10">
        {/* Main results column (~70%) */}
        <div className="flex-1 min-w-0 lg:max-w-[calc(70%-1.25rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{heading}</h1>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filters
              {(filterCat || filterDeadline) && <span className="w-2 h-2 rounded-full bg-primary" />}
            </Button>
          </div>

          {showFilters && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Filters</span>
                <button
                  onClick={() => { setFilterCat(''); setFilterDeadline(''); setSortBy('newest'); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear all
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                  className="h-9 text-sm rounded-lg border border-gray-200 px-3 bg-white text-gray-900"
                >
                  <option value="">All Categories</option>
                  {FILTER_CATEGORIES.filter(Boolean).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="date"
                    value={filterDeadline}
                    onChange={(e) => setFilterDeadline(e.target.value)}
                    className="h-9 text-sm rounded-lg border border-gray-200 pl-9 pr-3 w-full bg-white text-gray-900"
                    placeholder="Deadline before..."
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-9 text-sm rounded-lg border border-gray-200 px-3 bg-white text-gray-900"
                >
                  <option value="newest">Newest First</option>
                  <option value="deadline">Deadline (Soonest)</option>
                </select>
              </div>
            </div>
          )}

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))
          ) : paged.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium text-gray-700 mb-1">
                No results found
              </p>
              <p className="text-sm">
                {query
                  ? `Your search for "${query}" returned no results. Try adjusting your keywords.`
                  : category
                    ? `No ${category.toLowerCase()} listings available yet.`
                    : 'No listings available at this time.'}
              </p>
            </div>
          ) : (
            <>
              {/* Vertical stack of result cards — full width, separated by generous spacing */}
              <div className="space-y-10">
                {paged.map((item) => (
                  <ResultCard key={item.id} item={item} />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                baseUrl={paginationUrl}
              />
            </>
          )}
        </div>

        {/* Sidebar (~30%) — moves below on mobile */}
        <aside className="w-full lg:w-[calc(30%-1.25rem)] shrink-0 mt-10 lg:mt-0">
          {loading ? (
            <SidebarSkeleton />
          ) : (
            <Sidebar
              query={query}
              recentPosts={listings}
              showRecentVideos={recentVideosUrl}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
