import { Link } from 'react-router-dom';
import BookmarkButton from './BookmarkButton';
import DeadlineBadge from './DeadlineBadge';
import { useBookmarks } from '@/hooks/useBookmarks';

export default function ListingCard({ item, href, categoryLabel, lineClamp = 3 }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const excerpt = item.excerpt || item.description?.replace(/<[^>]+>/g, '') || '';

  return (
    <Link
      to={href || `/opportunities/${item.id}`}
      className="block bg-card rounded-lg shadow-sm p-4 hover:shadow-md hover:scale-[1.01] transition-all duration-200 relative"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
          {categoryLabel || item.category}
        </span>
        <BookmarkButton isBookmarked={isBookmarked(item.id)} onToggle={() => toggleBookmark(item.id)} />
      </div>
      <p className="text-sm text-muted-foreground mt-1 leading-snug line-clamp-3">
        {excerpt}
      </p>
      <h3 className="font-bold text-card-foreground mt-1 leading-snug line-clamp-2">
        {item.title}
      </h3>
      {item.deadline && (
        <div className="mt-2">
          <DeadlineBadge deadline={item.deadline} />
        </div>
      )}
    </Link>
  );
}
