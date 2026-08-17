import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { oppImageSrc, CATEGORY_STYLES } from '@/lib/images';
import { categoryHref } from '@/lib/categories';

const PAGE_SIZE = 15;

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function truncateText(text, maxLen = 140) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

function getPaginationRange(currentPage, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (currentPage > 3) pages.push('...');
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}

function ResultSkeleton() {
  return (
    <div className="mb-8 pb-8 border-b border-gray-200">
      <Skeleton className="w-full aspect-video rounded-md mb-3" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-3" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3 mb-3" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

function EmptyState({ query, category }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <p className="text-lg font-medium text-gray-700 mb-1">No results found</p>
      <p className="text-sm">
        {query
          ? `Your search for "${query}" returned no results. Try adjusting your keywords.`
          : category
            ? `No ${category.toLowerCase()} listings available yet.`
            : 'No listings available at this time.'}
      </p>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const range = getPaginationRange(currentPage, totalPages);

  return (
    <nav className="flex items-center justify-center gap-2 mt-8 mb-4" aria-label="Pagination">
      {range.map((item, i) =>
        item === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-gray-400 select-none">...</span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              item === currentPage
                ? 'bg-blue-600 text-white font-bold'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {item}
          </button>
        )
      )}
    </nav>
  );
}

export default function ListingResults({ listings = [], query, category, loading = false }) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let items = [...listings];
    if (category) {
      items = items.filter(item => item.category?.toLowerCase() === category.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        stripHtml(item.description).toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [listings, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const heading = query
    ? `Search Results for: "${query}"`
    : category
      ? category
      : 'Listings';

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{heading}</h1>

      {loading ? (
        <>
          {Array.from({ length: 5 }).map((_, i) => <ResultSkeleton key={i} />)}
        </>
      ) : paged.length === 0 ? (
        <EmptyState query={query} category={category} />
      ) : (
        <>
          {paged.map((item, idx) => {
            const imgSrc = oppImageSrc(item, 'detail') || item.image_url;
            const excerpt = item.excerpt || truncateText(stripHtml(item.description), 160);
            const style = CATEGORY_STYLES[item.category];

            return (
              <article key={item.id} className={idx < paged.length - 1 ? 'border-b border-gray-200 pb-6 mb-6' : ''}>
                {imgSrc ? (
                  <Link to={`/opportunities/${item.id}`} className="block mb-3">
                    <img
                      src={imgSrc}
                      alt={item.title}
                      className="w-full aspect-video object-cover rounded-md bg-gray-100"
                      loading="lazy"
                    />
                  </Link>
                ) : (
                  <Link
                    to={`/opportunities/${item.id}`}
                    className={`block w-full aspect-video rounded-md mb-3 bg-gradient-to-br ${style?.bg || 'from-gray-400 to-gray-600'} flex items-center justify-center text-5xl`}
                  >
                    {style?.icon || '📄'}
                  </Link>
                )}

                <h2 className="text-xl md:text-2xl font-bold text-gray-900 hover:text-blue-700 hover:underline cursor-pointer line-clamp-2 mb-1">
                  <Link to={`/opportunities/${item.id}`}>{item.title}</Link>
                </h2>

                <div className="text-sm text-gray-500 mb-2">
                  <span>Posted by Admin</span>
                  <span className="mx-1.5">|</span>
                  <span>{formatDate(item.created_date)}</span>
                  {item.category && (
                    <>
                      <span className="mx-1.5">|</span>
                      <Link
                        to={categoryHref(item.category)}
                        className="text-blue-600 hover:underline"
                      >
                        {item.category}
                      </Link>
                    </>
                  )}
                </div>

                {excerpt && (
                  <p className="text-gray-600 leading-relaxed line-clamp-2 mt-2 mb-3">
                    {excerpt}
                  </p>
                )}

                <Button variant="default" size="sm" asChild>
                  <Link to={`/opportunities/${item.id}`}>Read More</Link>
                </Button>
              </article>
            );
          })}

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
