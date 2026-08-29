import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Megaphone, Mail, BarChart3, Target, Users, Star, ChevronRight } from 'lucide-react';
import { api } from '@/api/client';
import SEO from '@/components/SEO';
import { AnimatedPage } from '@/components/shared/AnimatedPage';

const defaultContent = {
  hero_title: 'Our Media & Marketing Services',
  hero_subtitle: 'A global platform connecting young people to life-changing opportunities. Partner with us to reach millions of ambitious youth worldwide.',
  benefits: [
    { title: 'Engaged Audience', desc: 'Direct access to students, graduates, and young professionals actively seeking opportunities.' },
    { title: 'Targeted Reach', desc: 'Reach the right audience — youth actively looking for education and career opportunities.' },
    { title: 'Maximum Impact', desc: 'Increase your visibility and ensure your opportunities reach those who need them most.' },
  ],
  services_list: [
    { title: 'Featured Posts', desc: 'Promote your opportunities on our high-traffic platform' },
    { title: 'Social Media', desc: 'Targeted promotion across all our social platforms' },
    { title: 'Newsletter', desc: 'Reach engaged subscribers directly in their inbox' },
    { title: 'Campaign Visibility', desc: 'Multi-channel campaign promotion and analytics' },
  ],
  cta_title: 'Ready to promote with us?',
  cta_text: 'Interested in collaborating, promoting opportunities, or working with us?',
};

const serviceColors = [
  { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  { color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
];

const benefitColors = [
  { color: 'text-blue-600', bg: 'bg-blue-100' },
  { color: 'text-green-600', bg: 'bg-green-100' },
  { color: 'text-orange-600', bg: 'bg-orange-100' },
];

export default function Services() {
  const [content, setContent] = useState(defaultContent);
  const [packages, setPackages] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.settings.getAll().then(all => {
      if (all.services_page) setContent({ ...defaultContent, ...all.services_page });
      if (Array.isArray(all.packages)) setPackages(all.packages);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const c = loaded ? content : defaultContent;
  const pkg = loaded && packages.length > 0 ? packages : [];

  return (
    <>
      <SEO
        title="Media & Marketing Services"
        description="Partner with Bridge Collective Opportunities to reach millions of ambitious youth. Promote scholarships, jobs, grants and opportunities on our high-traffic platform."
        keywords="marketing services, promote opportunities, youth advertising, Uganda marketing, BCO services"
      />
      <AnimatedPage>
      <div>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-green-500 py-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 text-white text-sm font-medium mb-4 backdrop-blur-sm">
              <Megaphone className="w-4 h-4" /> Promote with us
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading leading-tight text-white mb-4">
              {c.hero_title}
            </h1>
            <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto">{c.hero_subtitle}</p>
          </div>
        </section>

        {/* Why Partner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 mb-4">
              Why Partner
            </span>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
              Why Partner With <span className="text-blue-600">Bridge</span> <span className="text-green-600">Collective</span> <span className="text-orange-600">Opportunities</span>?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {c.benefits.map((item, i) => {
              const bc = benefitColors[i % benefitColors.length];
              const icons = [Users, Target, Star];
              const Icon = icons[i % icons.length];
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-8 hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className={`w-12 h-12 rounded-xl ${bc.bg} flex items-center justify-center mb-4 ${bc.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Services */}
        <section className="bg-gradient-to-r from-blue-50 via-green-50 to-orange-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white text-gray-700 border border-gray-200 mb-4">
                Our Services
              </span>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
                Tailored <span className="text-blue-600">promotional</span> solutions <span className="text-green-600">designed</span> to deliver <span className="text-orange-600">results</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {c.services_list.map((item, i) => {
                const sc = serviceColors[i % serviceColors.length];
                const icons = [Globe, Megaphone, Mail, BarChart3];
                const Icon = icons[i % icons.length];
                return (
                  <div key={i} className={`bg-white border ${sc.border} rounded-2xl p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1`}>
                    <div className={`w-14 h-14 rounded-xl ${sc.bg} flex items-center justify-center mx-auto mb-4 ${sc.color}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-base mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        {pkg.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 mb-4">
                Pricing
              </span>
              <h2 className="font-heading font-bold text-3xl sm:text-4xl text-foreground">
                Marketing <span className="text-blue-600">Packages</span>
              </h2>
              <p className="text-muted-foreground mt-2">Choose the plan that fits your needs</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {pkg.map((p, idx) => (
                <div key={idx} className={`bg-white rounded-2xl border border-gray-100 p-6 relative hover:shadow-xl transition-all ${p.popular ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]' : 'shadow-lg'}`}>
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${p.color ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} mb-4`}>
                    {p.name}
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-black text-gray-900">{p.price}</span>
                    <span className="text-sm text-gray-500 ml-1">{p.period}</span>
                  </div>
                  <ul className="space-y-3">
                    {(p.features || []).map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-sm text-gray-600">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shrink-0 mt-0.5">
                          <ChevronRight className="w-3 h-3 text-white" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              We offer flexible pricing for youth-led and grassroots organisations. Contact us for tailored packages.
            </p>
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 via-green-600 to-orange-600 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white mb-4">{c.cta_title}</h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">{c.cta_text}</p>
            <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-blue-600 font-bold hover:shadow-lg hover:scale-105 transition-all">
              <Mail className="w-4 h-4" /> Contact Bridge Collective Opportunities
            </Link>
          </div>
        </section>
      </div>
    </AnimatedPage>
    </>
  );
}
