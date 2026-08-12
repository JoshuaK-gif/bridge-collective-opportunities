import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Newspaper, ExternalLink } from 'lucide-react';

export default function NewsSection({ limit = 10 }) {
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
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
        </div>
      </section>
    );
  }

  if (news.length === 0) return null;

  return (
    <section className="bg-white border-b border-gray-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Newspaper className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800 whitespace-nowrap">Latest News</h2>
          <div className="flex-1 h-0.5 bg-primary/20" />
        </div>
        <div className="relative overflow-hidden">
          <div className="flex whitespace-nowrap animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused] gap-8"
            style={{ minWidth: '200%' }}>
            {[...news, ...news].map((item, i) => (
              <a
                key={`${item.id}-${i}`}
                href={item.link || '#'}
                target={item.link ? '_blank' : undefined}
                rel={item.link ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center gap-3 px-5 py-2.5 rounded-lg bg-gray-50 hover:bg-primary/10 hover:text-primary transition-colors shrink-0 group"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-primary truncate max-w-[300px]">
                  {item.title}
                </span>
                {item.link && <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
              </a>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
