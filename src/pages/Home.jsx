import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { oppImageSrc } from '@/lib/images';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Bell, Calendar } from 'lucide-react';
import SEO from '@/components/SEO';
import HeroCarousel from '@/components/HeroCarousel';
import CategoryColumn from '@/components/CategoryColumn';
import LatestOpportunitiesGrid from '@/components/LatestOpportunitiesGrid';
import WidgetRow from '@/components/WidgetRow';
import SubscribeButton from '@/components/SubscribeButton';
import { HeroSkeleton, FeaturedListsSkeleton } from '@/components/skeletons/HomePageSkeleton';
import { AnimatedPage } from '@/components/shared/AnimatedPage';
import NewsSection from '@/components/NewsSection';
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  'name': 'Bridge Collective Opportunities (BCO)',
  'url': 'https://bridgejobs.ug',
  'description': 'Discover opportunities for youth in Uganda and East Africa.',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': 'https://bridgejobs.ug/?search={search_term_string}'
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
  const activeCategory = searchParams.get('category') || '';
  const searchQuery = searchParams.get('search') || '';
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.opportunities.list({ featured: true }),
      api.opportunities.list({ all: true }),
      api.categories.list(),
      api.lists.list().then(async (lists) => {
        const fullLists = await Promise.all(lists.map(list => api.lists.get(list.id)));
        return fullLists.filter(l => l.items && l.items.length > 0);
      })
    ]).then(([fr, ar, cr, lr]) => {
      if (fr.status === 'fulfilled') setFeatured(fr.value);
      if (ar.status === 'fulfilled') setAllOpportunities(ar.value);
      if (cr.status === 'fulfilled') setCategories(cr.value);
      if (lr.status === 'fulfilled') setCuratedLists(lr.value);
      setLoading(false);
    });
  }, []);
  const getCatOpps = (name) => allOpportunities.filter(o => o.category === name).slice(0, 5);
  const grants = allOpportunities.filter(o => o.category === 'Grant').slice(0, 5);
  const competitions = allOpportunities.filter(o => o.category === 'Fellowship' || o.category === 'Award').slice(0, 5);
  const sidebarRecent = allOpportunities.slice(0, 4);
  const CATEGORY_SLUG = { Scholarship: 'scholarships', Grant: 'grants', Job: 'jobs', Internship: 'internships', Fellowship: 'fellowships', Training: 'training', Volunteer: 'volunteer' };
  const filteredOpps = activeCategory ? allOpportunities.filter(o => o.category === activeCategory) : allOpportunities;
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
                          <h3 className="font-bold text-base">{list.name}</h3>
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
                                <p className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
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
            <NewsSection />
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
