import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Save, Send, Image as ImageIcon, Plus, X, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Scholarship', 'Grant', 'Job', 'Internship', 'Fellowship', 'Training', 'Volunteer'];

const STRUCTURED_FIELDS = [
  { key: 'short_summary', label: 'Short Summary', type: 'textarea', section: 'core' },
  { key: 'about', label: 'About', type: 'textarea', section: 'core' },
  { key: 'organization', label: 'Organization', type: 'text', section: 'details' },
  { key: 'location', label: 'Location', type: 'text', section: 'details' },
  { key: 'duration', label: 'Duration', type: 'text', section: 'details' },
  { key: 'start_date', label: 'Start Date', type: 'text', section: 'details' },
  { key: 'funding', label: 'Funding / Salary / Stipend', type: 'textarea', section: 'details' },
  { key: 'number_of_positions', label: 'Number of Positions', type: 'text', section: 'details' },
  { key: 'work_mode', label: 'Work Mode', type: 'select', options: ['Remote', 'On-site', 'Hybrid'], section: 'details' },
  { key: 'eligible_countries', label: 'Eligible Countries', type: 'text', section: 'eligibility' },
  { key: 'eligible_applicants', label: 'Eligible Applicants', type: 'text', section: 'eligibility' },
  { key: 'selection_process', label: 'Selection Process', type: 'textarea', section: 'process' },
  { key: 'application_process', label: 'Application Process', type: 'textarea', section: 'process' },
];

const ARRAY_FIELDS = [
  { key: 'benefits', label: 'Benefits', section: 'details' },
  { key: 'eligibility_requirements', label: 'Eligibility Requirements', section: 'eligibility' },
  { key: 'responsibilities', label: 'Responsibilities', section: 'details' },
  { key: 'required_documents', label: 'Required Documents', section: 'documents' },
  { key: 'important_dates', label: 'Important Dates', section: 'dates' },
  { key: 'tips_for_applicants', label: 'Tips for Applicants', section: 'tips' },
  { key: 'keywords', label: 'Keywords', section: 'meta' },
];

function ArrayFieldEditor({ label, values, onChange }) {
  const items = Array.isArray(values) ? values : [];
  const addItem = () => onChange([...items, '']);
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i, val) => onChange(items.map((v, idx) => idx === i ? val : v));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Add</Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={e => updateItem(i, e.target.value)} className="flex-1" />
          <Button type="button" variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={() => removeItem(i)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">None added yet</p>
      )}
    </div>
  );
}

export default function AdminDraftEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [applyUrl, setApplyUrl] = useState('');
  const [structured, setStructured] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDups, setCheckingDups] = useState(false);
  const dupTimer = useRef(null);

  useEffect(() => {
    const t = title?.trim();
    const l = applyUrl?.trim();
    if (!t && !l) { setDuplicates([]); return; }
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      setCheckingDups(true);
      try {
        const result = await api.opportunities.checkDuplicates({ title: t || '', link: l || '' });
        setDuplicates(result.duplicates || []);
      } catch {
        setDuplicates([]);
      } finally {
        setCheckingDups(false);
      }
    }, 800);
    return () => { if (dupTimer.current) clearTimeout(dupTimer.current); };
  }, [title, applyUrl]);

  useEffect(() => {
    api.scraper.getDraft(id).then(d => {
      setDraft(d);
      setTitle(d.edited_title || d.source_title || '');
      setDescription(d.edited_description || d.summary || '');
      setCategory(d.edited_category || d.source_category || '');
      setImageUrl(d.edited_image_url || d.image_url || '');
      setDeadline(d.edited_deadline || d.deadline || '');
      setApplyUrl(d.edited_apply_url || d.apply_url || d.source_url || '');
      const sd = d.structured_data || {};
      if (typeof sd === 'string') {
        try { setStructured(JSON.parse(sd)); } catch { setStructured({}); }
      } else {
        setStructured(sd);
      }
    }).catch(() => toast.error('Failed to load draft'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.scraper.updateDraft(id, { title, description, category, image_url: imageUrl, deadline, apply_url: applyUrl, structured_data: structured });
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish this opportunity?')) return;
    setPublishing(true);
    try {
      await api.scraper.updateDraft(id, { title, description, category, image_url: imageUrl, deadline, apply_url: applyUrl, structured_data: structured });
      await api.scraper.publishDraft(id);
      toast.success('Published!');
      navigate('/admin-bridgejobs/scraper');
    } catch {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.upload.image(file);
      setImageUrl(result.url);
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed');
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const result = await api.scraper.enrichDraft(id);
      setTitle(result.title || title);
      setDescription(result.description || description);
      setCategory(result.category || category);
      if (result.structured_data) setStructured(result.structured_data);
      toast.success('All fields generated by AI');
    } catch {
      toast.error('AI enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const updateStructured = (key, value) => {
    setStructured(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin-bridgejobs/scraper"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold font-heading">Edit Draft</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={handleEnrich} disabled={enriching}>
            <Sparkles className="w-4 h-4 mr-1" /> {enriching ? 'Generating...' : 'Generate with AI'}
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            <Send className="w-4 h-4 mr-1" /> {publishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
                {duplicates.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Potential {duplicates.length === 1 ? 'duplicate' : 'duplicates'} found
                    </div>
                    {duplicates.map(d => (
                      <a key={d.id} href={`/admin-bridgejobs/opportunities/${d.id}`} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-amber-600 dark:text-amber-300 hover:underline">
                        {d.title} <span className="text-amber-400">({d.category}{d.deadline ? ` · ${d.deadline}` : ''})</span>
                      </a>
                    ))}
                  </div>
                )}
                {checkingDups && <p className="text-xs text-muted-foreground mt-1">Checking for duplicates...</p>}
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={8} />
              </div>
            </CardContent>
          </Card>

          <Accordion type="multiple" className="space-y-4">
            <AccordionItem value="core">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Core Content</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    {STRUCTURED_FIELDS.filter(f => f.section === 'core').map(f => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        {f.type === 'textarea' ? (
                          <Textarea value={structured[f.key] || ''} onChange={e => updateStructured(f.key, e.target.value)} rows={4} />
                        ) : (
                          <Input value={structured[f.key] || ''} onChange={e => updateStructured(f.key, e.target.value)} />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="details">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Key Details</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {STRUCTURED_FIELDS.filter(f => f.section === 'details' && f.type !== 'textarea').map(f => (
                        <div key={f.key}>
                          <Label>{f.label}</Label>
                          {f.type === 'select' ? (
                            <Select value={structured[f.key] || ''} onValueChange={v => updateStructured(f.key, v)}>
                              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>
                                {f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={structured[f.key] || ''} onChange={e => updateStructured(f.key, e.target.value)} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <Label>Funding / Salary / Stipend</Label>
                      <Textarea value={structured.funding || ''} onChange={e => updateStructured('funding', e.target.value)} rows={3} />
                    </div>
                    <ArrayFieldEditor label="Benefits" values={structured.benefits} onChange={v => updateStructured('benefits', v)} />
                    <ArrayFieldEditor label="Responsibilities" values={structured.responsibilities} onChange={v => updateStructured('responsibilities', v)} />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="eligibility">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Eligibility</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    {STRUCTURED_FIELDS.filter(f => f.section === 'eligibility' && f.type !== 'textarea').map(f => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        <Input value={structured[f.key] || ''} onChange={e => updateStructured(f.key, e.target.value)} />
                      </div>
                    ))}
                    <ArrayFieldEditor label="Eligibility Requirements" values={structured.eligibility_requirements} onChange={v => updateStructured('eligibility_requirements', v)} />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="process">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Application Process</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    {STRUCTURED_FIELDS.filter(f => f.section === 'process').map(f => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        <Textarea value={structured[f.key] || ''} onChange={e => updateStructured(f.key, e.target.value)} rows={4} />
                      </div>
                    ))}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="documents">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Documents & Dates</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    <ArrayFieldEditor label="Required Documents" values={structured.required_documents} onChange={v => updateStructured('required_documents', v)} />
                    <ArrayFieldEditor label="Important Dates" values={structured.important_dates} onChange={v => updateStructured('important_dates', v)} />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="tips">
              <Card>
                <CardHeader>
                  <AccordionTrigger><CardTitle className="text-lg">Tips & Keywords</CardTitle></AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="space-y-4">
                    <ArrayFieldEditor label="Tips for Applicants" values={structured.tips_for_applicants} onChange={v => updateStructured('tips_for_applicants', v)} />
                    <ArrayFieldEditor label="Keywords" values={structured.keywords} onChange={v => updateStructured('keywords', v)} />
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <div>
                <Label>Apply URL</Label>
                <Input value={applyUrl} onChange={e => setApplyUrl(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Image</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {imageUrl ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover" />
                  <button type="button" onClick={() => setImageUrl('')} className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">Remove</button>
                </div>
              ) : (
                <div className="h-32 rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <Label className="text-xs text-muted-foreground cursor-pointer">
                <Input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <span className="text-primary underline">Upload new image</span>
              </Label>
              <Input placeholder="Or paste image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
            </CardContent>
          </Card>

          {draft?.source_url && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Source</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground break-all">
                <a href={draft.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{draft.source_url}</a>
                <p className="mt-1">Scraped: {new Date(draft.created_date).toLocaleDateString()}</p>
                {draft.deadline && <p>Deadline: {draft.deadline}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
