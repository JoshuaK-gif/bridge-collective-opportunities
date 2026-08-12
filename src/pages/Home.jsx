import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Timer } from 'lucide-react';
import SEO from '@/components/SEO';
import HeroCarousel from '@/components/HeroCarousel';
import CategoryColumn from '@/components/CategoryColumn';
import { HeroSkeleton, FeaturedListsSkeleton } from '@/components/skeletons/HomePageSkeleton';
import { AnimatedPage } from '@/components/shared/AnimatedPage';
import NewsSection from '@/components/NewsSection';
import BookmarkButton from '@/components/BookmarkButton';
import DeadlineBadge from '@/components/DeadlineBadge';
import { useBookmarks } from '@/hooks/useBookmarks';
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'name': 'Bridge Collective Opportunities (BCO)',
  'url': 'https://bridgecollectiveopport.org',
  'description': 'Discover opportunities for youth in Uganda and East Africa.',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': 'https://bridgecollectiveopport.org/?search={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  }
};
export default function Home() {
  const [searchParams] = useSearchParams();
  const [allOpportunities, setAllOpportunities] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [curatedLists, setCuratedLists] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [showExpiring, setShowExpiring] = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const activeCategory = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.opportunities.list({ featured: true }),
      api.opportunities.list(),
      api.categories.list(),
      api.lists.list().then(async (lists) => {
        const fullLists = await Promise.all(lists.map(list => api.lists.get(list.id)));
        return fullLists.filter(l => l.items && l.items.length > 0);
      }),
      api.opportunities.list({ expiringSoon: true, expiringWithin: 7 })
    ]).then(([fr, ar, cr, lr, er]) => {
      if (fr.status === 'fulfilled') setFeatured(fr.value);
      if (ar.status === 'fulfilled') setAllOpportunities(ar.value);
      if (cr.status === 'fulfilled') setCategories(cr.value);
      if (lr.status === 'fulfilled') setCuratedLists(lr.value);
      if (er.status === 'fulfilled') setExpiringSoon(er.value);
      setLoading(false);
    });
  }, []);
  const getCatOpps = (name) => allOpportunities.filter(o => o.category === name).slice(0, 5);
  const CATEGORY_SLUG = { Scholarship: 'scholarships', Grant: 'grants', Job: 'jobs', Internship: 'internships', Fellowship: 'fellowships', Training: 'training', Volunteer: 'volunteer' };
  const getCategoryMeta = (catName) => {
    const found = categories.find(c => c.name === catName);
    return found ? { badge: found.color || 'bg-gray-100 text-gray-700', label: found.name } : { badge: 'bg-gray-100 text-gray-700', label: catName };
  };
  const isFiltered = !!(activeCategory || searchQuery);
  const homepageTitle = activeCategory ? `${getCategoryMeta(activeCategory).label} Opportunities` : searchQuery ? `Search: ${searchQuery}` : null;
  return (
    <>
      <SEO title={homepageTitle}
        description={activeCategory ? `Browse ${getCategoryMeta(activeCategory).label} opportunities.` : searchQuery ? `Search results for "${searchQuery}"` : undefined}
        keywords="scholarships Uganda, jobs for youth, grants Africa, internships, fellowships, youth opportunities, East Africa careers"
        schema={!isFiltered ? websiteSchema : undefined}
      />
      <AnimatedPage>
      <div className="bg-[#eef0fa] min-h-screen">
        {!isFiltered && (
          <>
            {loading ? <HeroSkeleton /> : featured.length > 0 && <HeroCarousel items={featured} />}
            {loading ? <FeaturedListsSkeleton /> : curatedLists.length > 0 && (
              <section className="bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 py-6">
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800">Featured Collections</h2>
                    <div className="flex-1 h-0.5 bg-primary/20" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {curatedLists.slice(0, 3).map(list => (
                      <div key={list.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-transparent">
                          <h3 className="font-bold text-base text-gray-900">{list.name}</h3>
                          {list.description && <p className="text-xs text-gray-500 mt-0.5">{list.description}</p>}
                        </div>
                        <div className="divide-y divide-gray-100">
                          {list.items.slice(0, 4).map((item) => (
                            <Link key={item.id} to={`/opportunities/${item.id}`} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors group">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : (
                                  <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">{item.category}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {/* Expiring Soon Section */}
            {expiringSoon.length > 0 && (
              <section className={`bg-white border-b border-gray-100 ${showExpiring ? '' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
                  <button
                    onClick={() => setShowExpiring(!showExpiring)}
                    className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5 w-full text-left"
                  >
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" />
                    <h2 className="text-sm sm:text-lg font-bold uppercase tracking-wider text-gray-800">
                      Expiring Soon
                      <span className="ml-1 sm:ml-2 text-[10px] sm:text-sm font-normal text-orange-500 lowercase">
                        ({expiringSoon.length} opps closing within 7 days)
                      </span>
                    </h2>
                    <div className="flex-1 h-0.5 bg-primary/20" />
                    <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform shrink-0 ${showExpiring ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showExpiring && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                      {expiringSoon.map((item) => (
                        <Link
                          key={item.id}
                          to={`/opportunities/${item.id}`}
                          className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all relative"
                        >
                          <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-gray-100 overflow-hidden">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute top-1 sm:top-2 left-1 sm:left-2">
                              <DeadlineBadge deadline={item.deadline} />
                            </div>
                            <div className="absolute top-1 sm:top-2 right-1 sm:right-2">
                              <BookmarkButton isBookmarked={isBookmarked(item.id)} onToggle={() => toggleBookmark(item.id)} />
                            </div>
                          </div>
                          <div className="p-2 sm:p-3">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary mb-0.5 sm:mb-1">{item.category}</span>
                            <h3 className="text-xs sm:text-sm font-semibold leading-snug text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{item.deadline}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <NewsSection />
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {loading && Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-3 border-b border-gray-100"><Skeleton className="h-5 w-24" /></div>
                    <div className="divide-y divide-gray-100">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <div key={j} className="p-3 space-y-1"><Skeleton className="h-3 w-full" /><Skeleton className="h-2 w-12" /></div>
                      ))}
                    </div>
                  </div>
                ))}
                {!loading && categories.map(cat => {
                  const opps = getCatOpps(cat.name);
                  return opps.length === 0 ? null : <CategoryColumn key={cat.id} title={cat.name} borderColor={cat.accent || 'bg-blue-500'} bgColor={cat.accent_bg || 'bg-blue-50'} items={opps} viewAllHref={`/category/${CATEGORY_SLUG[cat.name] || cat.name.toLowerCase()}`} />
                })}
              </div>
            </div>
          </>
        )}
      </div>
      </AnimatedPage>
    </>
  );
}
