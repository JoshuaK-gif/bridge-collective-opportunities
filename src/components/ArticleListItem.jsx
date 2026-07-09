import { Link } from 'react-router-dom';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function ArticleListItem({ item, href, showThumbnail }) {
  const excerpt = item.excerpt || item.description?.replace(/<[^>]+>/g, '') || '';
  const tags = item.tags || [];
  const date = formatDate(item.date || item.deadline || item.created_at);

  return (
    <div className="border-b border-gray-200 pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
      <Link to={href || `/opportunities/${item.id}`} className="group block">
        <div className="flex gap-3">
          {showThumbnail && item.image_url && (
            <div className="shrink-0">
              <img
                src={item.image_url}
                alt=""
                className="w-16 h-16 object-cover rounded"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-blue-700 line-clamp-2 group-hover:underline leading-snug">
              {item.title}
            </h3>
            <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500 mt-1">
              {date && <span>{date}</span>}
              {date && tags.length > 0 && <span>|</span>}
              {tags.length > 0 && (
                <span className="truncate">
                  {tags.slice(0, 5).join(', ')}
                  {tags.length > 5 && '...'}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-snug">
              {excerpt}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
