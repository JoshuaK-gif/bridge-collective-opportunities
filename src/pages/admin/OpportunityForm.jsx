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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ArrowLeft, Upload, X, ImageIcon, Crop } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const isEdit = !!id;
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', link: '', image_url: '', image_public_id: '', image_crop: null, image_size: 'medium', category: '', deadline: '' });
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(16 / 9);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);

  useEffect(() => {
    api.categories.list().then(data => setCategories(data)).catch(() => {});
  }, []);

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
      }));
    }
  }, [id, isEdit]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be under 5MB', variant: 'destructive' });
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
      toast({ title: 'Image uploaded', description: 'Now crop the image area to display' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.data?.error || err.message, variant: 'destructive' });
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
      };
      if (isEdit) {
        await api.opportunities.update(id, body);
        toast({ title: 'Opportunity updated' });
      } else {
        await api.opportunities.create(body);
        toast({ title: 'Opportunity created' });
      }
      navigate('/admin-bridgejobs/opportunities');
    } catch (err) {
      toast({ title: 'Error', description: err.data?.error || 'Failed to save', variant: 'destructive' });
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
          <CardTitle>{isEdit ? 'Edit Opportunity' : 'New Opportunity'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <Label>Description</Label>
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

            <div className="grid grid-cols-3 gap-4">
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
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={loading || uploading} className="w-full">
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'} Opportunity
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
