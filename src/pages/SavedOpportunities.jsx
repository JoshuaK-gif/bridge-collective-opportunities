import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { Heart, Bookmark, ArrowLeft, Calendar } from 'lucide-react';
import SEO from '@/components/SEO';
import DeadlineBadge from '@/components/DeadlineBadge';
import BookmarkButton from '@/components/BookmarkButton';
import { useBookmarks } from '@/hooks/useBookmarks';

export default function SavedOpportunities() {
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookmarks.length === 0) {
      setLoading(false);
      setOpportunities([]);
      return;
    }
    Promise.all(
      bookmarks.map((id) =>
        api.opportunities.get(id).catch(() => null)
      )
    ).then((results) => {
      setOpportunities(results.filter(Boolean));
      setLoading(false);
    });
  }, [bookmarks]);

  return (
    <>
      <SEO title="Saved Opportunities" description="Your bookmarked opportunities on Bridge Collective." />
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to home
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-6 h-6 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">Saved Opportunities</h1>
              <span className="text-sm text-gray-400">({bookmarks.length} saved)</span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-gray-700 mb-2">No saved opportunities yet</h2>
                <p className="text-sm text-gray-500 mb-4">Tap the heart icon on any opportunity to save it here.</p>
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  Browse opportunities
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow"
                  >
                    <Link to={`/opportunities/${item.id}`} className="flex gap-4 p-4 group">
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">📋</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary mb-1">{item.category}</span>
                            <h3 className="text-sm font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                          </div>
                          <BookmarkButton isBookmarked={true} onToggle={() => toggleBookmark(item.id)} size="sm" />
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          {item.deadline && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Calendar className="w-3 h-3" /> {item.deadline}
                            </span>
                          )}
                          {item.deadline && <DeadlineBadge deadline={item.deadline} />}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}
