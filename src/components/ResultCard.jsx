import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { oppImageSrc } from '@/lib/images';
import { categoryHref } from '@/lib/categories';
import BookmarkButton from './BookmarkButton';
import DeadlineBadge from './DeadlineBadge';
import { useBookmarks } from '@/hooks/useBookmarks';

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function truncateExcerpt(text, wordCount = 30) {
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= wordCount) return text;
  return words.slice(0, wordCount).join(' ') + '...';
}

export default function ResultCard({ item }) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const imgSrc = oppImageSrc(item, 'detail') || item.image_url;
  const excerpt = item.excerpt || truncateExcerpt(stripHtml(item.description), 30);
  const dateStr = formatDate(item.created_date || item.published_date);
  const tags = item.tags || (item.category ? [item.category] : []);

  const detailLink = `/opportunities/${item.id}`;

  return (
    <article>
      {/* 1. Featured image */}
      {imgSrc ? (
        <Link to={detailLink} className="block relative">
          <img
            src={imgSrc}
            alt={item.title}
            className="w-full aspect-[16/9.6] object-cover rounded-md bg-gray-100"
            loading="lazy"
          />
          {item.deadline && (
            <div className="absolute top-2 left-2">
              <DeadlineBadge deadline={item.deadline} />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <BookmarkButton isBookmarked={isBookmarked(item.id)} onToggle={() => toggleBookmark(item.id)} />
          </div>
        </Link>
      ) : (
        <div className="w-full aspect-[16/9.6] rounded-md bg-gray-100 relative">
          <div className="absolute top-2 right-2">
            <BookmarkButton isBookmarked={isBookmarked(item.id)} onToggle={() => toggleBookmark(item.id)} />
          </div>
        </div>
      )}

      {/* 2. Title */}
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-3 mb-1 line-clamp-2">
        <Link to={detailLink} className="hover:text-blue-700 transition-colors">
          {item.title}
        </Link>
      </h2>

      {/* 3. Meta line: Author | Date | Tags */}
      <div className="text-sm text-gray-500 mb-2 flex flex-wrap items-center gap-x-1">
        <span>Posted by </span>
        <span className="text-gray-600">
          {item.author_name || 'Admin'}
        </span>
        <span className="text-gray-300">|</span>
        <span>{dateStr}</span>
        {tags.length > 0 && (
          <>
            <span className="text-gray-300">|</span>
            {tags.map((tag, i) => (
              <span key={tag}>
                {i > 0 && <span className="text-gray-400">, </span>}
                <Link
                  to={categoryHref(tag)}
                  className="text-gray-600 hover:text-blue-600 hover:underline"
                >
                  {tag}
                </Link>
              </span>
            ))}
          </>
        )}
      </div>

      {/* 4. Excerpt */}
      {excerpt && (
        <p className="text-gray-700 leading-relaxed mb-2">{excerpt}</p>
      )}

      <Button variant="default" size="sm" asChild>
        <Link to={detailLink}>Read More</Link>
      </Button>
    </article>
  );
}
