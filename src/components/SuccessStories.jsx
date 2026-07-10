import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

export default function SuccessStories() {
  const [stories, setStories] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.news.list({ limit: 10 })
      .then((items) => {
        const withContent = items.filter((n) => n.content && n.content.length > 60);
        setStories(withContent.length > 0 ? withContent : items.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || stories.length === 0) return null;

  const story = stories[current];

  const next = () => setCurrent((c) => (c + 1) % stories.length);
  const prev = () => setCurrent((c) => (c - 1 + stories.length) % stories.length);

  return (
    <section className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Star className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800">Success Stories</h2>
          <div className="flex-1 h-0.5 bg-primary/20" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8"
          >
            <Quote className="w-8 h-8 text-primary/20 mb-3" />
            <p className="text-gray-700 leading-relaxed line-clamp-4 md:line-clamp-6">
              {story.content}
            </p>
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              {story.image_url && (
                <img src={story.image_url} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800">{story.title}</p>
                {story.link && (
                  <a href={story.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Read full story
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {stories.length > 1 && (
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={prev} className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <div className="flex items-center gap-1.5">
                {stories.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-primary w-4' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
              <button onClick={next} className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
