import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, Globe, Share2, MessageCircle, Twitter, Linkedin, Facebook, Instagram } from 'lucide-react';

export default function AdminScraperConfig() {
  const [scraper, setScraper] = useState({ source_url: 'https://opportunitiesforyouth.org/feed/', source_feeds: ['https://opportunitiesforyouth.org/feed/'], enabled: false, interval_minutes: 60, auto_post: false, auto_social: false, category_map: {} });
  const [social, setSocial] = useState({ twitter: { enabled: false, api_key: '', api_secret: '', access_token: '', access_secret: '' }, linkedin: { enabled: false, access_token: '', person_id: '' }, facebook: { enabled: false, page_id: '', access_token: '' }, instagram: { enabled: false, access_token: '', instagram_id: '', default_image_url: '' }, whatsapp: { enabled: false, access_token: '', phone_number_id: '', target_phone: '', group_id: '' } });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => {
    Promise.all([
      api.settings.get('scraper_config'),
      api.settings.get('social_accounts'),
    ]).then(([s, sc]) => {
      if (s?.value) setScraper(s.value);
      if (sc?.value) setSocial(sc.value);
    }).catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (key, value) => {
    setSaving(key);
    try {
      await api.settings.update(key, value);
      toast.success(`${key} saved`);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving('');
    }
  };

  const updateNested = (obj, path, value) => {
    const keys = path.split('.');
    const newObj = { ...obj };
    let current = newObj;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return newObj;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  const KeyInput = ({ value, onChange, label, field }) => {
    const visible = showKeys[field];
    return (
      <div>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="relative">
          <Input type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} className="pr-8 font-mono text-xs" />
          <button type="button" onClick={() => setShowKeys(prev => ({ ...prev, [field]: !prev[field] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    );
  };

  const PlatformCard = ({ name, icon: Icon, fields, config, onChange }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            <CardTitle className="text-sm">{name}</CardTitle>
          </div>
          <Switch checked={config.enabled} onCheckedChange={v => onChange({ ...config, enabled: v })} />
        </div>
      </CardHeader>
      {config.enabled && (
        <CardContent className="space-y-2 pt-0">
          {fields.map(f => (
            <KeyInput key={f.key} label={f.label} field={`${name}.${f.key}`} value={config[f.key] || ''} onChange={v => onChange({ ...config, [f.key]: v })} />
          ))}
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Auto-Publish Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up API keys and preferences for scraping and social posting</p>
        </div>
      </div>

      <Tabs defaultValue="scraper">
        <TabsList>
          <TabsTrigger value="scraper"><Globe className="w-4 h-4 mr-1.5" /> Scraper</TabsTrigger>
          <TabsTrigger value="social"><Share2 className="w-4 h-4 mr-1.5" /> Social Media</TabsTrigger>
        </TabsList>

        {/* Scraper Config */}
        <TabsContent value="scraper" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Scraper Settings</CardTitle>
                  <CardDescription>Configure the RSS feed source and automation</CardDescription>
                </div>
                <Button size="sm" onClick={() => save('scraper_config', scraper)} disabled={saving === 'scraper_config'}>
                  <Save className="w-3.5 h-3.5 mr-1" /> {saving === 'scraper_config' ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">RSS Feed URLs (one per line)</Label>
                  <textarea
                    value={(scraper.source_feeds || [scraper.source_url]).join('\n')}
                    onChange={e => {
                      const urls = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                      setScraper(prev => ({ ...prev, source_feeds: urls, source_url: urls[0] || prev.source_url }));
                    }}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
                    placeholder="https://opportunitiesforyouth.org/feed/"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={scraper.enabled} onCheckedChange={v => setScraper(prev => ({ ...prev, enabled: v }))} />
                  <Label>Auto-publish enabled</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={scraper.auto_social} onCheckedChange={v => setScraper(prev => ({ ...prev, auto_social: v }))} />
                  <Label>Auto-post to social media</Label>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Check interval (minutes)</Label>
                  <Input type="number" value={scraper.interval_minutes} onChange={e => setScraper(prev => ({ ...prev, interval_minutes: parseInt(e.target.value) || 60 }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Config */}
        <TabsContent value="social" className="space-y-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Toggle each platform on and enter the required API credentials</p>
            <Button size="sm" onClick={() => save('social_accounts', social)} disabled={saving === 'social_accounts'}>
              <Save className="w-3.5 h-3.5 mr-1" /> {saving === 'social_accounts' ? 'Saving...' : 'Save All'}
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <PlatformCard name="Twitter" icon={Twitter} config={social.twitter} onChange={v => setSocial(prev => ({ ...prev, twitter: v }))} fields={[
              { key: 'api_key', label: 'API Key' },
              { key: 'api_secret', label: 'API Secret' },
              { key: 'access_token', label: 'Access Token' },
              { key: 'access_secret', label: 'Access Secret' },
            ]} />
            <PlatformCard name="LinkedIn" icon={Linkedin} config={social.linkedin} onChange={v => setSocial(prev => ({ ...prev, linkedin: v }))} fields={[
              { key: 'access_token', label: 'Access Token' },
              { key: 'person_id', label: 'Person ID (URN)' },
            ]} />
            <PlatformCard name="Facebook" icon={Facebook} config={social.facebook} onChange={v => setSocial(prev => ({ ...prev, facebook: v }))} fields={[
              { key: 'page_id', label: 'Page ID' },
              { key: 'access_token', label: 'Page Access Token' },
            ]} />
            <PlatformCard name="Instagram" icon={Instagram} config={social.instagram} onChange={v => setSocial(prev => ({ ...prev, instagram: v }))} fields={[
              { key: 'instagram_id', label: 'Instagram Business Account ID' },
              { key: 'access_token', label: 'Access Token (same as Facebook)' },
              { key: 'default_image_url', label: 'Default Image URL (fallback)' },
            ]} />
            <PlatformCard name="WhatsApp" icon={MessageCircle} config={social.whatsapp} onChange={v => setSocial(prev => ({ ...prev, whatsapp: v }))} fields={[
              { key: 'phone_number_id', label: 'Phone Number ID' },
              { key: 'access_token', label: 'Access Token' },
              { key: 'target_phone', label: 'Target Phone (with country code)' },
              { key: 'group_id', label: 'Group ID (optional)' },
            ]} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
