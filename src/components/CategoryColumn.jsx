import { Link } from 'react-router-dom';

export default function CategoryColumn({ title, borderColor, bgColor, items = [], viewAllHref }) {
  if (!items || items.length === 0) return null;

  const featured = items[0];
  const remaining = items.slice(1, 4);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className={`h-1.5 ${borderColor}`} />
      <div className={`px-4 py-3 ${bgColor}`}>
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </div>

      {/* Featured item */}
      {featured && (
        <div className="p-4 border-b border-gray-100">
          <Link to={`/opportunities/${featured.id}`} className="group block">
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-3 bg-gray-100">
              <img
                src={featured.image_url}
                alt={featured.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/90 text-white">
                Featured
              </div>
            </div>
            <h4 className="text-sm font-bold leading-snug line-clamp-3 group-hover:text-primary transition-colors">
              {featured.title}
            </h4>
            {featured.deadline && (
              <p className="text-xs text-gray-400 mt-1">
                {featured.deadline} | {featured.category}
              </p>
            )}
            {featured.description && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                {featured.description.replace(/<[^>]+>/g, '')}
              </p>
            )}
          </Link>
        </div>
      )}

      {/* List items */}
      <div className="divide-y divide-gray-100">
        {remaining.map((item) => (
          <Link
            key={item.id}
            to={`/opportunities/${item.id}`}
            className="flex gap-3 p-3 hover:bg-gray-50 transition-colors group"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
              <img
                src={item.image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h4>
              <p className="text-[10px] text-gray-400 mt-1">
                {item.deadline || ''} | {item.category || ''}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {viewAllHref && (
        <div className="border-t border-gray-100">
          <Link
            to={viewAllHref}
            className="block text-center text-xs font-bold text-primary py-3 hover:bg-gray-50 transition-colors uppercase tracking-wider"
          >
            View All {title}
          </Link>
        </div>
      )}
    </div>
  );
}
