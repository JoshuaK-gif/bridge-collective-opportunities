import { useState, useEffect, useRef } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, CheckCircle2, ArrowLeft, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '@/components/SEO';

export default function SubmitOpportunity() {
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    link: '',
    category: '',
    deadline: '',
    submitter_name: '',
    submitter_email: '',
    image_url: '',
    image_public_id: '',
  });

  // Load categories on mount
  useEffect(() => {
    api.categories.list().then(data => setCategories(data)).catch(() => {});
  }, []);

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
      const result = await api.upload.opportunityImage(file);
      setForm(prev => ({ ...prev, image_url: result.url, image_public_id: result.public_id }));
      toast.success('Image uploaded successfully');
    } catch (err) {
      toast.error(err.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setForm(prev => ({ ...prev, image_url: '', image_public_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Please enter an opportunity title');
      return;
    }
    setSubmitting(true);
    try {
      await api.opportunities.submit({
        title: form.title.trim(),
        description: form.description.trim(),
        link: form.link.trim(),
        category: form.category,
        deadline: form.deadline,
        submitter_name: form.submitter_name.trim(),
        submitter_email: form.submitter_email.trim(),
        image_url: form.image_url,
        image_public_id: form.image_public_id,
      });
      setStep('success');
      toast.success('Opportunity submitted for review!');
    } catch (err) {
      toast.error(err.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <>
        <SEO title="Opportunity Submitted" description="Your opportunity has been submitted for review." />
        <div className="min-h-[70vh] flex items-center justify-center px-4">
          <Card className="max-w-lg w-full text-center">
            <CardContent className="pt-10 pb-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Submitted Successfully! 🎉</h2>
              <p className="text-muted-foreground mb-6">
                Thank you! Your opportunity has been received and is now pending review.
                Our team will review it and publish it on the website if approved.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => { setStep('form'); setForm({ title: '', description: '', link: '', category: '', deadline: '', submitter_name: '', submitter_email: '', image_url: '', image_public_id: '' }); }}>
                  Submit Another
                </Button>
                <Button variant="default" asChild>
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Submit an Opportunity" description="Submit an opportunity to be featured on Bridge Collective Opportunities." />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button variant="default" size="sm" asChild className="mb-6">
          <Link to="/" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Submit an Opportunity</CardTitle>
            <CardDescription>
              Know of a scholarship, job, internship, grant, or training opportunity?
              Share it with our community! Our team will review and publish it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Opportunity Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Opportunity Details</h3>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Mastercard Foundation Scholars Program"
                    required
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Briefly describe the opportunity — who it's for, what it offers, and any key details..."
                    className="w-full min-h-[120px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                    maxLength={10000}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Application Link</label>
                  <Input
                    value={form.link}
                    onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                    placeholder="https://example.com/apply"
                    type="url"
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-3">
                  <label className="text-sm font-medium block">Cover Image (Optional)</label>
                  <div className="flex flex-wrap gap-4 items-start">
                    <div className="relative group">
                      <div className={`w-32 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden ${form.image_url ? 'border-primary/50' : 'border-muted-foreground/20'}`}>
                        {form.image_url ? (
                          <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-6 h-6 text-muted-foreground/40" />
                        )}
                      </div>
                      {form.image_url && (
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Uploading...' : 'Upload Image'}
                      </Button>
                      <p className="text-[11px] text-muted-foreground">
                        Max 5MB. Formats: JPG, PNG, WebP.
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Deadline</label>
                    <Input
                      type="date"
                      value={form.deadline}
                      onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Your Info */}
              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Your Information</h3>
                <p className="text-xs text-muted-foreground">
                  Optional — we may contact you if we need more details about this opportunity.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Your Name</label>
                    <Input
                      value={form.submitter_name}
                      onChange={e => setForm(f => ({ ...f, submitter_name: e.target.value }))}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Your Email</label>
                    <Input
                      type="email"
                      value={form.submitter_email}
                      onChange={e => setForm(f => ({ ...f, submitter_email: e.target.value }))}
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button type="submit" disabled={submitting || !form.title.trim()} size="lg">
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                By submitting, you agree that the information provided is accurate.
                Our team will review your submission before it goes live.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
