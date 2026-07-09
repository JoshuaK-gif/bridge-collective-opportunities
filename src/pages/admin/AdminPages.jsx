import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Plus, Trash2, GripVertical, Package } from 'lucide-react';

const defaultAbout = {
  hero_title: 'About Bridge Collective Opportunities',
  hero_subtitle: 'We are a leading platform dedicated to connecting young people with life-changing opportunities worldwide.',
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
  stats: [
    { value: '10K+', label: 'Opportunities' },
    { value: '50K+', label: 'Active Users' },
    { value: '100+', label: 'Partner Orgs' },
    { value: '95%', label: 'Satisfaction' },
  ],
  cta_title: 'Ready to find your next opportunity?',
  cta_text: 'Join thousands of young people already discovering life-changing opportunities on BCO.',
};

const defaultServices = {
  hero_title: 'Our Media & Marketing Services',
  hero_subtitle: 'A global platform connecting young people to life-changing opportunities. Partner with us to reach millions of ambitious youth worldwide.',
  stats: [
    { label: 'Monthly Visitors', value: '100K+', icon: 'Globe' },
    { label: 'Social Followers', value: '50K+', icon: 'Users' },
    { label: 'Newsletter Subs', value: '20K+', icon: 'Mail' },
    { label: 'Opportunities Listed', value: '500+', icon: 'Target' },
  ],
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

export default function AdminPages() {
  const [tab, setTab] = useState('about');
  const [about, setAbout] = useState(defaultAbout);
  const [services, setServices] = useState(defaultServices);
  const [packages, setPackages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.settings.getAll().then(all => {
      if (all.about_page) setAbout({ ...defaultAbout, ...all.about_page });
      if (all.services_page) setServices({ ...defaultServices, ...all.services_page });
      if (Array.isArray(all.packages)) setPackages(all.packages);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'about') {
        await api.settings.update('about_page', about);
      } else {
        await api.settings.update('services_page', services);
        await api.settings.update('packages', packages);
      }
      toast.success('Page content saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Page Content Editor</h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="flex gap-2 border-b pb-3">
        {['about', 'services'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          >
            {t === 'about' ? 'About Page' : 'Services Page'}
          </button>
        ))}
      </div>

      {tab === 'about' && (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold font-heading mb-4">Hero Section</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input value={about.hero_title} onChange={e => setAbout(prev => ({ ...prev, hero_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtitle</label>
                <Textarea value={about.hero_subtitle} onChange={e => setAbout(prev => ({ ...prev, hero_subtitle: e.target.value }))} rows={2} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Stats</h2>
              <Button variant="outline" size="sm" onClick={() => setAbout(prev => ({ ...prev, stats: [...prev.stats, { value: '', label: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Stat
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {about.stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input value={stat.value} onChange={e => {
                      const next = [...about.stats];
                      next[i] = { ...next[i], value: e.target.value };
                      setAbout(prev => ({ ...prev, stats: next }));
                    }} placeholder="10K+" />
                    <Input value={stat.label} onChange={e => {
                      const next = [...about.stats];
                      next[i] = { ...next[i], label: e.target.value };
                      setAbout(prev => ({ ...prev, stats: next }));
                    }} placeholder="Opportunities" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setAbout(prev => ({ ...prev, stats: prev.stats.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-heading mb-4">Mission Section</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input value={about.mission_title} onChange={e => setAbout(prev => ({ ...prev, mission_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paragraph 1</label>
                <Textarea value={about.mission_text} onChange={e => setAbout(prev => ({ ...prev, mission_text: e.target.value }))} rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Paragraph 2</label>
                <Textarea value={about.mission_text2} onChange={e => setAbout(prev => ({ ...prev, mission_text2: e.target.value }))} rows={3} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Values</h2>
              <Button variant="outline" size="sm" onClick={() => setAbout(prev => ({ ...prev, values: [...prev.values, { title: '', desc: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Value
              </Button>
            </div>
            <div className="space-y-3">
              {about.values.map((v, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <Input value={v.title} onChange={e => {
                      const next = [...about.values];
                      next[i] = { ...next[i], title: e.target.value };
                      setAbout(prev => ({ ...prev, values: next }));
                    }} placeholder="Title" />
                    <Input value={v.desc} onChange={e => {
                      const next = [...about.values];
                      next[i] = { ...next[i], desc: e.target.value };
                      setAbout(prev => ({ ...prev, values: next }));
                    }} placeholder="Description" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setAbout(prev => ({ ...prev, values: prev.values.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Timeline / Milestones</h2>
              <Button variant="outline" size="sm" onClick={() => setAbout(prev => ({ ...prev, timeline: [...prev.timeline, { year: '', title: '', desc: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Milestone
              </Button>
            </div>
            <div className="space-y-3">
              {about.timeline.map((m, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                  <div className="flex-1 grid sm:grid-cols-3 gap-2">
                    <Input value={m.year} onChange={e => {
                      const next = [...about.timeline];
                      next[i] = { ...next[i], year: e.target.value };
                      setAbout(prev => ({ ...prev, timeline: next }));
                    }} placeholder="2024" />
                    <Input value={m.title} onChange={e => {
                      const next = [...about.timeline];
                      next[i] = { ...next[i], title: e.target.value };
                      setAbout(prev => ({ ...prev, timeline: next }));
                    }} placeholder="Title" />
                    <Input value={m.desc} onChange={e => {
                      const next = [...about.timeline];
                      next[i] = { ...next[i], desc: e.target.value };
                      setAbout(prev => ({ ...prev, timeline: next }));
                    }} placeholder="Description" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setAbout(prev => ({ ...prev, timeline: prev.timeline.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-heading mb-4">Call to Action</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input value={about.cta_title} onChange={e => setAbout(prev => ({ ...prev, cta_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Text</label>
                <Textarea value={about.cta_text} onChange={e => setAbout(prev => ({ ...prev, cta_text: e.target.value }))} rows={2} />
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold font-heading mb-4">Hero Section</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input value={services.hero_title} onChange={e => setServices(prev => ({ ...prev, hero_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Subtitle</label>
                <Textarea value={services.hero_subtitle} onChange={e => setServices(prev => ({ ...prev, hero_subtitle: e.target.value }))} rows={2} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Stats</h2>
              <Button variant="outline" size="sm" onClick={() => setServices(prev => ({ ...prev, stats: [...prev.stats, { label: '', value: '', icon: 'Globe' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Stat
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {services.stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border bg-card p-3">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input value={stat.value} onChange={e => {
                      const next = [...services.stats];
                      next[i] = { ...next[i], value: e.target.value };
                      setServices(prev => ({ ...prev, stats: next }));
                    }} placeholder="100K+" />
                    <Input value={stat.label} onChange={e => {
                      const next = [...services.stats];
                      next[i] = { ...next[i], label: e.target.value };
                      setServices(prev => ({ ...prev, stats: next }));
                    }} placeholder="Visitors" />
                    <Input value={stat.icon} onChange={e => {
                      const next = [...services.stats];
                      next[i] = { ...next[i], icon: e.target.value };
                      setServices(prev => ({ ...prev, stats: next }));
                    }} placeholder="Globe" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setServices(prev => ({ ...prev, stats: prev.stats.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Benefits</h2>
              <Button variant="outline" size="sm" onClick={() => setServices(prev => ({ ...prev, benefits: [...prev.benefits, { title: '', desc: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Benefit
              </Button>
            </div>
            <div className="space-y-3">
              {services.benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <Input value={b.title} onChange={e => {
                      const next = [...services.benefits];
                      next[i] = { ...next[i], title: e.target.value };
                      setServices(prev => ({ ...prev, benefits: next }));
                    }} placeholder="Title" />
                    <Input value={b.desc} onChange={e => {
                      const next = [...services.benefits];
                      next[i] = { ...next[i], desc: e.target.value };
                      setServices(prev => ({ ...prev, benefits: next }));
                    }} placeholder="Description" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setServices(prev => ({ ...prev, benefits: prev.benefits.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading">Services List</h2>
              <Button variant="outline" size="sm" onClick={() => setServices(prev => ({ ...prev, services_list: [...prev.services_list, { title: '', desc: '' }] }))}>
                <Plus className="w-4 h-4 mr-1" /> Add Service
              </Button>
            </div>
            <div className="space-y-3">
              {services.services_list.map((s, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
                  <div className="flex-1 grid sm:grid-cols-2 gap-2">
                    <Input value={s.title} onChange={e => {
                      const next = [...services.services_list];
                      next[i] = { ...next[i], title: e.target.value };
                      setServices(prev => ({ ...prev, services_list: next }));
                    }} placeholder="Title" />
                    <Input value={s.desc} onChange={e => {
                      const next = [...services.services_list];
                      next[i] = { ...next[i], desc: e.target.value };
                      setServices(prev => ({ ...prev, services_list: next }));
                    }} placeholder="Description" />
                  </div>
                  <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setServices(prev => ({ ...prev, services_list: prev.services_list.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Packages */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading flex items-center gap-2">
                <Package className="w-5 h-5" /> Marketing Packages
              </h2>
              <Button variant="outline" size="sm" onClick={() => setPackages(prev => [...prev, { name: '', price: '', period: '', features: [''] }])}>
                <Plus className="w-4 h-4 mr-1" /> Add Package
              </Button>
            </div>
            <div className="space-y-4">
              {packages.map((pkg, idx) => (
                <div key={idx} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <span className="font-medium text-sm">Package {idx + 1}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setPackages(prev => prev.filter((_, j) => j !== idx))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <Input value={pkg.name} onChange={e => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Price</label>
                      <Input value={pkg.price} onChange={e => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, price: e.target.value } : p))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Period</label>
                      <Input value={pkg.period} onChange={e => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, period: e.target.value } : p))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!!pkg.popular} onChange={e => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, popular: e.target.checked } : p))} />
                      Popular
                    </label>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Features</label>
                    {(pkg.features || []).map((feat, fi) => (
                      <div key={fi} className="flex items-center gap-2 mb-1.5">
                        <Input value={feat} onChange={e => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, features: p.features.map((f, j) => j === fi ? e.target.value : f) } : p))} className="text-sm" />
                        <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, features: p.features.filter((_, j) => j !== fi) } : p))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => setPackages(prev => prev.map((p, i) => i === idx ? { ...p, features: [...p.features, ''] } : p))}>
                      <Plus className="w-3 h-3 mr-1" /> Add feature
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold font-heading mb-4">Call to Action</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input value={services.cta_title} onChange={e => setServices(prev => ({ ...prev, cta_title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Text</label>
                <Textarea value={services.cta_text} onChange={e => setServices(prev => ({ ...prev, cta_text: e.target.value }))} rows={2} />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
