import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { api } from '@/api/client';
import { cloudinaryUrl } from '@/lib/images';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, X, Crop, Download, Globe, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'clean'],
  ],
};

const ASPECT_RATIOS = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 / 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
  { label: '2:1', value: 2 / 1 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '1:2', value: 1 / 2 },
];

export default function OpportunityForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const isEdit = !!id;
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', link: '', image_url: '', image_public_id: '', image_crop: null, image_size: 'medium', category: '', deadline: '', status: 'active', publish_at: '', template_name: '', structured_data: null });
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloning, setCloning] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [categories, setCategories] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDups, setCheckingDups] = useState(false);
  const dupTimer = useRef(null);

  const handleEnrich = async () => {
    if (!isEdit || !form.title) return;
    setEnriching(true);
    try {
      const result = await api.opportunities.enrich(id);
      setForm(prev => ({
        ...prev,
        title: result.title || prev.title,
        description: result.description || prev.description,
      }));
      const kw = (result.keywords || []).slice(0, 5).join(', ');
      toast('✨ AI description generated!' + (kw ? ` Keywords: ${kw}` : ''));
    } catch (err) {
      toast('AI enrichment failed: ' + (err.data?.error || err.message));
    } finally {
      setEnriching(false);
    }
  };

  const handleCloneUrl = async () => {
    if (!cloneUrl.trim()) return;
    setCloning(true);
    try {
      const data = await api.opportunities.cloneFromUrl(cloneUrl.trim());
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        category: data.category || prev.category,
        deadline: data.deadline || prev.deadline,
        link: data.link || prev.link,
      }));
      setCloneUrl('');
      toast('URL scraped — form pre-filled. Review and save.');
    } catch (err) {
      toast('Failed to clone URL: ' + (err.data?.error || err.message));
    } finally {
      setCloning(false);
    }
  };

  const handleSaveTemplate = async () => {
    const name = prompt('Template name:');
    if (!name) return;
    setSavingTemplate(true);
    try {
      await api.templates.create({
        name,
        category: form.category,
        description: form.description,
        image_url: form.image_url,
        deadline: form.deadline,
        link: form.link,
      });
      toast('Template saved: ' + name);
      api.templates.list().then(data => setTemplates(data)).catch(() => {});
    } catch (err) {
      toast('Failed to save template: ' + (err.data?.error || err.message));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = async (templateId) => {
    try {
      const t = await api.templates.get(templateId);
      setForm(prev => ({
        ...prev,
        title: t.name || prev.title,
        description: t.description || prev.description,
        category: t.category || prev.category,
        image_url: t.image_url || prev.image_url,
        deadline: t.deadline || prev.deadline,
        link: t.link || prev.link,
      }));
      toast('Template loaded: ' + t.name);
    } catch (err) {
      toast('Failed to load template');
    }
  };
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);

  useEffect(() => {
    api.categories.list().then(data => setCategories(data)).catch(() => {});
    api.templates.list().then(data => setTemplates(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const title = form.title?.trim();
    const link = form.link?.trim();
    if (!title && !link) { setDuplicates([]); return; }
    if (dupTimer.current) clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      setCheckingDups(true);
      try {
        const params = { title, link };
        if (id) params.exclude = id;
        const result = await api.opportunities.checkDuplicates(params);
        setDuplicates(result.duplicates || []);
      } catch {
        setDuplicates([]);
      } finally {
        setCheckingDups(false);
      }
    }, 800);
    return () => { if (dupTimer.current) clearTimeout(dupTimer.current); };
  }, [form.title, form.link, id]);

  useEffect(() => {
    if (isEdit) {
      api.opportunities.get(id).then(data => setForm({
        title: data.title,
        description: data.description,
        link: data.link,
        image_url: data.image_url,
        image_public_id: data.image_public_id || '',
        image_crop: data.image_crop || null,
        image_size: data.image_size || 'medium',
        category: data.category,
        deadline: data.deadline,
        status: data.status || 'active',
        publish_at: data.publish_at ? data.publish_at.slice(0, 16) : '',
        template_name: data.template_name || '',
        structured_data: data.structured_data,
      }));
    }
  }, [id, isEdit]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const result = await api.upload.image(file);
      setForm(prev => ({ ...prev, image_url: result.url, image_public_id: result.public_id, image_crop: null, _imgW: result.width, _imgH: result.height }));
      setPendingImage(result.url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(16 / 9);
      setCroppedAreaPixels(null);
      setCropDialogOpen(true);
      toast('Image uploaded', { description: 'Now crop the image area to display' });
    } catch (err) {
      toast.error('Upload failed', { description: err.data?.error || err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const applyCrop = () => {
    if (croppedAreaPixels) {
      setForm(prev => ({ ...prev, image_crop: { x: Math.round(croppedAreaPixels.x), y: Math.round(croppedAreaPixels.y), width: Math.round(croppedAreaPixels.width), height: Math.round(croppedAreaPixels.height), imageWidth: prev._imgW || 0, imageHeight: prev._imgH || 0 } }));
    }
    setCropDialogOpen(false);
  };

  const removeImage = () => {
    setForm(prev => ({ ...prev, image_url: '', image_public_id: '', image_crop: null, _imgW: 0, _imgH: 0 }));
  };

  const previewUrl = form.image_public_id && form.image_crop
    ? cloudinaryUrl(form.image_public_id, { crop: form.image_crop, width: 320 })
    : form.image_url;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        link: form.link,
        image_url: form.image_url,
        image_public_id: form.image_public_id,
        image_crop: form.image_crop,
        image_size: form.image_size,
        category: form.category,
        deadline: form.deadline,
        status: saveAsDraft ? 'draft' : form.status,
        publish_at: form.publish_at || null,
      };
      if (isEdit) {
        await api.opportunities.update(id, body);
        toast('Opportunity updated');
      } else {
        await api.opportunities.create(body);
        toast('Opportunity created' + (saveAsDraft ? ' as draft' : ''));
      }
      navigate('/admin-bridgejobs/opportunities');
    } catch (err) {
      toast('Error: ' + (err.data?.error || 'Failed to save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/admin-bridgejobs/opportunities')} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isEdit ? 'Edit Opportunity' : 'New Opportunity'}</span>
            {form.status === 'pending' && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Review</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {form.structured_data?.type === 'user_submission' && (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
              <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Globe className="w-4 h-4" /> User Submission Details
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-amber-700">Submitter:</span>
                <span className="font-medium text-amber-900">{form.structured_data.submitted_by}</span>
                <span className="text-amber-700">Email:</span>
                <span className="font-medium text-amber-900">{form.structured_data.submitter_email || 'Not provided'}</span>
                <span className="text-amber-700">Submitted:</span>
                <span className="font-medium text-amber-900">{new Date(form.structured_data.submitted_at).toLocaleString()}</span>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
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
              <div className="flex items-center justify-between mb-2">
                <Label>Description</Label>
                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnrich}
                    disabled={enriching || !form.title}
                    className="text-xs gap-1.5"
                  >
                    {enriching ? (
                      <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Generating...</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg> Generate Full Description</>
                    )}
                  </Button>
                )}
              </div>
              <ReactQuill
                value={form.description}
                onChange={v => setForm({ ...form, description: v })}
                modules={QUILL_MODULES}
                className="bg-background [&_.ql-editor]:min-h-[200px] [&_.ql-editor]:text-base"
              />
            </div>
            <div>
              <Label>Link</Label>
              <Input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://..." />
            </div>

            {/* Image upload */}
            <div>
              <Label>Image (optional)</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="w-4 h-4 mr-1" /> Upload File
                  </Button>
                  <span className="text-xs text-muted-foreground">or paste an image URL</span>
                </div>
                <Input
                  type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload}
                  className="hidden"
                />
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={form.image_url}
                  onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value, image_public_id: '', image_crop: null, _imgW: 0, _imgH: 0 }))}
                />
                {uploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
                {form.image_url && (
                  <div className="space-y-2">
                    <div className="relative inline-block">
                      <img src={previewUrl} alt="Preview" className="h-40 rounded-lg object-cover border"
                        onError={e => { e.target.style.border = '2px solid red'; e.target.style.opacity = '0.5'; }}
                      />
                      <button type="button" onClick={removeImage}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {form.image_public_id && (
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setPendingImage(form.image_url);
                        const c = form.image_crop;
                        if (c && c.imageWidth && c.imageWidth > 0) {
                          setCrop({ x: (c.x + c.width / 2) / c.imageWidth * 100, y: (c.y + c.height / 2) / c.imageHeight * 100 });
                        } else {
                          setCrop({ x: 50, y: 50 });
                        }
                        setZoom(1);
                        setAspect(16 / 9);
                        setCropDialogOpen(true);
                      }}>
                        <Crop className="w-4 h-4 mr-1" /> Adjust Crop
                      </Button>
                    )}
                    {form.image_crop && (
                      <p className="text-xs text-muted-foreground">Crop area set</p>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Upload an image or paste a URL. Optional — opportunities will work without one.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Image Size</Label>
                <Select value={form.image_size} onValueChange={v => setForm({ ...form, image_size: v })}>
                  <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div>
                <Label>Schedule Publish</Label>
                <Input type="datetime-local" value={form.publish_at} onChange={e => setForm({ ...form, publish_at: e.target.value })} />
              </div>
            </div>

            {/* Save as Draft toggle */}
            <div className="flex items-center gap-3">
              <Switch checked={saveAsDraft} onCheckedChange={setSaveAsDraft} />
              <Label>Save as Draft (don't publish yet)</Label>
            </div>

            {/* Clone from URL */}
            {!isEdit && (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Clone from URL</Label>
                  <Input value={cloneUrl} onChange={e => setCloneUrl(e.target.value)} placeholder="https://example.com/opportunity" onKeyDown={e => e.key === 'Enter' && handleCloneUrl()} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleCloneUrl} disabled={cloning || !cloneUrl.trim()}>
                  <Globe className="w-4 h-4 mr-1" /> {cloning ? 'Cloning...' : 'Clone'}
                </Button>
              </div>
            )}

            {/* Templates */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Load Template</Label>
                <Select onValueChange={handleLoadTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choose template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="sm" onClick={handleSaveTemplate} disabled={savingTemplate}>
                  <Download className="w-4 h-4 mr-1" /> {savingTemplate ? 'Saving...' : 'Save as Template'}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={loading || uploading} className={`w-full ${form.status === 'pending' && !saveAsDraft ? 'bg-green-600 hover:bg-green-700' : ''}`}>
              {loading ? 'Saving...' : isEdit ? (form.status === 'pending' && !saveAsDraft ? 'Approve & Publish' : 'Update') : saveAsDraft ? 'Save as Draft' : 'Publish'} Opportunity
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-80 bg-black/10 rounded-lg overflow-hidden">
            {pendingImage && (
              <Cropper
                image={pendingImage}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-3 py-2">
            <div>
              <span className="text-sm text-muted-foreground block mb-2">Aspect Ratio:</span>
              <ToggleGroup type="single" value={String(aspect)} onValueChange={v => setAspect(v === 'undefined' ? undefined : Number(v))} className="flex-wrap justify-start gap-1">
                {ASPECT_RATIOS.map(r => (
                  <ToggleGroupItem key={r.label} value={String(r.value)} size="sm" className="text-xs px-2.5">
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground shrink-0">Zoom:</span>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setCropDialogOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={applyCrop}>Apply Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
