import { useState, useEffect } from 'react';
import { Building2, Users, Target } from 'lucide-react';
import SEO from '../components/shared/SEO';
import { AnimatedPage } from '../components/shared/AnimatedPage';
import { api } from '@/api/client';
import AnimatedCounter from '@/components/AnimatedCounter';

const defaultContent = {
  hero_title: 'About BCO',
  hero_subtitle: 'Bridge Collective Opportunities (BCO) is a global opportunity discovery platform that connects people with opportunities in education, employment, entrepreneurship, and personal development. We make it easier to discover, understand, and access jobs, scholarships, grants, fellowships, internships, competitions, and other opportunities from around the world.',
  stats: [
    { value: '10K+', label: 'Opportunities' },
    { value: '50K+', label: 'Active Users' },
    { value: '100+', label: 'Partner Orgs' },
    { value: '95%', label: 'Satisfaction' },
  ],
  mission_title: 'Bridging the gap between talent and opportunity',
  mission_text: 'Bridge Collective Opportunities (BCO) was founded with a simple yet powerful goal: to bridge the gap between young people and life-changing opportunities. We believe that accessing opportunities should be transparent, accessible, and empowering.',
  mission_text2: 'Our platform provides access to scholarships, grants, internships, fellowships, jobs, training, and volunteering opportunities — ensuring that every young person can find their next big step.',
  values: [
    { title: 'Youth Focused', desc: 'We put young people at the heart of everything we do.' },
    { title: 'Curated Opportunities', desc: 'Connecting the right people with the right opportunities.' },
    { title: 'Verified Listings', desc: 'We ensure a safe and trustworthy platform.' },
    { title: 'Global Reach', desc: 'Opportunities from around the world, accessible to all.' },
    { title: 'Quality First', desc: 'Every opportunity is reviewed before being published.' },
    { title: 'Community Driven', desc: 'Built by youth, for youth — your success is our mission.' },
  ],
  timeline: [
    { year: '2020', title: 'Founded', desc: 'BCO was launched to bridge the opportunity gap.' },
    { year: '2021', title: '1,000 Opportunities', desc: 'Reached our first major milestone.' },
    { year: '2023', title: '50K Users', desc: 'A growing community of motivated youth.' },
    { year: '2024', title: 'Global Expansion', desc: 'Extended reach across Africa and beyond.' },
  ],
  cta_title: 'Ready to find your next opportunity?',
  cta_text: 'Join thousands of young people already discovering life-changing opportunities on BCO.',
};

const stats = [
  { value: '0', label: 'Opportunities', color: 'from-blue-500 to-blue-600' },
  { value: '0', label: 'Active Users', color: 'from-green-500 to-green-600' },
  { value: '0', label: 'Partner Orgs', color: 'from-orange-500 to-orange-600' },
  { value: '0', label: 'Satisfaction', color: 'from-blue-500 to-green-500' },
];

const valueColors = [
  { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
];

export default function About() {
  const [content, setContent] = useState(defaultContent);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.settings.getAll().then(all => {
      if (all.about_page) setContent({ ...defaultContent, ...all.about_page });
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const c = loaded ? content : defaultContent;

  return (
    <>
      <SEO title="About" description="Bridge Collective Opportunities (BCO) is a global opportunity discovery platform that connects people with opportunities in education, employment, entrepreneurship, and personal development. We make it easier to discover, understand, and access jobs, scholarships, grants, fellowships, internships, competitions, and other opportunities from around the world." />
      <AnimatedPage>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-green-500 py-20">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 30px 30px, white 2px, transparent 2px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="flex items-center justify-center gap-0 mb-6">
              <img src="https://res.cloudinary.com/et33rup2/image/upload/v1786959015/BCO.png" alt="BCO" className="h-32 md:h-48 w-auto drop-shadow-lg" />
              <span className="font-bold text-sm sm:text-base md:text-lg leading-tight text-white drop-shadow-sm text-left">
                BRIDGE COLLECTIVE<br />OPPORTUNITIES
              </span>
            </div>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl md:text-6xl text-white mb-4 drop-shadow-sm">
              {c.hero_title}
            </h1>
            <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto">
              {c.hero_subtitle}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="relative -mt-10 z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {c.stats.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center hover:shadow-xl transition-shadow">
                <div className={`text-3xl sm:text-4xl font-black bg-gradient-to-r ${stats[i]?.color || 'from-blue-500 to-blue-600'} bg-clip-text text-transparent`}>
                  <AnimatedCounter value={s.value} />
                </div>
                <p className="text-sm text-gray-500 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 mb-4">
                Our Mission
              </span>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground mb-6">
                {c.mission_title}
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed text-lg">{c.mission_text}</p>
              <p className="text-muted-foreground leading-relaxed text-lg">{c.mission_text2}</p>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 via-green-500 to-orange-500 rounded-3xl p-1">
                <div className="bg-white rounded-[calc(1.5rem-4px)] p-8 aspect-video flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600"><Building2 className="w-8 h-8" /></div>
                    <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center text-green-600"><Users className="w-8 h-8" /></div>
                    <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600"><Target className="w-8 h-8" /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-gradient-to-r from-blue-50 via-green-50 to-orange-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white text-gray-700 border border-gray-200 mb-4">
                Our Values
              </span>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
                What <span className="text-blue-600">drives</span> us <span className="text-green-600">every</span> <span className="text-orange-600">day</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.values.map((v, i) => {
                const vc = valueColors[i % valueColors.length];
                return (
                  <div key={i} className={`bg-white border ${vc.border} rounded-2xl p-6 hover:shadow-lg transition-all hover:-translate-y-1`}>
                    <div className={`w-12 h-12 rounded-xl ${vc.bg} flex items-center justify-center mx-auto mb-4 ${vc.color}`}>
                      <span className={`text-lg font-black ${vc.color}`}>{v.title[0]}</span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-center">{v.title}</h3>
                    <p className="text-sm text-muted-foreground text-center">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700 mb-4">
              Our Journey
            </span>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
              How we <span className="text-orange-600">grew</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.timeline.map((m, i) => (
              <div key={i} className="relative bg-white border border-gray-100 rounded-2xl p-6 text-center hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center mx-auto mb-4 text-white font-black text-lg">
                  {m.year.slice(2)}
                </div>
                <h3 className="font-bold text-lg mb-1">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 via-green-600 to-orange-600 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white mb-4">{c.cta_title}</h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">{c.cta_text}</p>
            <a href="/" className="inline-block bg-white text-blue-600 font-bold px-8 py-3 rounded-xl hover:shadow-lg hover:scale-105 transition-all">
              Browse Opportunities
            </a>
          </div>
        </section>
      </AnimatedPage>
    </>
  );
}
