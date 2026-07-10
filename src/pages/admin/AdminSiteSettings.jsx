import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, Plus, Trash2, GripVertical, Mail, Send, CheckCircle2, XCircle, Sparkles, Globe } from 'lucide-react';

const defaultStats = { monthly_visitors: '100K+', social_followers: '50K+', newsletter_subs: '20K+', opportunities_listed: '500+' };

const defaultPackages = [
  { name: 'Starter Package', price: '$450', period: '/ Month', color: 'from-green-500 to-emerald-600', features: ['Website post on Bridge Collective Opportunities platform', 'Standard visibility', '1-2 social media promotions'] },
  { name: 'Growth Package', price: '$700', period: '/ Month', color: 'from-blue-500 to-indigo-600', popular: true, features: ['Website post + homepage feature', '2-3 social media promotions per week', 'Newsletter inclusion'] },
  { name: 'Impact Package', price: '$2,500', period: ' / campaign', color: 'from-purple-500 to-violet-600', features: ['Priority website placement', 'Multi-week campaign promotion', 'Intensive social media coverage', 'Newsletter feature', 'LinkedIn or YouTube Live session'] },
  { name: 'Annual Partnership', price: '$5,000', period: ' / Year', color: 'from-amber-500 to-orange-600', features: ['Ongoing promotion throughout the year', 'Multiple campaigns', 'Priority support and placement', 'Continuous brand visibility'] },
];

const defaultSmtp = { host: '', port: '587', secure: false, user: '', pass: '', from_email: '', from_name: 'Bridge Collective' };

export default function AdminSiteSettings() {
  const [stats, setStats] = useState(defaultStats);
  const [packages, setPackages] = useState(defaultPackages);
  const [savingStats, setSavingStats] = useState(false);
  const [savingPackages, setSavingPackages] = useState(false);
  const [smtp, setSmtp] = useState(defaultSmtp);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [lastNewsletter, setLastNewsletter] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [aiConfig, setAiConfig] = useState({ api_key: '', provider: 'openrouter', model: 'google/gemini-2.0-flash-001', enabled: false });
  const [savingAi, setSavingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    api.settings.getAll().then(all => {
      if (all.stats) setStats(all.stats);
      if (Array.isArray(all.packages)) setPackages(all.packages);
      if (all.smtp_config && all.smtp_config.host) setSmtp(all.smtp_config);
      if (all.openai_config) setAiConfig(all.openai_config);
    }).catch(() => {});
    api.request('/newsletter/status').then(d => setLastNewsletter(d)).catch(() => {});
    api.request('/ai/status').then(d => setAiStatus(d)).catch(() => {});
  }, []);

  const handleAiSave = async () => {
    setSavingAi(true);
    try {
      await api.settings.update('openai_config', aiConfig);
      await api.request('/ai/clear-cache', { method: 'POST' }).catch(() => {});
      toast.success('AI config saved (cache cleared)');
      api.request('/ai/status').then(d => setAiStatus(d)).catch(() => {});
    } catch {
      toast.error('Failed to save AI config');
    } finally {
      setSavingAi(false);
    }
  };

  const handleStatsSave = async () => {
    setSavingStats(true);
    try {
      await api.settings.update('stats', stats);
      toast.success('Stats updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingStats(false);
    }
  };

  const handlePackagesSave = async () => {
    setSavingPackages(true);
    try {
      await api.settings.update('packages', packages);
      toast.success('Packages updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingPackages(false);
    }
  };

  const addPackage = () => {
    setPackages(prev => [...prev, { name: '', price: '', period: '', color: 'from-gray-500 to-gray-600', features: [''] }]);
  };

  const removePackage = (idx) => {
    setPackages(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePackage = (idx, field, value) => {
    setPackages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const addFeature = (pkgIdx) => {
    setPackages(prev => prev.map((p, i) => i === pkgIdx ? { ...p, features: [...p.features, ''] } : p));
  };

  const updateFeature = (pkgIdx, featIdx, value) => {
    setPackages(prev => prev.map((p, i) => i === pkgIdx ? { ...p, features: p.features.map((f, j) => j === featIdx ? value : f) } : p));
  };

  const removeFeature = (pkgIdx, featIdx) => {
    setPackages(prev => prev.map((p, i) => i === pkgIdx ? { ...p, features: p.features.filter((_, j) => j !== featIdx) } : p));
  };

  return (
    <div className="space-y-10">
      {/* Stats */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-heading">Reach &amp; Impact Stats</h2>
          <Button size="sm" onClick={handleStatsSave} disabled={savingStats}>
            <Save className="w-4 h-4 mr-1" /> {savingStats ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(stats).map(([key, val]) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground capitalize mb-1 block">{key.replace(/_/g, ' ')}</label>
              <Input value={val} onChange={e => setStats(prev => ({ ...prev, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Packages */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-heading">Pricing Packages</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addPackage}><Plus className="w-4 h-4 mr-1" /> Add Package</Button>
            <Button size="sm" onClick={handlePackagesSave} disabled={savingPackages}>
              <Save className="w-4 h-4 mr-1" /> {savingPackages ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="space-y-4">
          {packages.map((pkg, idx) => (
            <div key={idx} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                  <span className="font-medium text-sm">Package {idx + 1}</span>
                </div>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => removePackage(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input value={pkg.name} onChange={e => updatePackage(idx, 'name', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Price</label>
                  <Input value={pkg.price} onChange={e => updatePackage(idx, 'price', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Period</label>
                  <Input value={pkg.period} onChange={e => updatePackage(idx, 'period', e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Color class (e.g. from-green-500 to-emerald-600)</label>
                  <Input value={pkg.color || ''} onChange={e => updatePackage(idx, 'color', e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
                  <input type="checkbox" checked={!!pkg.popular} onChange={e => updatePackage(idx, 'popular', e.target.checked)} />
                  Popular
                </label>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Features</label>
                {pkg.features.map((feat, fi) => (
                  <div key={fi} className="flex items-center gap-2 mb-1.5">
                    <Input value={feat} onChange={e => updateFeature(idx, fi, e.target.value)} className="text-sm" />
                    <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => removeFeature(idx, fi)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => addFeature(idx)}>
                  <Plus className="w-3 h-3 mr-1" /> Add feature
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SMTP / Newsletter */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Mail className="w-5 h-5" /> Email Newsletter
          </h2>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">SMTP Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Host</label>
              <Input value={smtp.host} onChange={e => setSmtp(f => ({ ...f, host: e.target.value }))} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Port</label>
              <Input value={smtp.port} onChange={e => setSmtp(f => ({ ...f, port: e.target.value }))} placeholder="587" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
              <Input value={smtp.user} onChange={e => setSmtp(f => ({ ...f, user: e.target.value }))} placeholder="your@email.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
              <Input type="password" value={smtp.pass} onChange={e => setSmtp(f => ({ ...f, pass: e.target.value }))} placeholder="App password" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Email</label>
              <Input value={smtp.from_email} onChange={e => setSmtp(f => ({ ...f, from_email: e.target.value }))} placeholder="noreply@bridgejobs.ug" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Name</label>
              <Input value={smtp.from_name} onChange={e => setSmtp(f => ({ ...f, from_name: e.target.value }))} placeholder="Bridge Collective" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={smtp.secure} onChange={e => setSmtp(f => ({ ...f, secure: e.target.checked }))} />
              Use SSL (port 465)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={async () => {
              setSavingSmtp(true);
              try {
                await api.settings.update('smtp_config', smtp);
                toast.success('SMTP config saved');
              } catch { toast.error('Failed to save'); }
              setSavingSmtp(false);
            }} disabled={savingSmtp}>
              <Save className="w-4 h-4 mr-1" /> {savingSmtp ? 'Saving...' : 'Save SMTP'}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4 mt-4">
          <h3 className="font-semibold text-sm">Test &amp; Send</h3>
          <div className="flex items-center gap-2">
            <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="max-w-xs" />
            <Button variant="outline" size="sm" onClick={async () => {
              if (!testEmail) { toast.error('Enter a test email'); return; }
              setSendingTest(true);
              setTestResult(null);
              try {
                const res = await api.request('/newsletter/test', { method: 'POST', body: JSON.stringify({ to: testEmail, config: smtp }) });
                setTestResult(res);
                toast.success(res.success ? 'Test email sent!' : 'Failed: ' + res.reason);
              } catch { toast.error('Failed to send test'); }
              setSendingTest(false);
            }} disabled={sendingTest}>
              <Send className="w-4 h-4 mr-1" /> {sendingTest ? 'Sending...' : 'Send Test'}
            </Button>
            {testResult && (
              testResult.success
                ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                : <XCircle className="w-4 h-4 text-red-600" />
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={async () => {
              setSendingNewsletter(true);
              try {
                const res = await api.request('/newsletter/send', { method: 'POST' });
                toast.success(`Sent to ${res.sent} subscribers`);
              } catch { toast.error('Failed to send newsletter'); }
              setSendingNewsletter(false);
            }} disabled={sendingNewsletter}>
              <Mail className="w-4 h-4 mr-1" /> {sendingNewsletter ? 'Sending...' : 'Send Newsletter Now'}
            </Button>
            {lastNewsletter && (
              <span className="text-xs text-muted-foreground">
                Last sent: {new Date(lastNewsletter.sent_at).toLocaleString()} ({lastNewsletter.count} subscribers)
              </span>
            )}
          </div>
        </div>
      </section>
      {/* AI Configuration */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> AI Configuration
          </h2>
          {aiStatus && (
            <span className={`text-xs flex items-center gap-1 ${aiStatus.configured ? 'text-green-600' : 'text-gray-400'}`}>
              {aiStatus.configured ? <><CheckCircle2 className="w-3 h-3" /> Connected ({aiStatus.provider})</> : <><XCircle className="w-3 h-3" /> Not configured</>}
            </span>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
              <select
                value={aiConfig.provider}
                onChange={e => {
                  const p = e.target.value;
                  const defaults = { gemini: 'gemini-2.0-flash', opencodezen: 'deepseek-v4-flash-free', openrouter: 'google/gemini-2.0-flash-001', openai: 'gpt-4o-mini' };
                  setAiConfig(f => ({ ...f, provider: p, model: defaults[p] || f.model }));
                }}
                className="w-full h-10 text-sm rounded-lg border border-gray-200 px-3 bg-white"
              >
                <option value="gemini">Google Gemini (Free tier)</option>
                <option value="opencodezen">OpenCode Zen (Free)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
              <div className="flex gap-2">
                <select
                  value={aiConfig.model}
                  onChange={e => setAiConfig(f => ({ ...f, model: e.target.value }))}
                  className="flex-1 h-10 text-sm rounded-lg border border-gray-200 px-3 bg-white"
                >
                  <optgroup label="Google Gemini (Free tier)">
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (fastest)</option>
                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite (cheapest)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </optgroup>
                  <optgroup label="OpenCode Zen (Free)">
                    <option value="deepseek-v4-flash-free">DeepSeek V4 Flash Free ($0)</option>
                  </optgroup>
                  <optgroup label="OpenRouter (Free Tier)">
                    <option value="deepseek/deepseek-v4-flash:free">DeepSeek V4 Flash (free)</option>
                  </optgroup>
                  <optgroup label="OpenRouter (Paid)">
                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (cheapest)</option>
                    <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                    <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</option>
                    <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  value={aiConfig.api_key}
                  onChange={e => setAiConfig(f => ({ ...f, api_key: e.target.value }))}
                  placeholder={aiConfig.provider === 'opencodezen' ? 'Optional - leave blank for free tier' : aiConfig.provider === 'gemini' ? 'AI... (free from Google AI Studio)' : aiConfig.provider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
                  className="pl-9 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={aiConfig.enabled} onChange={e => setAiConfig(f => ({ ...f, enabled: e.target.checked }))} />
              Enable AI features
            </label>
            <Button size="sm" onClick={handleAiSave} disabled={savingAi}>
              <Save className="w-4 h-4 mr-1" /> {savingAi ? 'Saving...' : 'Save AI Config'}
            </Button>
            {aiStatus && aiStatus.configured && (
              <span className="text-xs text-muted-foreground">Cache: {aiStatus.cache_size} entries</span>
            )}
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p><strong>Gemini (recommended):</strong> Get a <strong>free API key</strong> from{' '}
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a>
            {' '}— 60 requests/min free, no credit card needed. Select Gemini as provider and paste your key.</p>
            <p><strong>Totally free:</strong> Select <strong>OpenCode Zen</strong> — no API key needed, $0 / 100% free, but has rate limits.</p>
            <p><strong>Need more?</strong> Use <strong>OpenRouter</strong> —{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline">openrouter.ai/keys</a>
            , add $1 credit to start.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
