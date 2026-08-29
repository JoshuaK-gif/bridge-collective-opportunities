import { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Plus, Trash2, GripVertical, Trash } from 'lucide-react';

const ICON_OPTIONS = [
  'FileText', 'Target', 'Eye', 'ListChecks', 'CheckCircle2',
  'AlertTriangle', 'Star', 'Lightbulb', 'Users', 'Globe',
];

const defaultData = {
  page_title: 'CV Tips: How to Build an Application That Gets Noticed',
  page_subtitle: 'A strong CV is often the difference between an application that gets read and one that gets skipped. Whether you are applying for a job, an internship, a scholarship, or a fellowship, these guidelines will help you present yourself clearly and professionally.',
  tips: [
    { title: 'Start With a Clean, Consistent Structure', desc: 'Recruiters and selection panels often review dozens of applications in a single sitting. Make it easy for them: Use clear section headings (Personal Details, Summary, Education, Experience, Skills, Achievements, References). Keep formatting consistent with one font, one size for body text, one style for headings. Stick to 1\u20132 pages. Save and submit as a PDF.', icon: 'FileText' },
    { title: 'Open With a Strong Summary', desc: 'A 2\u20133 sentence summary at the top tells the reader who you are and what you bring before they reach your experience section. Focus on your field, your strongest skill, and what you are looking for.', icon: 'Target' },
    { title: 'Lead With Achievements, Not Just Duties', desc: 'Listing what a role involved is less convincing than showing what you achieved in it. Where possible, quantify your impact. If you do not have numbers, describe the outcome: what changed because you did the work.', icon: 'ListChecks' },
    { title: 'Tailor Your CV to Each Opportunity', desc: 'A generic CV sent to every opportunity is easy to spot and easy to reject. Re-read the opportunity description, reorder or rephrase your experience so the most relevant items come first, and match keywords where genuinely true.', icon: 'Eye' },
    { title: 'Keep Language Simple and Professional', desc: 'Use active verbs like led, built, coordinated, designed, analyzed. Avoid jargon the reader might not know. Proofread carefully and ask someone else to read it before you submit.', icon: 'CheckCircle2' },
    { title: 'Common Mistakes to Avoid', desc: 'Do not include a photo, age, or marital status unless specifically requested. Do not list every task from every role instead of the most relevant ones. Do not leave unexplained gaps without a brief note. Do not use an unprofessional email address. Do not forget to update contact details.', icon: 'AlertTriangle' },
  ],
  dos: [
    'Use action verbs (led, built, coordinated, designed, analyzed)',
    'Quantify your achievements with numbers',
    'Keep formatting consistent throughout',
    'Include relevant keywords from the opportunity',
    'Highlight achievements relevant to this specific opportunity',
    'Include up-to-date contact information',
    'Save and send as a clearly named PDF (e.g. FirstName_LastName_CV.pdf)',
    'Proofread at least twice before submitting',
  ],
  donts: [
    'Include a photo, age, or marital status unless specifically requested',
    'List every task from every role instead of the most relevant ones',
    'Leave unexplained gaps without a brief note',
    'Use an unprofessional email address',
    'Forget to update contact details',
    'Lie or exaggerate your experience',
    'Send the same CV to every opportunity',
    'Use overly complex formatting or tables',
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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete CV Tips from the database?')) return;
    try {
      await api.settings.delete('cv_tips');
      toast.success('CV Tips deleted from database');
      setData(defaultData);
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">CV Tips Editor</h1>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash className="w-4 h-4 mr-1" /> Delete from DB
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
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
