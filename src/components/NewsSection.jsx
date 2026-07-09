import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Newspaper, ExternalLink, Calendar } from 'lucide-react';

export default function NewsSection({ limit = 4 }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.news.list({ limit }).then(setNews).catch(() => {}).finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-100 h-48 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (news.length === 0) return null;

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Newspaper className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800">Latest News</h2>
          <div className="flex-1 h-0.5 bg-primary/20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {news.map(item => (
            <a
              key={item.id}
              href={item.link || '#'}
              target={item.link ? '_blank' : undefined}
              rel={item.link ? 'noopener noreferrer' : undefined}
              className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {item.image_url ? (
                <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              ) : (
                <div className="aspect-[16/9] bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                  <Newspaper className="w-10 h-10 text-blue-400/60" />
                </div>
              )}
              <div className="p-3">
                <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                {item.content && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.content}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.published_date || item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  {item.link && <ExternalLink className="w-3 h-3 ml-auto" />}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
