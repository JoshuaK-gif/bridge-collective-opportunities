import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function HeroCarousel({ items = [] }) {
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

  const main = items[current];
  const sideItems = items.filter((_, i) => i !== current).slice(0, 2);

  return (
    <section className="bg-[#eef0fa]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main carousel */}
          <div className="relative flex-1">
            <Link
              to={`/opportunities/${main.id}`}
              className="relative block w-full overflow-hidden rounded-xl group"
              style={{ aspectRatio: '16/10' }}
            >
              <img
                src={main.image_url}
                alt={main.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 z-10 flex gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.preventDefault(); goTo(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === current ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span className="inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-primary text-white mb-2">
                  {main.category}
                </span>
                <h3 className="text-white text-base md:text-2xl font-bold leading-tight max-w-2xl line-clamp-2">
                  {main.title}
                </h3>
                {main.deadline && (
                  <p className="text-white/60 text-xs md:text-sm mt-1">Deadline: {main.deadline}</p>
                )}
              </div>
            </Link>
          </div>

          {/* Side cards */}
          <div className="flex flex-row lg:flex-col gap-4 w-full lg:w-80">
            {sideItems.map((item) => (
              <Link
                key={item.id}
                to={`/opportunities/${item.id}`}
                className="group flex-1 lg:flex-none relative overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100"
              >
                <div className="relative h-28 md:h-32 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/90 text-white">
                    {item.category}
                  </span>
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  {item.deadline && (
                    <p className="text-xs text-gray-500 mt-1">{item.deadline}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
