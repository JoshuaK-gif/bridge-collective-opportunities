import { Link } from 'react-router-dom';

function getRange(currentPage, totalPages) {
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

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  baseUrl = '',
}) {
  if (totalPages <= 1) return null;

  const range = getRange(currentPage, totalPages);

  const handleClick = (e, page) => {
    if (onPageChange) {
      e.preventDefault();
      onPageChange(page);
    }
  };

  return (
    <nav
      className="flex items-center gap-2 pt-6 border-t border-gray-200 flex-wrap"
      aria-label="Pagination"
    >
      {range.map((item, i) =>
        item === '...' ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1 text-sm text-gray-400 select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : baseUrl && onPageChange ? null : (
          <Link
            key={item}
            to={baseUrl ? `${baseUrl}/${item}` : '#'}
            onClick={(e) => handleClick(e, item)}
            className={`px-2 py-1 text-sm leading-none transition-colors ${
              item === currentPage
                ? 'font-bold text-gray-900'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            {item}
          </Link>
        )
      )}

      {/* Button-based page links (when onPageChange is provided) */}
      {onPageChange &&
        range.map((item, i) =>
          item === '...' ? null : (
            <button
              key={`btn-${i}`}
              onClick={() => onPageChange(item)}
              className={`px-2 py-1 text-sm leading-none transition-colors ${
                item === currentPage
                  ? 'font-bold text-gray-900'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              {item}
            </button>
          )
        )}

      {/* Next page arrow */}
      {currentPage < totalPages && (
        baseUrl ? (
          <Link
            to={`${baseUrl}/${currentPage + 1}`}
            onClick={(e) => handleClick(e, currentPage + 1)}
            className="px-2 py-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            aria-label="Next page"
          >
            →
          </Link>
        ) : (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="px-2 py-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
            aria-label="Next page"
          >
            →
          </button>
        )
      )}
    </nav>
  );
}
