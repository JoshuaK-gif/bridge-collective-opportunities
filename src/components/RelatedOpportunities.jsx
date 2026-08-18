import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Calendar } from 'lucide-react';

export default function RelatedOpportunities({ currentId, category }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.opportunities.related(currentId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentId]);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-12">
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Related {category} Opportunities</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/opportunities/${item.id}`}
              className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">?</div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                {item.deadline && (
                  <p className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" /> {item.deadline}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
