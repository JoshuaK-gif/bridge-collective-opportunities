import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';

const ICON_OPTIONS = [
  'FileText', 'Target', 'Eye', 'ListChecks', 'CheckCircle2',
  'AlertTriangle', 'Star', 'Lightbulb', 'Users', 'Globe',
];

const defaultData = {
  page_title: 'CV Writing Tips',
  page_subtitle: 'Expert advice to help you create a CV that stands out to employers and opportunity providers.',
  tips: [
    { title: 'Keep It One Page', desc: 'For most youth opportunities, a one-page CV is ideal. Recruiters spend an average of 6 seconds scanning a CV. Make every word count.', icon: 'FileText' },
    { title: 'Tailor for Each Opportunity', desc: 'Never send the same CV everywhere. Adjust your summary and skills to match what each specific opportunity asks for. Use keywords from the job description.', icon: 'Target' },
    { title: 'Use a Clean, Professional Design', desc: 'Use consistent fonts, clear section headings, and plenty of white space. Avoid fancy graphics or colors that distract from your content.', icon: 'Eye' },
    { title: 'Highlight Achievements, Not Duties', desc: 'Instead of "Responsible for social media", write "Grew Instagram following by 200% in 3 months." Use numbers and specific results.', icon: 'ListChecks' },
    { title: 'Include a Professional Summary', desc: 'A 2-3 sentence summary at the top of your CV tells recruiters who you are and what you\'re looking for. Make it compelling and specific.', icon: 'CheckCircle2' },
    { title: 'Avoid Common Mistakes', desc: 'Check for typos, use a professional email address (not partyboy123@gmail.com), save as PDF, and never lie on your CV.', icon: 'AlertTriangle' },
  ],
  dos: [
    'Use action verbs (managed, developed, led, created)',
    'Quantify your achievements with numbers',
    'Keep formatting consistent throughout',
    'Include relevant keywords from the opportunity',
    'List skills that are actually relevant',
    'Proofread at least twice',
    'Save and send as PDF',
    'Use a clear file name (John_Doe_CV.pdf)',
  ],
  donts: [
    'Use generic objectives like "seeking a challenging position"',
    'Include irrelevant work experience',
    'Use unprofessional email addresses',
    'Add references unless requested',
    'Include your photo (not standard in most countries)',
    'Use overly complex formatting or tables',
    'Lie or exaggerate your experience',
    'Send the same CV to every opportunity',
  ],
};

const colorPairs = [
  { value: 'blue', label: 'Blue', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'green', label: 'Green', color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'purple', label: 'Purple', color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'orange', label: 'Orange', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'teal', label: 'Teal', color: 'text-teal-600', bg: 'bg-teal-50' },
  { value: 'red', label: 'Red', color: 'text-red-600', bg: 'bg-red-50' },
  { value: 'indigo', label: 'Indigo', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { value: 'pink', label: 'Pink', color: 'text-pink-600', bg: 'bg-pink-50' },
];

const iconColorMap = {
  FileText: 'text-blue-600',
  Target: 'text-green-600',
  Eye: 'text-purple-600',
  ListChecks: 'text-orange-600',
  CheckCircle2: 'text-teal-600',
  AlertTriangle: 'text-red-600',
  Star: 'text-amber-600',
  Lightbulb: 'text-amber-500',
  Users: 'text-indigo-600',
  Globe: 'text-sky-600',
};

const iconBgMap = {
  FileText: 'bg-blue-50',
  Target: 'bg-green-50',
  Eye: 'bg-purple-50',
  ListChecks: 'bg-orange-50',
  CheckCircle2: 'bg-teal-50',
  AlertTriangle: 'bg-red-50',
  Star: 'bg-amber-50',
  Lightbulb: 'bg-amber-50',
  Users: 'bg-indigo-50',
  Globe: 'bg-sky-50',
};

export default function AdminCvTips() {
  const [data, setData] = useState(defaultData);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.settings.get('cv_tips').then(res => {
      if (res?.value) {
        setData(prev => ({
          ...defaultData,
          ...res.value,
          tips: res.value.tips?.length ? res.value.tips : defaultData.tips,
          dos: res.value.dos?.length ? res.value.dos : defaultData.dos,
          donts: res.value.donts?.length ? res.value.donts : defaultData.donts,
        }));
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tips = data.tips.map(t => ({
        ...t,
        color: iconColorMap[t.icon] || 'text-blue-600',
        bg: iconBgMap[t.icon] || 'bg-blue-50',
      }));
      await api.settings.update('cv_tips', { ...data, tips });
      toast.success('CV tips saved');
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
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">CV Tips Editor</h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Page Meta */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-heading">Page Settings</h2>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Page Title</label>
          <Input value={data.page_title} onChange={e => setData(prev => ({ ...prev, page_title: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Page Subtitle</label>
          <Textarea value={data.page_subtitle} onChange={e => setData(prev => ({ ...prev, page_subtitle: e.target.value }))} rows={2} />
        </div>
      </section>

      {/* Tips Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-heading">Tips</h2>
          <Button variant="outline" size="sm" onClick={() => setData(prev => ({ ...prev, tips: [...prev.tips, { title: '', desc: '', icon: 'Lightbulb' }] }))}>
            <Plus className="w-4 h-4 mr-1" /> Add Tip
          </Button>
        </div>
        <div className="space-y-3">
          {data.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border bg-card p-4">
              <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="grid sm:grid-cols-3 gap-2">
                  <Input value={tip.title} onChange={e => {
                    const next = [...data.tips];
                    next[i] = { ...next[i], title: e.target.value };
                    setData(prev => ({ ...prev, tips: next }));
                  }} placeholder="Tip title" />
                  <select value={tip.icon} onChange={e => {
                    const next = [...data.tips];
                    next[i] = { ...next[i], icon: e.target.value };
                    setData(prev => ({ ...prev, tips: next }));
                  }} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm">
                    {ICON_OPTIONS.map(ico => (
                      <option key={ico} value={ico}>{ico}</option>
                    ))}
                  </select>
                  <select value={colorPairs.find(c => c.color === tip.color)?.value || 'blue'} onChange={e => {
                    const pair = colorPairs.find(c => c.value === e.target.value);
                    const next = [...data.tips];
                    next[i] = { ...next[i], color: pair.color, bg: pair.bg };
                    setData(prev => ({ ...prev, tips: next }));
                  }} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm">
                    {colorPairs.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <Textarea value={tip.desc} onChange={e => {
                  const next = [...data.tips];
                  next[i] = { ...next[i], desc: e.target.value };
                  setData(prev => ({ ...prev, tips: next }));
                }} placeholder="Description" rows={2} />
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setData(prev => ({ ...prev, tips: prev.tips.filter((_, j) => j !== i) }))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Dos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-heading">Do's</h2>
          <Button variant="outline" size="sm" onClick={() => setData(prev => ({ ...prev, dos: [...prev.dos, ''] }))}>
            <Plus className="w-4 h-4 mr-1" /> Add Do
          </Button>
        </div>
        <div className="space-y-2">
          {data.dos.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input value={item} onChange={e => {
                const next = [...data.dos];
                next[i] = e.target.value;
                setData(prev => ({ ...prev, dos: next }));
              }} placeholder="Do item" className="flex-1" />
              <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setData(prev => ({ ...prev, dos: prev.dos.filter((_, j) => j !== i) }))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Don'ts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-heading">Don'ts</h2>
          <Button variant="outline" size="sm" onClick={() => setData(prev => ({ ...prev, donts: [...prev.donts, ''] }))}>
            <Plus className="w-4 h-4 mr-1" /> Add Don't
          </Button>
        </div>
        <div className="space-y-2">
          {data.donts.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border bg-card p-3">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input value={item} onChange={e => {
                const next = [...data.donts];
                next[i] = e.target.value;
                setData(prev => ({ ...prev, donts: next }));
              }} placeholder="Don't item" className="flex-1" />
              <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 text-destructive" onClick={() => setData(prev => ({ ...prev, donts: prev.donts.filter((_, j) => j !== i) }))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
