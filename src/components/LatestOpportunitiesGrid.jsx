import { Link } from 'react-router-dom';

export default function LatestOpportunitiesGrid({ items = [] }) {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0));

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800">Our Latest Opportunities</h2>
        <div className="flex-1 h-0.5 bg-primary/30" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sorted.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            to={`/opportunities/${item.id}`}
            className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/90 text-white">
                {item.category}
              </div>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                {item.deadline || new Date(item.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
