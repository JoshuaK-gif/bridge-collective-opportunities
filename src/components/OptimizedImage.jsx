import { useState, useRef, useEffect } from 'react';
import { oppImageSrc } from '@/lib/images';

export default function OptimizedImage({ opportunity, display = 'card', className = '', alt = '', ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fullSrc = oppImageSrc(opportunity, display);
  const thumbSrc = opportunity.image_public_id
    ? oppImageSrc(opportunity, display).replace('/image/upload/', '/image/upload/q_10,w_20,e_blur:300/')
    : fullSrc;

  return (
    <div ref={imgRef} className={`relative overflow-hidden bg-gray-100 ${className}`} {...props}>
      {inView ? (
        <>
          {thumbSrc !== fullSrc && (
            <img
              src={thumbSrc}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
              aria-hidden="true"
            />
          )}
          <img
            src={fullSrc}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
    </div>
  );
}
