import { Link } from 'react-router-dom';

export default function ListingCard({ item, href, categoryLabel, lineClamp = 3 }) {
  const excerpt = item.excerpt || item.description?.replace(/<[^>]+>/g, '') || '';

  return (
    <Link
      to={href || `/opportunities/${item.id}`}
      className="block bg-card rounded-lg shadow-sm p-4 hover:shadow-md hover:scale-[1.01] transition-all duration-200"
    >
      <span className="text-xs font-bold text-red-600 uppercase tracking-wide">
        {categoryLabel || item.category}
      </span>
      <p className="text-sm text-muted-foreground mt-1 leading-snug line-clamp-3">
        {excerpt}
      </p>
      <h3 className="font-bold text-card-foreground mt-1 leading-snug line-clamp-2">
        {item.title}
      </h3>
    </Link>
  );
}
