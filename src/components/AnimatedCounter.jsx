import { useState, useEffect, useRef } from 'react';

export default function AnimatedCounter({ value, className }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    const match = value.match(/^([\d.]+)(.*)$/);
    if (!match) { setDisplay(value); return; }

    const target = parseFloat(match[1]);
    const suffix = match[2];

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = target / steps;
          let current = 0;
          let step = 0;

          const timer = setInterval(() => {
            step++;
            current = Math.min(Math.round(increment * step), target);
            setDisplay(suffix ? current + suffix : String(current));
            if (step >= steps) {
              clearInterval(timer);
              setDisplay(value);
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref} className={className}>{display}</span>;
}
