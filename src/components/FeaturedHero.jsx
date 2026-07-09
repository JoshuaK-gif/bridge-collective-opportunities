import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

function FeaturedCarousel({ items }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % items.length);
  }, [items.length]);

  const goTo = useCallback((index) => {
    setCurrent(index);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [items, next]);

  if (!items || items.length === 0) return null;

  const item = items[current];

  return (
    <div className="relative w-full">
      <Link
        to={'/opportunities/' + item.id}
        className="relative block w-full overflow-hidden group"
        style={{ aspectRatio: '21 / 9' }}
      >
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <span className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-primary text-white mb-3">
            {item.category}
          </span>
          <h3 className="text-white text-base md:text-3xl font-bold leading-tight max-w-3xl line-clamp-2">
            {item.title}
          </h3>
          {item.deadline && (
            <p className="text-white/60 text-sm mt-2">Deadline: {item.deadline}</p>
          )}
        </div>
      </Link>

      {items.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); goTo(i); }}
              className={
                'w-2.5 h-2.5 rounded-full transition-all ' +
                (i === current ? 'bg-white scale-110' : 'bg-white/40 hover:bg-white/60')
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeaturedHero({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <FeaturedCarousel items={items} />
      </div>
    </section>
  );
}
