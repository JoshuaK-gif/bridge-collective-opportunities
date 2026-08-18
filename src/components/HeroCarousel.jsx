import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function HeroCarousel({ items = [] }) {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState({});
  const sectionRef = useRef(null);
  const [slideKey, setSlideKey] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const changeSlide = useCallback((index) => {
    if (index === current) return;
    setPrev(current);
    setCurrent(index);
    setSlideKey(k => k + 1);
  }, [current]);

  const next = useCallback(() => {
    changeSlide((current + 1) % items.length);
  }, [changeSlide, current, items.length]);

  const goTo = useCallback((index) => {
    changeSlide(index);
  }, [changeSlide]);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [items, next]);

  if (!items || items.length === 0) return null;

  const main = items[current];
  const sideItems = items.filter((_, i) => i !== current).slice(0, 2);

  const getOptimizedSrc = (url, width = 800) => {
    if (!url) return '';
    if (url.includes('res.cloudinary.com')) {
      return url.replace('/image/upload/', `/image/upload/q_auto,f_auto,w_${width},c_fill/`);
    }
    return url;
  };

  const preloadImage = (src) => {
    if (!src) return;
    const img = new Image();
    img.src = src;
  };

  return (
    <section ref={sectionRef} className={`bg-[#eef0fa] transition-all duration-700 ease-in-out ${visible ? 'animate-fade-in-up' : 'opacity-0 translate-y-5'}`}>
      <div className="max-w-6xl mx-auto px-4 py-4 lg:py-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
          {/* Main carousel - cross-fade transition */}
          <div className="relative flex-1">
            <Link
              to={`/opportunities/${main.id}`}
              className="relative block w-full overflow-hidden rounded-xl group"
              style={{ aspectRatio: '16/9' }}
            >
              {/* Previous image fading out */}
              {prev !== null && (
                <img
                  key={'prev-' + slideKey}
                  src={getOptimizedSrc(items[prev].image_url, 800)}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover animate-fade-out"
                  style={{ willChange: 'opacity' }}
                />
              )}
              {/* Current image fading in */}
              <img
                key={'curr-' + slideKey}
                src={getOptimizedSrc(main.image_url, 800)}
                alt={main.title}
                fetchPriority={current === 0 ? 'high' : 'low'}
                loading={current === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() => {
                  setLoaded(prev => ({ ...prev, [main.id]: true }));
                  preloadImage(getOptimizedSrc(items[(current + 1) % items.length]?.image_url, 800));
                }}
                className="absolute inset-0 w-full h-full object-cover animate-fade-in group-hover:scale-105 transition-transform duration-700 ease-in-out"
                style={{ willChange: 'transform, opacity' }}
              />
              {!loaded[main.id] && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-xl" />
              )}
              {/* Dot indicators on top-left */}
              <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.preventDefault(); goTo(i); }}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ease-in-out ${
                      i === current ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80 hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </Link>
          </div>

          {/* Side cards */}
          <div className="hidden lg:flex flex-row lg:flex-col gap-3 w-full lg:w-64">
            {sideItems.map((item, i) => (
              <Link
                key={item.id}
                to={`/opportunities/${item.id}`}
                className="group flex-1 lg:flex-none relative overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100 transition-all duration-500 ease-in-out animate-fade-in"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="relative h-24 overflow-hidden">
                  <img
                    src={getOptimizedSrc(item.image_url, 400)}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-all duration-500 ease-in-out group-hover:scale-105"
                    style={{ willChange: 'transform' }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-[11px] font-semibold truncate">{item.title}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
